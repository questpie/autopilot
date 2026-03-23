import type { Agent, Company, Task } from '@questpie/autopilot-spec'
import { buildSystemPrompt } from '@questpie/autopilot-agents'
import type { AgentRole } from '@questpie/autopilot-agents'
import { buildCompanySnapshot } from './snapshot'
import { loadAgentMemory } from './memory-loader'
import { getSkillsForRole } from '../skills'
import { stringify as stringifyYaml } from 'yaml'

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
	maxTokens?: number
}

const DEFAULT_MAX_TOKENS = 42_000
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
	return agents
		.map((a) => `- ${a.name} (${a.id}): ${a.role} — ${a.description}`)
		.join('\n')
}

function formatTasksSummary(
	tasks: Array<{ id: string; title: string; status: string; assigned_to?: string }>,
): string {
	if (tasks.length === 0) return 'No active tasks.'
	return tasks
		.map(
			(t) =>
				`- [${t.status}] ${t.title} (${t.id})${t.assigned_to ? ` → ${t.assigned_to}` : ''}`,
		)
		.join('\n')
}

function formatMessages(
	messages: Array<{ from: string; content: string; at: string }>,
): string {
	if (messages.length === 0) return ''
	return messages
		.map((m) => `[${m.at}] ${m.from}: ${m.content}`)
		.join('\n')
}

function formatPins(
	pins: Array<{ title: string; type: string; content: string }>,
): string {
	if (pins.length === 0) return ''
	return pins.map((p) => `- [${p.type}] ${p.title}: ${p.content}`).join('\n')
}

/**
 * Build a multi-layer system prompt for an agent session.
 *
 * Layers (each capped to a token budget):
 * 1. **Identity** (~2K) -- role prompt from `@questpie/autopilot-agents`.
 * 2. **Company state** (~5K) -- active tasks, messages, pins, team status.
 * 3. **Agent memory** (~20K) -- persistent memory from `memory.yaml`.
 * 4. **Task context** (~15K) -- detailed current-task information.
 * 5. **Skills** (~1K) -- available skill catalogue entries.
 *
 * The whole prompt is then hard-truncated to {@link ContextOptions.maxTokens}
 * (default 42 000).
 */
export async function assembleContext(options: ContextOptions): Promise<AssembledContext> {
	const { companyRoot, agent, company, task, allAgents, maxTokens = DEFAULT_MAX_TOKENS } = options

	const sections: string[] = []

	// Layer 1: Identity (~2K tokens) — agent role prompt via buildSystemPrompt
	const teamRoster = formatTeamRoster(allAgents)
	const identityPrompt = buildSystemPrompt(agent.role as AgentRole, {
		companyName: company.name,
		teamRoster,
		currentTasksSummary: '',
	})
	sections.push(identityPrompt)

	// Layer 2: Company State (~5K tokens) — role-scoped snapshot
	const snapshot = await buildCompanySnapshot(companyRoot, agent)
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

	// Layer 3: Memory (~20K tokens) — agent's memory.yaml
	const memory = await loadAgentMemory(companyRoot, agent.id)
	if (memory) {
		const memoryContent = stringifyYaml(memory, { lineWidth: 120 })
		sections.push(
			truncateToTokens(`## Agent Memory\n\`\`\`yaml\n${memoryContent}\`\`\``, 20_000),
		)
	}

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

		sections.push(truncateToTokens(taskLines.join('\n'), 15_000))
	}

	// Layer 5: Skills Discovery (~1K tokens) — available skills for the agent's role
	const roleSkills = await getSkillsForRole(companyRoot, agent.role)
	if (roleSkills.length > 0) {
		const skillLines: string[] = ['## Available Skills']
		skillLines.push('Use the `skill_request` tool with a skill_id to load full content.\n')
		for (const skill of roleSkills) {
			const desc = skill.description ? ` — ${skill.description}` : ''
			skillLines.push(`- **${skill.name}** (\`${skill.id}\`)${desc}`)
		}
		sections.push(truncateToTokens(skillLines.join('\n'), 1_000))
	}

	// Layer 6: Autopilot MCP Tools — explicit list so agent knows what's available
	sections.push(`## Autopilot MCP Tools (ALWAYS available)

You have these tools via the "autopilot" MCP server. Use them to interact with the company.

### Task Management
- **update_task**({ task_id, status, note }) — Update a task's status. YOU MUST CALL THIS when done.
- **create_task**({ title, type, priority, assigned_to, workflow }) — Create a new task.
- **add_blocker**({ task_id, reason, assigned_to }) — Escalate a blocker to human.
- **resolve_blocker**({ task_id, note }) — Mark a blocker as resolved.

### Communication
- **send_message**({ to, content }) — Send to "channel:dev", "agent:max", or "human:founder". CALL THIS after completing work.
- **ask_agent**({ to, question, reason }) — Ask another agent for information.

### Dashboard
- **pin_to_board**({ group, title, type, content }) — Pin output for human visibility. CALL THIS for important results.
- **unpin_from_board**({ pin_id }) — Remove a pin.

### Knowledge
- **search_knowledge**({ query }) — Search the company knowledge base.
- **update_knowledge**({ path, content, reason }) — Add/update a knowledge document.
- **skill_request**({ skill_id }) — Load a skill document for guidance.

### External
- **http_request**({ method, url, secret_ref }) — Call an external API with secret injection.
- **create_artifact**({ name, type, files }) — Create a previewable artifact.

### CRITICAL REMINDER
After finishing ANY task, you MUST:
1. \`update_task({ task_id: "...", status: "done", note: "..." })\`
2. \`send_message({ to: "channel:dev", content: "Done: ..." })\`
3. \`pin_to_board({ group: "recent", title: "...", type: "success" })\`

Without these 3 calls, the workflow pipeline stops.`)

	const systemPrompt = sections.join('\n\n---\n\n')

	// Enforce overall max tokens
	const finalPrompt = truncateToTokens(systemPrompt, maxTokens)
	const tokenEstimate = estimateTokens(finalPrompt)

	return {
		systemPrompt: finalPrompt,
		tokenEstimate,
	}
}
