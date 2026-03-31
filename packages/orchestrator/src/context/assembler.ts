import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Agent, Company, Task } from '@questpie/autopilot-spec'
import { rolePath as specRolePath } from '@questpie/autopilot-spec'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import { container } from '../container'
import type { StorageBackend } from '../fs/storage'
import { streamManagerFactory } from '../session/stream'
import { getSkillsForRole } from '../skills'
import { loadAgentMemory } from './memory-loader'
import { buildCompanySnapshot } from './snapshot'

/** The final output of the context assembly pipeline. */
export interface AssembledContext {
	/** Full system prompt ready to send to the LLM. */
	systemPrompt: string
	/** Rough token count (chars / 4). */
	tokenEstimate: number
}

/** Input options for {@link assembleContext}. */
export interface ContextOptions {
	companyRoot: string
	agent: Agent
	company: Company
	task?: Task
	allAgents: Agent[]
	storage: StorageBackend
	maxTokens?: number
}

const DEFAULT_MAX_TOKENS = 48_000
const CHARS_PER_TOKEN = 4

function estimateTokens(text: string): number {
	return Math.ceil(text.length / CHARS_PER_TOKEN)
}

function truncateToTokens(text: string, maxTokens: number): string {
	const maxChars = maxTokens * CHARS_PER_TOKEN
	if (text.length <= maxChars) return text
	return `${text.slice(0, maxChars)}\n\n[... truncated ...]`
}

function formatTeamRoster(agents: Agent[]): string {
	return agents.map((a) => `- ${a.name} (${a.id}): ${a.role} — ${a.description}`).join('\n')
}

function formatTasksSummary(
	tasks: Array<{ id: string; title: string; status: string; assigned_to?: string }>,
): string {
	if (tasks.length === 0) return 'No active tasks.'
	return tasks
		.map((t) => `- [${t.status}] ${t.title} (${t.id})${t.assigned_to ? ` → ${t.assigned_to}` : ''}`)
		.join('\n')
}

function formatMessages(messages: Array<{ from: string; content: string; at: string }>): string {
	if (messages.length === 0) return ''
	return messages.map((m) => `[${m.at}] ${m.from}: ${m.content}`).join('\n')
}

function formatPins(pins: Array<{ title: string; type: string; content: string }>): string {
	if (pins.length === 0) return ''
	return pins.map((p) => `- [${p.type}] ${p.title}: ${p.content}`).join('\n')
}

/** Parsed defaults from a role prompt file's YAML frontmatter. */
export interface RoleDefaults {
	tools?: string[]
	fs_scope?: { read?: string[]; write?: string[] }
	description?: string
}

/**
 * Parse YAML frontmatter from a markdown file.
 * Returns the frontmatter as a record and the body content.
 */
function parseFrontmatter(raw: string): { frontmatter: Record<string, unknown>; content: string } {
	const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
	if (!match) return { frontmatter: {}, content: raw }

	try {
		const frontmatter = parseYaml(match[1]!) as Record<string, unknown>
		return { frontmatter: frontmatter ?? {}, content: (match[2] ?? '').trim() }
	} catch {
		return { frontmatter: {}, content: raw }
	}
}

/**
 * Load a role prompt from the filesystem.
 *
 * Reads `team/roles/{role}.md`, parses YAML frontmatter for defaults,
 * and returns the prompt body with template variables replaced.
 *
 * Fallback chain:
 * 1. `team/roles/{role}.md` exists -> use it
 * 2. Doesn't exist -> use agent.description as minimal prompt
 * 3. Neither -> generic fallback
 */
/** D46: In-memory role prompt cache, keyed by role name. */
const roleCache = new Map<string, { prompt: string; defaults: RoleDefaults; raw: string }>()

/** D46: Invalidate cache for a specific role (called from file watcher). */
export function invalidateRoleCache(role?: string): void {
	if (role) {
		roleCache.delete(role)
	} else {
		roleCache.clear()
	}
}

