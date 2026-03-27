import { mkdir } from 'node:fs/promises'
import { join, relative, resolve } from 'path'
import dns from 'node:dns/promises'
import { stringify } from 'yaml'
import { z } from 'zod'
import { PATHS } from '@questpie/autopilot-spec'
import type { StorageBackend } from '../fs/storage'
import { createPin, removePin } from '../fs/pins'
import { readYamlUnsafe, writeYaml } from '../fs/yaml'
import { loadSkillContent } from '../skills'
import { isDeniedPath } from '../auth/deny-patterns'
import type { EventBus } from '../events/event-bus'
import { container } from '../container'
import { indexerFactory } from '../db/indexer'
import type { Indexer } from '../db/indexer'
import { loadAgents } from '../fs'
import { loadAgentMemory } from '../context/memory-loader'
import { streamManagerFactory } from '../session/stream'

/** Best-effort resolve the indexer for real-time index updates. */
async function getIndexer(): Promise<Indexer | null> {
	try {
		const { indexer } = await container.resolveAsync([indexerFactory])
		return indexer
	} catch {
		return null
	}
}

// ─── Tool definition types ─────────────────────────────────────────────────

/** A single tool that an agent can invoke during a session. */
export interface ToolDefinition<T extends z.ZodType = z.ZodType> {
	name: string
	description: string
	schema: T
	execute: (args: z.output<T>, context: ToolContext) => Promise<ToolResult>
}

/** Contextual data passed to every tool execution. */
export interface ToolContext {
	companyRoot: string
	agentId: string
	storage: StorageBackend
	eventBus: EventBus
}

/** Structured result returned to the LLM after a tool call. */
export interface ToolResult {
	content: Array<{ type: 'text'; text: string }>
	isError?: boolean
}

// -- Tool factory --

function defineTool<T extends z.ZodType>(
	name: string,
	description: string,
	schema: T,
	execute: (args: z.output<T>, context: ToolContext) => Promise<ToolResult>,
): ToolDefinition<T> {
	return { name, description, schema, execute }
}

// ─── SSRF protection helpers ───────────────────────────────────────────────

const PRIVATE_IP_RANGES = [
	// 127.0.0.0/8
	/^127\./,
	// 10.0.0.0/8
	/^10\./,
	// 172.16.0.0/12
	/^172\.(1[6-9]|2\d|3[01])\./,
	// 192.168.0.0/16
	/^192\.168\./,
	// 169.254.0.0/16 (link-local)
	/^169\.254\./,
	// IPv6 loopback
	/^::1$/,
	// IPv6 unique local (fd00::/8)
	/^fd[0-9a-f]{2}:/i,
]

function isPrivateIp(ip: string): boolean {
	return PRIVATE_IP_RANGES.some((re) => re.test(ip))
}

async function checkSsrf(url: string): Promise<string | null> {
	let parsed: URL
	try {
		parsed = new URL(url)
	} catch {
		return 'Invalid URL'
	}
	const hostname = parsed.hostname

	// Resolve hostname to IP
	let addresses: string[]
	try {
		const results = await dns.lookup(hostname, { all: true })
		addresses = results.map((r) => r.address)
	} catch {
		// DNS resolution failed — block to be safe
		return 'Could not resolve hostname'
	}

	for (const addr of addresses) {
		if (isPrivateIp(addr)) {
			return 'Blocked: requests to private/internal IPs are not allowed'
		}
	}
	return null
}

// ─── Autopilot tool definitions ────────────────────────────────────────────

export interface AutopilotToolOptions {
	/** If set and non-empty, only requests to these hostnames are allowed. */
	httpAllowlist?: string[]
}

/**
 * Build the full set of autopilot tools available to agents.
 *
 * Includes: `send_message`, `create_task`, `update_task`, `add_blocker`,
 * `pin_to_board`, `unpin_from_board`, `create_artifact`, `skill_request`,
 * `search`, `update_knowledge`, `http_request`, `message_agent`,
 * `list_agents`, and `resolve_blocker`.
 */