export function loadRolePrompt(
	companyRoot: string,
	role: string,
	variables: { companyName: string; teamRoster: string },
): { prompt: string; defaults: RoleDefaults } {
	const rolePath = join(companyRoot, specRolePath(role))

	if (!existsSync(rolePath)) {
		return { prompt: '', defaults: {} }
	}

	// D46: Check cache
	const raw = readFileSync(rolePath, 'utf-8')
	const cached = roleCache.get(role)
	if (cached && cached.raw === raw) {
		// Re-apply variables to cached content (variables may change between calls)
		const prompt = cached.prompt
			.replace(/\{\{companyName\}\}/g, variables.companyName)
			.replace(/\{\{teamRoster\}\}/g, variables.teamRoster)
		return { prompt, defaults: cached.defaults }
	}

	const { frontmatter, content } = parseFrontmatter(raw)

	const defaults: RoleDefaults = {
		tools: frontmatter.default_tools as string[] | undefined,
		fs_scope: frontmatter.default_fs_scope as RoleDefaults['fs_scope'],
		description: frontmatter.description as string | undefined,
	}

	// Cache the raw content (before variable substitution)
	roleCache.set(role, { prompt: content, defaults, raw })

	const prompt = content
		.replace(/\{\{companyName\}\}/g, variables.companyName)
		.replace(/\{\{teamRoster\}\}/g, variables.teamRoster)

	return { prompt, defaults }
}

/**
 * Build the identity prompt for an agent, with language and timezone addons.
 */
function buildIdentityPrompt(
	companyRoot: string,
	agent: Agent,
	company: Company,
	teamRoster: string,
): string {
	const { prompt: rolePrompt } = loadRolePrompt(companyRoot, agent.role, {
		companyName: company.name,
		teamRoster,
	})

	const sections: string[] = []

	if (rolePrompt) {
		sections.push(rolePrompt)
	} else if (agent.description) {
		// Fallback: use agent description from team/agents/{id}.yaml
		sections.push(
			`You are ${agent.name}, a ${agent.role} at ${company.name}.\n\n${agent.description}\n\n## Your Team\n${teamRoster}`,
		)
	} else {
		// Generic fallback
		sections.push(
			`You are ${agent.name}, an AI assistant at ${company.name}.\n\n## Your Team\n${teamRoster}`,
		)
	}

	// Language instructions (additive — only for non-English)
	if (company.language && company.language !== 'en') {
		const langLines: string[] = [
			`LANGUAGE: The primary communication language for this company is ${company.language}. Respond in ${company.language} when communicating with humans. Use English for code, technical terms, and tool outputs.`,
		]

		if (company.languages && company.languages.length > 1) {
			langLines.push(
				`The company operates in multiple languages: ${company.languages.join(', ')}. Default to ${company.language} for human communication.`,
			)
		}

		sections.push(langLines.join('\n'))
	}

	// Timezone instruction
	if (company.timezone) {
		sections.push(`TIMEZONE: The company operates in the ${company.timezone} timezone.`)
	}

	return sections.join('\n\n')
}

/**
 * Build a multi-layer system prompt for an agent session.
 *
 * Layers (each capped to a token budget, ordered by priority):
 * 1. **Identity** (~2K) -- role prompt from `team/roles/{role}.md`.
 * 2. **Autopilot MCP Tools** (~2K) -- tool documentation (MUST have).
 * 3. **Company state** (~5K) -- active tasks, messages, pins, team status.
 * 4. **Task context** (~15K) -- detailed current-task information.
 * 5. **Skills** (~2K) -- available skill catalogue entries.
 * 6. **Agent memory** (~16K) -- persistent memory (expendable, truncated last).
 *
 * The whole prompt is then hard-truncated to {@link ContextOptions.maxTokens}
 * (default 48 000). Memory is placed last so that if truncation occurs,
 * it trims memory rather than tool documentation.
 */
export async function assembleContext(options: ContextOptions): Promise<AssembledContext> {
	const {
		companyRoot,
		agent,
		company,
		task,
		allAgents,
		storage,
		maxTokens = DEFAULT_MAX_TOKENS,
	} = options

	const sections: string[] = []

	// Layer 1: Identity (~2K tokens) — agent role prompt from filesystem
	const teamRoster = formatTeamRoster(allAgents)
	const identityPrompt = buildIdentityPrompt(companyRoot, agent, company, teamRoster)
	sections.push(identityPrompt)

	// Layer 2: Autopilot MCP Tools (~2K tokens) — explicit list so agent knows what's available
	// Placed early so it is NEVER truncated by the final hard-truncation pass.
	sections.push(`## Autopilot MCP Tools (ALWAYS available)

You have these tools via the "autopilot" MCP server. Use them to interact with the company.

### Task Management
- **task**({ action: "create", title, type, priority, assigned_to, workflow }) — Create a new task.
- **task**({ action: "update", task_id, status, note }) — Update a task's status. YOU MUST CALL THIS when done.
- **task**({ action: "approve", task_id, note }) — Approve a task (moves to done).
- **task**({ action: "reject", task_id, reason }) — Reject a task (moves to blocked).
- **task**({ action: "block", task_id, reason, blocker_assigned_to }) — Escalate a blocker to human.
- **task**({ action: "unblock", task_id, note }) — Mark a blocker as resolved.

### Communication
- **message**({ channel, content }) — Send to a channel. Conventions:
  - \`"dm-{agentId}"\` — Direct message (auto-creates DM channel)
  - \`"task-{id}"\` — Task thread (auto-created)
  - \`"project-{name}"\` — Project channel (auto-created)
  - Any other name — standard channel (must exist)

### Dashboard
- **pin**({ action: "create", group, title, type, content }) — Pin output for human visibility.
- **pin**({ action: "remove", pin_id }) — Remove a pin.

### Search
- **search_index**({ query, type?, scope? }) — Search the internal index across all entities (tasks, messages, knowledge, pins, agents, channels, skills).

### Knowledge & Artifacts
- Use \`write_file("knowledge/...", content)\` to add/update knowledge docs (auto-indexed by watcher).
- Use \`write_file("artifacts/{name}/...", ...)\` to create artifacts (watcher registers on .artifact.yaml).

### External
- **fetch**({ method, url, headers?, body?, secret_ref? }) — Fetch a URL or call an external API. Supports GET, POST, PUT, PATCH, DELETE with custom headers and body.

### Web
- **web_search**({ query, max_results? }) — Search the web for current information. Returns results with titles, URLs, and content snippets.

### CRITICAL REMINDER
After finishing ANY task, you MUST:
1. \`task({ action: "update", task_id: "...", status: "done", note: "..." })\`
2. \`message({ channel: "dev", content: "Done: ..." })\`
3. \`pin({ action: "create", group: "recent", title: "...", type: "success" })\`

Without these 3 calls, the workflow pipeline stops.`)

	// Layer 3: Company State (~5K tokens) — role-scoped snapshot
	let streamManager: import('../session/stream').SessionStreamManager | null = null
	try {
		const resolved = container.resolve([streamManagerFactory])
		streamManager = resolved.streamManager
	} catch {
		// StreamManager may not be initialized yet
	}
	const snapshot = await buildCompanySnapshot(companyRoot, agent, storage, streamManager)
	const stateLines: string[] = ['## Current Company State']

	const tasksSummary = formatTasksSummary(snapshot.activeTasks)
	stateLines.push(`### Active Tasks\n${tasksSummary}`)

	const messagesSummary = formatMessages(snapshot.recentMessages)
	if (messagesSummary) {
		stateLines.push(`### Recent Messages\n${messagesSummary}`)
	}

	const pinsSummary = formatPins(snapshot.dashboardPins)
	if (pinsSummary) {
		stateLines.push(`### Dashboard Pins\n${pinsSummary}`)
	}

	if (snapshot.agentStatuses.length > 0) {
		const agentLines = snapshot.agentStatuses
			.map((a) => `- ${a.name} (${a.role}): ${a.status}`)
			.join('\n')
		stateLines.push(`### Team Status\n${agentLines}`)
	}

	sections.push(truncateToTokens(stateLines.join('\n\n'), 5_000))

	// Layer 4: Task Context (~15K tokens) — current task details
	if (task) {
		const taskLines: string[] = ['## Current Task']
		taskLines.push(`**ID**: ${task.id}`)
		taskLines.push(`**Title**: ${task.title}`)
		taskLines.push(`**Status**: ${task.status}`)
		taskLines.push(`**Type**: ${task.type}`)
		taskLines.push(`**Priority**: ${task.priority}`)
		if (task.description) {
			taskLines.push(`**Description**: ${task.description}`)
		}
		if (task.assigned_to) {
			taskLines.push(`**Assigned to**: ${task.assigned_to}`)
		}
		if (task.workflow) {
			taskLines.push(`**Workflow**: ${task.workflow}`)
		}
		if (task.workflow_step) {
			taskLines.push(`**Workflow Step**: ${task.workflow_step}`)
		}
		if (task.depends_on.length > 0) {
			taskLines.push(`**Depends on**: ${task.depends_on.join(', ')}`)
		}
		if (task.blockers.length > 0) {
			const blockerLines = task.blockers
				.filter((b) => !b.resolved)
				.map((b) => `  - [${b.type}] ${b.reason} (assigned: ${b.assigned_to})`)
			if (blockerLines.length > 0) {
				taskLines.push(`**Blockers**:\n${blockerLines.join('\n')}`)
			}
		}

		// Include context files referenced in task.context
		if (Object.keys(task.context).length > 0) {
			taskLines.push('\n### Task Context Files')
			for (const [key, value] of Object.entries(task.context)) {
				taskLines.push(`- **${key}**: ${value}`)
			}
		}

		// CR-005: Include recent task channel messages in context
		try {
			const taskChannelId = `task-${task.id}`
			const taskMessages = await storage.readMessages({ channel: taskChannelId, limit: 10 })
			if (taskMessages.length > 0) {
				const taskDiscussion = formatMessages(taskMessages)
				taskLines.push(
					`\n### Task Discussion\nRecent messages from #${taskChannelId}:\n${taskDiscussion}`,
				)
			}
		} catch {
			// Task channel may not exist yet — safe to ignore
		}

		// CR-006: Include recent project channel messages in context
		if (task.project) {
			try {
				const projectChannelId = `project-${task.project}`
				const projectMessages = await storage.readMessages({ channel: projectChannelId, limit: 5 })
				if (projectMessages.length > 0) {
					const projectDiscussion = formatMessages(projectMessages)
					taskLines.push(
						`\n### Project Discussion\nRecent messages from #${projectChannelId}:\n${projectDiscussion}`,
					)
				}
			} catch {
				// Project channel may not exist yet — safe to ignore
			}
		}

		sections.push(truncateToTokens(taskLines.join('\n'), 15_000))
	}

	// Layer 5: Skills Discovery (~2K tokens) — auto-load role-relevant skills (TM-007)
	const roleSkills = await getSkillsForRole(companyRoot, agent.role)
	if (roleSkills.length > 0) {
		const skillLines: string[] = ['## Available Skills']
		skillLines.push(
			'These skills are auto-loaded based on your role. Use `read_file("skills/{id}/SKILL.md")` for full content.\n',
		)
		// Include top 5 most relevant skill summaries directly in context
		const topSkills = roleSkills.slice(0, 5)
		for (const skill of topSkills) {
			const desc = skill.description ? ` — ${skill.description}` : ''
			skillLines.push(`- **${skill.name}** (\`${skill.id}\`)${desc}`)
		}
		if (roleSkills.length > 5) {
			skillLines.push(
				`\n...and ${roleSkills.length - 5} more. Use \`read_file("skills/{id}/SKILL.md")\` to access any skill.`,
			)
		}
		sections.push(truncateToTokens(skillLines.join('\n'), 2_000))
	}

	// Layer 6: Agent Memory (~16K tokens) — persistent memory from memory.yaml
	// Placed LAST so truncation trims memory (expendable) rather than tools or task context.
	const memory = await loadAgentMemory(companyRoot, agent.id)
	if (memory) {
		const memoryContent = stringifyYaml(memory, { lineWidth: 120 })
		sections.push(truncateToTokens(`## Agent Memory\n\`\`\`yaml\n${memoryContent}\`\`\``, 16_000))
	}

	const systemPrompt = sections.join('\n\n---\n\n')

	// Enforce overall max tokens
	const finalPrompt = truncateToTokens(systemPrompt, maxTokens)
	const tokenEstimate = estimateTokens(finalPrompt)

	return {
		systemPrompt: finalPrompt,
		tokenEstimate,
	}
}