export function createAutopilotTools(companyRoot: string, storage: StorageBackend, options?: AutopilotToolOptions): ToolDefinition[] {
	// biome-ignore lint: generic variance is intentional
	const tools: Array<ToolDefinition<any>> = [
		// Communication
		defineTool(
			'send_message',
			'Send a message to a channel',
			z.object({
				channel: z.string().describe('Channel ID to send to (e.g. "general", "dev", or a direct channel ID)'),
				content: z.string().describe('Message content'),
				references: z.array(z.string()).optional().describe('Referenced file paths or task IDs'),
			}),
			async (args, ctx) => {
				const isMember = await storage.isChannelMember(args.channel, ctx.agentId)
				if (!isMember) {
					return { content: [{ type: 'text' as const, text: `Access denied: not a member of channel #${args.channel}` }] }
				}

				await storage.sendMessage({
					id: `msg-${Date.now().toString(36)}`,
					from: ctx.agentId,
					channel: args.channel,
					at: new Date().toISOString(),
					content: args.content,
					mentions: [],
					references: args.references ?? [],
					reactions: [],
					thread: null,
					external: false,
				} as any)

				ctx.eventBus.emit({ type: 'message', channel: args.channel, from: ctx.agentId, content: args.content })
				// Real-time index
				const msgId = `msg-${Date.now().toString(36)}`
				getIndexer().then((idx) => idx?.indexOne('message', msgId, `#${args.channel}`, args.content)).catch(() => {})

				return { content: [{ type: 'text' as const, text: `Message sent to #${args.channel}` }] }
			},
		),

		// Task management
		defineTool(
			'create_task',
			'Create a new task',
			z.object({
				title: z.string(),
				description: z.string().optional(),
				type: z.enum(['intent', 'planning', 'implementation', 'review', 'deployment', 'marketing', 'monitoring', 'human_required']),
				priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
				assigned_to: z.string().optional(),
				project: z.string().optional(),
				depends_on: z.array(z.string()).optional(),
				workflow: z.string().optional(),
			}),
			async (args, ctx) => {
				const task = await storage.createTask({
					title: args.title,
					description: args.description ?? '',
					type: args.type,
					status: args.assigned_to ? 'assigned' : 'backlog',
					priority: args.priority ?? 'medium',
					created_by: ctx.agentId,
					assigned_to: args.assigned_to,
					project: args.project,
					depends_on: args.depends_on ?? [],
					workflow: args.workflow,
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
				} as any)
				ctx.eventBus.emit({ type: 'task_changed', taskId: task.id, status: task.status, assignedTo: task.assigned_to })
				// Real-time index
				getIndexer().then((idx) => idx?.indexOne('task', task.id, task.title, `${task.title} ${task.description ?? ''} ${task.status} ${task.type}`)).catch(() => {})
				return { content: [{ type: 'text' as const, text: `Created task ${task.id}: ${task.title}` }] }
			},
		),

		defineTool(
			'update_task',
			'Update an existing task',
			z.object({
				task_id: z.string(),
				status: z.enum(['draft', 'backlog', 'assigned', 'in_progress', 'review', 'blocked', 'done', 'cancelled']).optional(),
				note: z.string().optional(),
			}),
			async (args, ctx) => {
				// If note provided, append to task history
				if (args.note) {
					const task = await storage.readTask(args.task_id)
					const timestamp = new Date().toISOString()
					const history = [...(task?.history ?? []), {
						at: timestamp,
						by: ctx.agentId,
						action: 'note',
						note: args.note,
					}]
					await storage.updateTask(args.task_id, { history, updated_at: timestamp } as any, ctx.agentId)
				}

				// If status provided, update and move task
				if (args.status) {
					await storage.updateTask(args.task_id, { status: args.status } as any, ctx.agentId)
					await storage.moveTask(args.task_id, args.status, ctx.agentId)
				}

				// Emit event
				const updatedTask = await storage.readTask(args.task_id)
				ctx.eventBus.emit({ type: 'task_changed', taskId: args.task_id, status: updatedTask?.status ?? 'unknown', assignedTo: updatedTask?.assigned_to })

				return { content: [{ type: 'text' as const, text: `Updated task ${args.task_id}` }] }
			},
		),

		defineTool(
			'add_blocker',
			'Add a blocker to a task -- escalates to human',
			z.object({
				task_id: z.string(),
				reason: z.string(),
				assigned_to: z.string().describe('Who should resolve this (human ID)'),
			}),
			async (args, ctx) => {
				const task = await storage.readTask(args.task_id)
				if (!task) {
					return { content: [{ type: 'text' as const, text: `Task not found: ${args.task_id}` }], isError: true }
				}

				const blocker = {
					id: `blocker-${Date.now()}`,
					type: 'dependency' as const,
					reason: args.reason,
					assigned_to: args.assigned_to,
					resolved: false,
					created_at: new Date().toISOString(),
					created_by: ctx.agentId,
				}
				const blockers = [...(task.blockers ?? []), blocker]
				const timestamp = new Date().toISOString()

				await storage.updateTask(
					args.task_id,
					{
						blockers,
						updated_at: timestamp,
						history: [
							...(task.history ?? []),
							{
								at: timestamp,
								by: ctx.agentId,
								action: 'blocker_added',
								note: `Blocker: ${args.reason} (assigned to ${args.assigned_to})`,
							},
						],
					} as any,
					ctx.agentId,
				)
				await storage.moveTask(args.task_id, 'blocked', ctx.agentId)

				ctx.eventBus.emit({ type: 'task_changed', taskId: args.task_id, status: 'blocked', assignedTo: task.assigned_to })

				return { content: [{ type: 'text' as const, text: `Blocker added to ${args.task_id}: ${args.reason} (assigned to ${args.assigned_to})` }] }
			},
		),

		// Dashboard
		defineTool(
			'pin_to_board',
			'Pin an item to the dashboard for human visibility',
			z.object({
				group: z.string().describe('Dashboard group: "alerts", "overview", "agents", "recent"'),
				title: z.string(),
				content: z.string().optional(),
				type: z.enum(['info', 'warning', 'success', 'error', 'progress']),
				metadata: z.object({
					task_id: z.string().optional(),
					progress: z.number().min(0).max(100).optional(),
					expires_at: z.string().optional(),
					actions: z.array(z.object({ label: z.string(), action: z.string() })).optional(),
				}).optional(),
			}),
			async (args, ctx) => {
				const pinId = `pin-${Date.now().toString(36)}`
				await createPin(companyRoot, {
					id: pinId,
					group: args.group,
					title: args.title,
					content: args.content ?? '',
					type: args.type,
					created_by: ctx.agentId,
					created_at: new Date().toISOString(),
					metadata: args.metadata ?? {},
				})
				ctx.eventBus.emit({ type: 'pin_changed', pinId, action: 'created' })
				// Real-time index
				getIndexer().then((idx) => idx?.indexOne('pin', pinId, args.title, `${args.title} ${args.content ?? ''}`)).catch(() => {})
				return { content: [{ type: 'text' as const, text: `Pinned: ${args.title}` }] }
			},
		),

		defineTool(
			'unpin_from_board',
			'Remove a pin from the dashboard',
			z.object({
				pin_id: z.string(),
			}),
			async (args, ctx) => {
				await removePin(companyRoot, args.pin_id)
				ctx.eventBus.emit({ type: 'pin_changed', pinId: args.pin_id, action: 'removed' })
				return { content: [{ type: 'text' as const, text: `Unpinned: ${args.pin_id}` }] }
			},
		),

		// Artifacts
		defineTool(
			'create_artifact',
			'Create a previewable artifact (React app, HTML page, or static files)',
			z.object({
				name: z.string().describe('Artifact name (used as directory name)'),
				type: z.enum(['react', 'html', 'static']).describe('Artifact type'),
				files: z.record(z.string()).describe('File paths (relative) mapped to their content'),
			}),
			async (args, ctx) => {
				if (args.name.includes('..') || args.name.includes('/')) {
					return { content: [{ type: 'text' as const, text: 'Error: artifact name must not contain ".." or "/"' }], isError: true }
				}
				const artifactDir = join(companyRoot, 'artifacts', args.name)
				await Bun.write(join(artifactDir, '.gitkeep'), '')

				for (const [filePath, content] of Object.entries(args.files)) {
					const resolved = resolve(artifactDir, filePath)
					const rel = relative(artifactDir, resolved)
					if (rel.startsWith('..')) {
						return { content: [{ type: 'text' as const, text: `Error: file path "${filePath}" escapes artifact directory` }], isError: true }
					}
					const relToCompany = relative(companyRoot, resolved)
					if (isDeniedPath(relToCompany)) {
						return { content: [{ type: 'text' as const, text: `Error: access denied to path "${filePath}"` }], isError: true }
					}
					await Bun.write(resolved, content)
				}

				// Ensure React artifacts have a vite config that respects ARTIFACT_BASE
				if (args.type === 'react' && !args.files['vite.config.ts'] && !args.files['vite.config.js']) {
					await Bun.write(
						join(artifactDir, 'vite.config.ts'),
						[
							"import { defineConfig } from 'vite'",
							"import react from '@vitejs/plugin-react'",
							'',
							'export default defineConfig({',
							"  base: process.env.ARTIFACT_BASE || '/',",
							'  plugins: [react()],',
							'})',
							'',
						].join('\n'),
					)
				}

				let artifactConfig: Record<string, string>
				switch (args.type) {
					case 'react':
						artifactConfig = {
							name: args.name,
							serve: 'bunx vite --port {port}',
							build: 'bun install',
							health: '/',
							timeout: '5m',
						}
						break
					case 'html':
						artifactConfig = {
							name: args.name,
							serve: 'bunx serve -p {port}',
							health: '/',
							timeout: '5m',
						}
						break
					case 'static':
						artifactConfig = {
							name: args.name,
						}
						break
				}

				await Bun.write(
					join(artifactDir, '.artifact.yaml'),
					stringify(artifactConfig),
				)

				return {
					content: [
						{
							type: 'text' as const,
							text: `Created ${args.type} artifact "${args.name}" with ${Object.keys(args.files).length} files at /artifacts/${args.name}/`,
						},
					],
				}
			},
		),

		// Skills
		defineTool(
			'skill_request',
			'Load the full content of a skill/knowledge document by its ID',
			z.object({
				skill_id: z.string().describe('The skill ID from the Available Skills list'),
			}),
			async (args) => {
				try {
					const content = await loadSkillContent(companyRoot, args.skill_id)
					return { content: [{ type: 'text' as const, text: content }] }
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err)
					return { content: [{ type: 'text' as const, text: msg }], isError: true }
				}
			},
		),

		// Universal search across all entity types
		defineTool(
			'search',
			'Search across all entities (tasks, messages, knowledge, pins, agents, channels, skills). Returns ranked results.',
			z.object({
				query: z.string().describe('Search query'),
				type: z.enum(['task', 'message', 'knowledge', 'pin', 'agent', 'channel', 'skill']).optional().describe('Filter by entity type'),
				scope: z.string().optional().describe('Path prefix filter, e.g. "technical" for knowledge/technical/'),
				limit: z.number().optional().describe('Max results, default 10'),
			}),
			async (args) => {
				const maxResults = args.limit ?? 10
				try {
					const { createDb } = await import('../db')
					const { searchFts: fts } = await import('../db/search-index')
					const { db } = await createDb(companyRoot)
					const typeFilter = args.type as import('../db/search-index').EntityType | undefined
					let results = await fts(db, args.query, { type: typeFilter, limit: maxResults * 2 })

					// Apply scope filter (path prefix) for knowledge and other path-based entities
					if (args.scope) {
						results = results.filter((r) => r.entityId.startsWith(args.scope!))
					}

					results = results.slice(0, maxResults)

					if (results.length === 0) {
						return { content: [{ type: 'text' as const, text: 'No results found.' }] }
					}

					const text = results
						.map((r) => `- [${r.entityType}] **${r.entityId}** ${r.title ? `(${r.title})` : ''}: ${r.snippet}`)
						.join('\n')
					return { content: [{ type: 'text' as const, text }] }
				} catch {
					return { content: [{ type: 'text' as const, text: 'Search index not available.' }] }
				}
			},
		),

		defineTool(
			'update_knowledge',
			'Create or update a knowledge document',
			z.object({
				path: z.string().describe('Path relative to /knowledge/, e.g. "technical/api-design.md"'),
				content: z.string().describe('Markdown content'),
				reason: z.string().optional().describe('Why this knowledge is being added/updated'),
			}),
			async (args, ctx) => {
				const knowledgeDir = join(companyRoot, PATHS.KNOWLEDGE_DIR.replace(/^\/company/, ''))
				const filePath = resolve(knowledgeDir, args.path)
				const rel = relative(knowledgeDir, filePath)
				if (rel.startsWith('..')) {
					return { content: [{ type: 'text' as const, text: `Error: path "${args.path}" escapes knowledge directory` }], isError: true }
				}
				const relToCompany = relative(companyRoot, filePath)
				if (isDeniedPath(relToCompany)) {
					return { content: [{ type: 'text' as const, text: `Error: access denied to path "${args.path}"` }], isError: true }
				}
				const dirPath = join(filePath, '..')
				await mkdir(dirPath, { recursive: true })
				const existed = await Bun.file(filePath).exists()
				await Bun.write(filePath, args.content)

				ctx.eventBus.emit({ type: 'knowledge_changed', path: args.path, action: existed ? 'updated' : 'created' })
				// Real-time index
				const titleMatch = args.content.match(/^#\s+(.+)$/m)
				const knTitle = titleMatch?.[1]?.trim() ?? args.path.replace(/\.md$/, '')
				getIndexer().then((idx) => idx?.indexOne('knowledge', args.path, knTitle, args.content)).catch(() => {})

				await storage.appendActivity({
					at: new Date().toISOString(),
					agent: ctx.agentId,
					type: 'knowledge_update',
					summary: `Updated knowledge: ${args.path}`,
					details: { path: args.path, reason: args.reason },
				})

				return { content: [{ type: 'text' as const, text: `Knowledge updated: ${args.path}` }] }
			},
		),

		// HTTP
		defineTool(
			'http_request',
			'Make an HTTP request to an external API',
			z.object({
				method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
				url: z.string().describe('Full URL'),
				headers: z.record(z.string()).optional(),
				body: z.unknown().optional(),
				secret_ref: z.string().optional().describe('Secret name from /secrets/ for auth injection'),
			}),
			async (args, ctx) => {
				const headers: Record<string, string> = { ...args.headers }

				if (args.secret_ref) {
					const secretPath = join(
						companyRoot,
						PATHS.SECRETS_DIR.replace(/^\/company/, ''),
						`${args.secret_ref}.yaml`,
					)
					try {
						const secret = await readYamlUnsafe(secretPath) as {
							allowed_agents?: string[]
							api_key?: string
						}
						if (secret.allowed_agents && !secret.allowed_agents.includes(ctx.agentId)) {
							return {
								content: [{ type: 'text' as const, text: `Agent ${ctx.agentId} not allowed to use secret ${args.secret_ref}` }],
								isError: true,
							}
						}
						if (secret.api_key) {
							headers['Authorization'] = `Bearer ${secret.api_key}`
						}
					} catch (err) {
						const msg = err instanceof Error ? err.message : String(err)
						return {
							content: [{ type: 'text' as const, text: `Failed to load secret ${args.secret_ref}: ${msg}` }],
							isError: true,
						}
					}
				}

				try {
					// ── Allowlist check ──────────────────────────────────────────
					if (options?.httpAllowlist && options.httpAllowlist.length > 0) {
						let requestHostname: string
						try {
							requestHostname = new URL(args.url).hostname
						} catch {
							return {
								content: [{ type: 'text' as const, text: 'Blocked: invalid URL' }],
								isError: true,
							}
						}
						if (!options.httpAllowlist.includes(requestHostname)) {
							return {
								content: [{ type: 'text' as const, text: `Blocked: hostname "${requestHostname}" is not in the allowed list` }],
								isError: true,
							}
						}
					}

					// ── SSRF protection ──────────────────────────────────────────
					const ssrfError = await checkSsrf(args.url)
					if (ssrfError) {
						return {
							content: [{ type: 'text' as const, text: ssrfError }],
							isError: true,
						}
					}

					const fetchOptions: RequestInit = {
						method: args.method,
						headers,
					}
					if (args.body !== undefined && args.method !== 'GET') {
						fetchOptions.body = JSON.stringify(args.body)
						headers['Content-Type'] = headers['Content-Type'] ?? 'application/json'
					}
					const response = await fetch(args.url, fetchOptions)
					const responseText = await response.text()
					return {
						content: [{ type: 'text' as const, text: `HTTP ${response.status}\n${responseText}` }],
					}
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err)
					return {
						content: [{ type: 'text' as const, text: `HTTP request failed: ${msg}` }],
						isError: true,
					}
				}
			},
		),

		// Agent communication
		defineTool(
			'message_agent',
			'Send a direct message to another agent via a direct channel',
			z.object({
				to: z.string().describe('Agent ID to message'),
				content: z.string().describe('Message content'),
				reason: z.string().describe('Why you need to reach this agent'),
			}),
			async (args, ctx) => {
				const channel = await storage.getOrCreateDirectChannel(ctx.agentId, args.to)

				await storage.sendMessage({
					id: `msg-${Date.now().toString(36)}`,
					from: ctx.agentId,
					channel: channel.id,
					at: new Date().toISOString(),
					content: args.content,
					mentions: [args.to],
					references: [],
					reactions: [],
					thread: null,
					external: false,
				} as any)

				ctx.eventBus.emit({ type: 'message', channel: channel.id, from: ctx.agentId, content: args.content })

				await createPin(companyRoot, {
					type: 'info',
					title: `Message from ${ctx.agentId}`,
					content: args.content,
					group: 'agents',
					created_by: ctx.agentId,
					metadata: { agent_id: args.to, task_id: undefined },
				})

				return { content: [{ type: 'text' as const, text: `Direct message sent to ${args.to} in channel ${channel.id}` }] }
			},
		),

		// Agent discovery
		defineTool(
			'list_agents',
			'List all agents with their role, bio, status, current work, and capabilities.',
			z.object({}),
			async (_args, ctx) => {
				try {
					const agents = await loadAgents(ctx.companyRoot)

					// Get real statuses from stream manager
					let activeStreams: Array<{ sessionId: string; agentId: string }> = []
					try {
						const { streamManager } = container.resolve([streamManagerFactory])
						activeStreams = streamManager.getActiveStreams()
					} catch {
						// StreamManager may not be initialized
					}

					// Get in-progress tasks
					const inProgressTasks = await ctx.storage.listTasks({ status: 'in_progress' })

					const result = await Promise.all(agents.map(async (agent) => {
						const isWorking = activeStreams.some((s) => s.agentId === agent.id)
						const currentTask = inProgressTasks.find((t) => t.assigned_to === agent.id)

						// Try to load bio from memory
						let bio: string | null = null
						try {
							const memory = await loadAgentMemory(ctx.companyRoot, agent.id)
							bio = (memory as Record<string, unknown> | null)?.bio as string | null ?? null
						} catch {
							// No memory available
						}

						return [
							`**${agent.name}** (${agent.id}) — ${agent.role}`,
							bio ? `  Bio: ${bio}` : `  ${agent.description}`,
							`  Status: ${isWorking ? 'working' : 'idle'}`,
							currentTask ? `  Working on: ${currentTask.id} — ${currentTask.title}` : null,
							`  Tools: ${agent.tools?.join(', ') ?? 'default'}`,
						].filter(Boolean).join('\n')
					}))

					return { content: [{ type: 'text' as const, text: result.join('\n\n') }] }
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err)
					return { content: [{ type: 'text' as const, text: `Failed to list agents: ${msg}` }], isError: true }
				}
			},
		),

		// Blocker resolution
		defineTool(
			'resolve_blocker',
			'Mark a task blocker as resolved',
			z.object({
				task_id: z.string(),
				note: z.string().describe('How the blocker was resolved'),
			}),
			async (args, ctx) => {
				const task = await storage.readTask(args.task_id)
				if (!task) {
					return {
						content: [{ type: 'text' as const, text: `Task not found: ${args.task_id}` }],
						isError: true,
					}
				}

				const blockerIdx = task.blockers.findIndex((b) => !b.resolved)
				if (blockerIdx === -1) {
					return {
						content: [{ type: 'text' as const, text: `No unresolved blockers on task ${args.task_id}` }],
						isError: true,
					}
				}

				const updatedBlockers = [...task.blockers]
				updatedBlockers[blockerIdx] = {
					...updatedBlockers[blockerIdx]!,
					resolved: true,
					resolved_at: new Date().toISOString(),
					resolved_by: ctx.agentId,
					resolved_note: args.note,
				}

				const timestamp = new Date().toISOString()
				await storage.updateTask(
					args.task_id,
					{
						blockers: updatedBlockers,
						updated_at: timestamp,
						history: [
							...task.history,
							{
								at: timestamp,
								by: ctx.agentId,
								action: 'blocker_resolved',
								note: args.note,
							},
						],
					} as any,
					ctx.agentId,
				)

				// If task was blocked and all blockers now resolved, move back to active
				const allResolved = updatedBlockers.every((b) => b.resolved)
				let newStatus = task.status
				if (task.status === 'blocked' && allResolved) {
					await storage.moveTask(args.task_id, 'in_progress', ctx.agentId)
					newStatus = 'in_progress'
				}

				ctx.eventBus.emit({ type: 'task_changed', taskId: args.task_id, status: newStatus, assignedTo: task.assigned_to })

				return {
					content: [{ type: 'text' as const, text: `Blocker resolved on task ${args.task_id}: ${args.note}` }],
				}
			},
		),
	]

	return tools
}

/** Convert our tool definitions to Anthropic API tool format */
export function toolsToAnthropicFormat(tools: ToolDefinition[]): Array<{
	name: string
	description: string
	input_schema: Record<string, unknown>
}> {
	return tools.map((t) => {
		const jsonSchema = zodToJsonSchema(t.schema)
		return {
			name: t.name,
			description: t.description,
			input_schema: jsonSchema,
		}
	})
}

/** Find a tool by name and execute it */
export async function executeTool(
	tools: ToolDefinition[],
	toolName: string,
	args: unknown,
	context: ToolContext,
): Promise<ToolResult> {
	const tool = tools.find((t) => t.name === toolName)
	if (!tool) {
		return {
			content: [{ type: 'text', text: `Unknown tool: ${toolName}` }],
			isError: true,
		}
	}

	try {
		const parsed = tool.schema.parse(args)
		return await tool.execute(parsed, context)
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err)
		return {
			content: [{ type: 'text', text: `Tool error (${toolName}): ${msg}` }],
			isError: true,
		}
	}
}

/** Minimal zod-to-JSON-schema converter for our tool schemas */
function zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
	return zodTypeToJson(schema)
}

function zodTypeToJson(schema: z.ZodType): Record<string, unknown> {
	// Unwrap optionals and defaults
	if (schema instanceof z.ZodOptional) {
		return zodTypeToJson(schema.unwrap())
	}
	if (schema instanceof z.ZodDefault) {
		return zodTypeToJson(schema._def.innerType)
	}

	if (schema instanceof z.ZodString) {
		const result: Record<string, unknown> = { type: 'string' }
		if (schema.description) result.description = schema.description
		return result
	}

	if (schema instanceof z.ZodNumber) {
		const result: Record<string, unknown> = { type: 'number' }
		if (schema.description) result.description = schema.description
		return result
	}

	if (schema instanceof z.ZodEnum) {
		return { type: 'string', enum: schema.options }
	}

	if (schema instanceof z.ZodArray) {
		return {
			type: 'array',
			items: zodTypeToJson(schema.element),
		}
	}

	if (schema instanceof z.ZodObject) {
		const shape = schema.shape as Record<string, z.ZodType>
		const properties: Record<string, unknown> = {}
		const required: string[] = []

		for (const [key, value] of Object.entries(shape)) {
			properties[key] = zodTypeToJson(value)
			if (!(value instanceof z.ZodOptional) && !(value instanceof z.ZodDefault)) {
				required.push(key)
			}
		}

		const result: Record<string, unknown> = {
			type: 'object',
			properties,
		}
		if (required.length > 0) {
			result.required = required
		}
		return result
	}

	if (schema instanceof z.ZodRecord) {
		return {
			type: 'object',
			additionalProperties: zodTypeToJson(schema.valueSchema),
		}
	}

	// Fallback
	return { type: 'object' }
}
