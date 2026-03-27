import { join } from 'path'
import dns from 'node:dns/promises'
import { mkdirSync, existsSync } from 'node:fs'
import { z } from 'zod'
import { PATHS } from '@questpie/autopilot-spec'
import type { StorageBackend } from '../fs/storage'
import { createPin, removePin } from '../fs/pins'
import { readYamlUnsafe } from '../fs/yaml'
import { loadCompany } from '../fs/company'
import type { EventBus } from '../events/event-bus'
import { container } from '../container'
import { indexerFactory } from '../db/indexer'
import type { Indexer } from '../db/indexer'

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
 * Includes: `task`, `message`, `pin`, `search`, `http`, `search_web`, `browse`.
 */
export function createAutopilotTools(companyRoot: string, storage: StorageBackend, options?: AutopilotToolOptions): ToolDefinition[] {
	// biome-ignore lint: generic variance is intentional
	const tools: Array<ToolDefinition<any>> = [
		// ─── TM-001: Unified task tool ─────────────────────────────────────
		defineTool(
			'task',
			'Manage tasks: create, update, approve, reject, block, or unblock.',
			z.object({
				action: z.enum(['create', 'update', 'approve', 'reject', 'block', 'unblock']),
				task_id: z.string().optional().describe('Required for update/approve/reject/block/unblock'),
				title: z.string().optional().describe('For create'),
				description: z.string().optional().describe('For create/update'),
				type: z.enum(['intent', 'planning', 'implementation', 'review', 'deployment', 'marketing', 'monitoring', 'human_required']).optional().describe('For create'),
				priority: z.enum(['critical', 'high', 'medium', 'low']).optional().describe('For create/update'),
				assigned_to: z.string().optional().describe('For create/update'),
				project: z.string().optional().describe('For create/update'),
				workflow: z.string().optional().describe('For create'),
				status: z.enum(['draft', 'backlog', 'assigned', 'in_progress', 'review', 'blocked', 'done', 'cancelled']).optional().describe('For update'),
				note: z.string().optional().describe('For update/block/unblock'),
				reason: z.string().optional().describe('For block/reject'),
				blocker_assigned_to: z.string().optional().describe('For block: who should resolve'),
			}),
			async (args, ctx) => {
				switch (args.action) {
					// ── create ──────────────────────────────────────────────
					case 'create': {
						if (!args.title) {
							return { content: [{ type: 'text' as const, text: 'Error: title is required for create' }], isError: true }
						}
						const task = await storage.createTask({
							title: args.title,
							description: args.description ?? '',
							type: args.type ?? 'implementation',
							status: args.assigned_to ? 'assigned' : 'backlog',
							priority: args.priority ?? 'medium',
							created_by: ctx.agentId,
							assigned_to: args.assigned_to,
							project: args.project,
							depends_on: [],
							workflow: args.workflow,
							created_at: new Date().toISOString(),
							updated_at: new Date().toISOString(),
						} as any)
						ctx.eventBus.emit({ type: 'task_changed', taskId: task.id, status: task.status, assignedTo: task.assigned_to })
						// Real-time index
						getIndexer().then((idx) => idx?.indexOne('task', task.id, task.title, `${task.title} ${task.description ?? ''} ${task.status} ${task.type}`)).catch(() => {})

						// Auto-create task channel
						const taskChannelId = `task-${task.id}`
						try {
							await storage.createChannel({
								id: taskChannelId,
								name: `Task ${task.id}`,
								type: 'group',
								description: task.title,
								created_by: ctx.agentId,
								created_at: new Date().toISOString(),
								updated_at: new Date().toISOString(),
								metadata: {},
							})
							await storage.addChannelMember(taskChannelId, ctx.agentId, 'agent', 'member')
							if (task.assigned_to) {
								await storage.addChannelMember(taskChannelId, task.assigned_to, 'agent', 'member')
							}
							ctx.eventBus.emit({ type: 'channel_created', channelId: taskChannelId, name: `Task ${task.id}` })
						} catch {
							// Channel may already exist — safe to ignore
						}

						return { content: [{ type: 'text' as const, text: `Created task ${task.id}: ${task.title}` }] }
					}

					// ── update ──────────────────────────────────────────────
					case 'update': {
						if (!args.task_id) {
							return { content: [{ type: 'text' as const, text: 'Error: task_id is required for update' }], isError: true }
						}
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

						// Update other fields if provided
						const updates: Record<string, unknown> = {}
						if (args.description !== undefined) updates.description = args.description
						if (args.priority !== undefined) updates.priority = args.priority
						if (args.assigned_to !== undefined) updates.assigned_to = args.assigned_to
						if (args.project !== undefined) updates.project = args.project
						if (Object.keys(updates).length > 0) {
							updates.updated_at = new Date().toISOString()
							await storage.updateTask(args.task_id, updates as any, ctx.agentId)
						}

						// Emit event
						const updatedTask = await storage.readTask(args.task_id)
						ctx.eventBus.emit({ type: 'task_changed', taskId: args.task_id, status: updatedTask?.status ?? 'unknown', assignedTo: updatedTask?.assigned_to })

						return { content: [{ type: 'text' as const, text: `Updated task ${args.task_id}` }] }
					}

					// ── approve ─────────────────────────────────────────────
					case 'approve': {
						if (!args.task_id) {
							return { content: [{ type: 'text' as const, text: 'Error: task_id is required for approve' }], isError: true }
						}
						const task = await storage.readTask(args.task_id)
						const timestamp = new Date().toISOString()
						await storage.updateTask(args.task_id, {
							status: 'done',
							updated_at: timestamp,
							history: [...(task?.history ?? []), {
								at: timestamp,
								by: ctx.agentId,
								action: 'approved',
								note: args.note ?? 'Approved',
							}],
						} as any, ctx.agentId)
						await storage.moveTask(args.task_id, 'done', ctx.agentId)
						ctx.eventBus.emit({ type: 'task_changed', taskId: args.task_id, status: 'done', assignedTo: task?.assigned_to })
						return { content: [{ type: 'text' as const, text: `Approved task ${args.task_id}` }] }
					}

					// ── reject ──────────────────────────────────────────────
					case 'reject': {
						if (!args.task_id) {
							return { content: [{ type: 'text' as const, text: 'Error: task_id is required for reject' }], isError: true }
						}
						const task = await storage.readTask(args.task_id)
						const timestamp = new Date().toISOString()
						await storage.updateTask(args.task_id, {
							status: 'blocked',
							updated_at: timestamp,
							history: [...(task?.history ?? []), {
								at: timestamp,
								by: ctx.agentId,
								action: 'rejected',
								note: args.reason ?? 'Rejected',
							}],
						} as any, ctx.agentId)
						await storage.moveTask(args.task_id, 'blocked', ctx.agentId)
						ctx.eventBus.emit({ type: 'task_changed', taskId: args.task_id, status: 'blocked', assignedTo: task?.assigned_to })
						return { content: [{ type: 'text' as const, text: `Rejected task ${args.task_id}: ${args.reason ?? 'no reason'}` }] }
					}

					// ── block ───────────────────────────────────────────────
					case 'block': {
						if (!args.task_id) {
							return { content: [{ type: 'text' as const, text: 'Error: task_id is required for block' }], isError: true }
						}
						const task = await storage.readTask(args.task_id)
						if (!task) {
							return { content: [{ type: 'text' as const, text: `Task not found: ${args.task_id}` }], isError: true }
						}

						const blocker = {
							id: `blocker-${Date.now()}`,
							type: 'dependency' as const,
							reason: args.reason ?? 'Blocked',
							assigned_to: args.blocker_assigned_to ?? '',
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
										note: `Blocker: ${args.reason} (assigned to ${args.blocker_assigned_to ?? 'unassigned'})`,
									},
								],
							} as any,
							ctx.agentId,
						)
						await storage.moveTask(args.task_id, 'blocked', ctx.agentId)

						ctx.eventBus.emit({ type: 'task_changed', taskId: args.task_id, status: 'blocked', assignedTo: task.assigned_to })

						return { content: [{ type: 'text' as const, text: `Blocker added to ${args.task_id}: ${args.reason} (assigned to ${args.blocker_assigned_to ?? 'unassigned'})` }] }
					}

					// ── unblock ─────────────────────────────────────────────
					case 'unblock': {
						if (!args.task_id) {
							return { content: [{ type: 'text' as const, text: 'Error: task_id is required for unblock' }], isError: true }
						}
						const task = await storage.readTask(args.task_id)
						if (!task) {
							return { content: [{ type: 'text' as const, text: `Task not found: ${args.task_id}` }], isError: true }
						}

						const blockerIdx = task.blockers.findIndex((b) => !b.resolved)
						if (blockerIdx === -1) {
							return { content: [{ type: 'text' as const, text: `No unresolved blockers on task ${args.task_id}` }], isError: true }
						}

						const updatedBlockers = [...task.blockers]
						updatedBlockers[blockerIdx] = {
							...updatedBlockers[blockerIdx]!,
							resolved: true,
							resolved_at: new Date().toISOString(),
							resolved_by: ctx.agentId,
							resolved_note: args.note ?? '',
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
										note: args.note ?? 'Resolved',
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

						return { content: [{ type: 'text' as const, text: `Blocker resolved on task ${args.task_id}: ${args.note ?? 'Resolved'}` }] }
					}
				}
			},
		),

		// ─── TM-002: Unified message tool ──────────────────────────────────
		defineTool(
			'message',
			'Send a message. Channel conventions: "dm-{agentId}" for DMs, "task-{id}" for task threads, "project-{name}" for project channels, or any existing channel name.',
			z.object({
				channel: z.string().describe('Channel: "general", "task-052", "project-studio", "dm-max"'),
				content: z.string(),
				references: z.array(z.string()).optional().describe('Referenced file paths or task IDs'),
			}),
			async (args, ctx) => {
				const isDmChannel = args.channel.startsWith('dm-')
				const isTaskOrProjectChannel = args.channel.startsWith('task-') || args.channel.startsWith('project-')

				// dm-{agentId} → auto-create DM channel
				if (isDmChannel) {
					const targetAgentId = args.channel.slice(3) // strip "dm-"
					const channel = await storage.getOrCreateDirectChannel(ctx.agentId, targetAgentId)

					await storage.sendMessage({
						id: `msg-${Date.now().toString(36)}`,
						from: ctx.agentId,
						channel: channel.id,
						at: new Date().toISOString(),
						content: args.content,
						mentions: [targetAgentId],
						references: args.references ?? [],
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
						metadata: { agent_id: targetAgentId, task_id: undefined },
					})

					return { content: [{ type: 'text' as const, text: `Direct message sent to ${targetAgentId} in channel ${channel.id}` }] }
				}

				// Auto-create task/project channels on first message
				const existingChannel = await storage.readChannel(args.channel)
				if (!existingChannel) {
					if (isTaskOrProjectChannel) {
						const taskMatch = args.channel.match(/^task-(.+)$/)
						const projectMatch = args.channel.match(/^project-(.+)$/)
						const name = taskMatch
							? `Task ${taskMatch[1]}`
							: `Project ${projectMatch![1]}`

						await storage.createChannel({
							id: args.channel,
							name,
							type: 'group',
							description: taskMatch
								? `Discussion thread for task ${taskMatch[1]}`
								: `Discussion channel for project ${projectMatch![1]}`,
							created_by: ctx.agentId,
							created_at: new Date().toISOString(),
							updated_at: new Date().toISOString(),
							metadata: {},
						})

						await storage.addChannelMember(args.channel, ctx.agentId, 'agent', 'member')
						ctx.eventBus.emit({ type: 'channel_created', channelId: args.channel, name })
					} else {
						return { content: [{ type: 'text' as const, text: `Channel "${args.channel}" not found.` }] }
					}
				}

				// Auto-join task/project channels
				const isMember = await storage.isChannelMember(args.channel, ctx.agentId)
				if (!isMember) {
					if (isTaskOrProjectChannel) {
						await storage.addChannelMember(args.channel, ctx.agentId, 'agent', 'member')
					} else {
						return { content: [{ type: 'text' as const, text: `Not a member of channel "${args.channel}".` }] }
					}
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

		// ─── TM-003: Unified pin tool ──────────────────────────────────────
		defineTool(
			'pin',
			'Pin or unpin items on the dashboard. Use action "create" to pin, "remove" to unpin.',
			z.object({
				action: z.enum(['create', 'remove']),
				pin_id: z.string().optional().describe('Required for remove'),
				group: z.string().optional().describe('For create: "alerts", "overview", "agents", "recent"'),
				title: z.string().optional().describe('For create'),
				content: z.string().optional().describe('For create'),
				type: z.enum(['info', 'warning', 'success', 'error', 'progress']).optional().describe('For create'),
				metadata: z.record(z.unknown()).optional().describe('For create'),
			}),
			async (args, ctx) => {
				if (args.action === 'create') {
					if (!args.title || !args.type) {
						return { content: [{ type: 'text' as const, text: 'Error: title and type are required for pin create' }], isError: true }
					}
					const pinId = `pin-${Date.now().toString(36)}`
					await createPin(companyRoot, {
						id: pinId,
						group: args.group ?? 'recent',
						title: args.title,
						content: args.content ?? '',
						type: args.type,
						created_by: ctx.agentId,
						created_at: new Date().toISOString(),
						metadata: args.metadata ?? {},
					})
					ctx.eventBus.emit({ type: 'pin_changed', pinId, action: 'created' })
					// Real-time index
					getIndexer().then((idx) => idx?.indexOne('pin', pinId, args.title!, `${args.title} ${args.content ?? ''}`)).catch(() => {})
					return { content: [{ type: 'text' as const, text: `Pinned: ${args.title}` }] }
				}

				// remove
				if (!args.pin_id) {
					return { content: [{ type: 'text' as const, text: 'Error: pin_id is required for remove' }], isError: true }
				}
				await removePin(companyRoot, args.pin_id)
				ctx.eventBus.emit({ type: 'pin_changed', pinId: args.pin_id, action: 'removed' })
				return { content: [{ type: 'text' as const, text: `Unpinned: ${args.pin_id}` }] }
			},
		),

		// ─── Universal search (unchanged) ──────────────────────────────────
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

		// ─── TM-004: http ──────────────────────────────────────────────────
		defineTool(
			'http',
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

		// ─── WT-001: search_web tool ───────────────────────────────────────
		defineTool(
			'search_web',
			'Search the web using a search API. Returns titles, URLs, and snippets.',
			z.object({
				query: z.string().describe('Search query'),
				max_results: z.number().optional().describe('Max results to return, default 5'),
			}),
			async (args, ctx) => {
				const maxResults = args.max_results ?? 5

				// Load search API key from secrets/search-api.yaml
				const secretPath = join(
					companyRoot,
					PATHS.SECRETS_DIR.replace(/^\/company/, ''),
					'search-api.yaml',
				)
				let apiKey: string | undefined
				let allowedAgents: string[] | undefined
				try {
					const secret = (await readYamlUnsafe(secretPath)) as {
						api_key?: string
						allowed_agents?: string[]
					}
					apiKey = secret.api_key
					allowedAgents = secret.allowed_agents
				} catch {
					return {
						content: [{ type: 'text' as const, text: 'Web search not configured. Add search API key in secrets/search-api.yaml.' }],
						isError: true,
					}
				}

				if (!apiKey) {
					return {
						content: [{ type: 'text' as const, text: 'Web search not configured. Add search API key in secrets/search-api.yaml.' }],
						isError: true,
					}
				}

				// Check agent access
				if (allowedAgents && allowedAgents.length > 0 && !allowedAgents.includes(ctx.agentId)) {
					return {
						content: [{ type: 'text' as const, text: `Agent ${ctx.agentId} not allowed to use search_web.` }],
						isError: true,
					}
				}

				// Determine search provider from company.yaml settings
				let searchProvider = 'brave'
				try {
					const company = await loadCompany(companyRoot)
					const settings = company.settings as Record<string, unknown>
					if (settings.search_provider && typeof settings.search_provider === 'string') {
						searchProvider = settings.search_provider
					}
				} catch {
					// Use default provider
				}

				try {
					let results: Array<{ title: string; url: string; snippet: string }> = []

					switch (searchProvider) {
						case 'tavily': {
							const resp = await fetch('https://api.tavily.com/search', {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({
									api_key: apiKey,
									query: args.query,
									max_results: maxResults,
								}),
							})
							if (!resp.ok) {
								return { content: [{ type: 'text' as const, text: `Tavily search failed: HTTP ${resp.status}` }], isError: true }
							}
							const data = (await resp.json()) as { results?: Array<{ title: string; url: string; content: string }> }
							results = (data.results ?? []).slice(0, maxResults).map((r) => ({
								title: r.title,
								url: r.url,
								snippet: r.content,
							}))
							break
						}

						case 'serpapi': {
							const params = new URLSearchParams({
								api_key: apiKey,
								q: args.query,
								num: String(maxResults),
							})
							const resp = await fetch(`https://serpapi.com/search.json?${params}`)
							if (!resp.ok) {
								return { content: [{ type: 'text' as const, text: `SerpAPI search failed: HTTP ${resp.status}` }], isError: true }
							}
							const data = (await resp.json()) as { organic_results?: Array<{ title: string; link: string; snippet: string }> }
							results = (data.organic_results ?? []).slice(0, maxResults).map((r) => ({
								title: r.title,
								url: r.link,
								snippet: r.snippet,
							}))
							break
						}

						case 'brave':
						default: {
							const params = new URLSearchParams({
								q: args.query,
								count: String(maxResults),
							})
							const resp = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
								headers: {
									'Accept': 'application/json',
									'Accept-Encoding': 'gzip',
									'X-Subscription-Token': apiKey,
								},
							})
							if (!resp.ok) {
								return { content: [{ type: 'text' as const, text: `Brave search failed: HTTP ${resp.status}` }], isError: true }
							}
							const data = (await resp.json()) as { web?: { results?: Array<{ title: string; url: string; description: string }> } }
							results = (data.web?.results ?? []).slice(0, maxResults).map((r) => ({
								title: r.title,
								url: r.url,
								snippet: r.description,
							}))
							break
						}
					}

					if (results.length === 0) {
						return { content: [{ type: 'text' as const, text: 'No search results found.' }] }
					}

					// SSRF check on result URLs
					const safeResults: typeof results = []
					for (const r of results) {
						const ssrfError = await checkSsrf(r.url)
						if (!ssrfError) {
							safeResults.push(r)
						}
					}

					if (safeResults.length === 0) {
						return { content: [{ type: 'text' as const, text: 'All search results were filtered by SSRF protection.' }] }
					}

					const markdown = safeResults
						.map((r, i) => `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.snippet}`)
						.join('\n\n')

					return { content: [{ type: 'text' as const, text: markdown }] }
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err)
					return { content: [{ type: 'text' as const, text: `Web search failed: ${msg}` }], isError: true }
				}
			},
		),

		// ─── WT-002: browse tool ───────────────────────────────────────────
		defineTool(
			'browse',
			'Browse a web page. Returns page content as text, optionally takes a screenshot.',
			z.object({
				url: z.string().describe('URL to browse'),
				extract: z.string().optional().describe('What to look for on the page, e.g. "pricing tiers"'),
				screenshot: z.boolean().optional().describe('Save a screenshot (default false)'),
			}),
			async (args, ctx) => {
				// SSRF protection
				const ssrfError = await checkSsrf(args.url)
				if (ssrfError) {
					return { content: [{ type: 'text' as const, text: ssrfError }], isError: true }
				}

				// Try agent-browser CLI first, fall back to simple fetch
				let pageContent = ''
				let screenshotPath: string | undefined

				try {
					// Check if agent-browser binary is available
					const which = Bun.spawnSync(['which', 'agent-browser'])
					const hasBinary = which.exitCode === 0

					// Also check local node_modules bin
					const localBin = join(companyRoot, 'node_modules', '.bin', 'agent-browser')
					const hasLocalBin = existsSync(localBin)

					const browserCmd = hasBinary ? 'agent-browser' : hasLocalBin ? localBin : null

					if (browserCmd) {
						// Use agent-browser CLI for full JS rendering
						// Open URL, wait for load, take snapshot
						const openProc = Bun.spawnSync([browserCmd, 'open', args.url], {
							timeout: 15_000,
							stderr: 'pipe',
						})
						if (openProc.exitCode !== 0) {
							throw new Error(`agent-browser open failed: ${openProc.stderr.toString()}`)
						}

						// Wait for network idle
						Bun.spawnSync([browserCmd, 'wait', '--load', 'networkidle'], {
							timeout: 20_000,
							stderr: 'pipe',
						})

						// Take snapshot
						const snapshotProc = Bun.spawnSync([browserCmd, 'snapshot', '--compact'], {
							timeout: 10_000,
							stdout: 'pipe',
							stderr: 'pipe',
						})
						pageContent = snapshotProc.stdout.toString()

						// Screenshot if requested
						if (args.screenshot) {
							const screenshotsDir = join(companyRoot, 'uploads', 'screenshots')
							if (!existsSync(screenshotsDir)) {
								mkdirSync(screenshotsDir, { recursive: true })
							}
							const timestamp = Date.now()
							screenshotPath = join(screenshotsDir, `${timestamp}.png`)
							Bun.spawnSync([browserCmd, 'screenshot', screenshotPath], {
								timeout: 10_000,
								stderr: 'pipe',
							})
						}
					} else {
						// Fallback: simple fetch (no JS rendering)
						const controller = new AbortController()
						const timeoutId = setTimeout(() => controller.abort(), 30_000)
						try {
							const resp = await fetch(args.url, {
								signal: controller.signal,
								headers: {
									'User-Agent': 'QuestPie-Autopilot/1.0 (+https://autopilot.questpie.com)',
									'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
								},
							})
							const html = await resp.text()
							// Strip HTML tags for a basic text extraction
							pageContent = html
								.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
								.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
								.replace(/<[^>]+>/g, ' ')
								.replace(/\s+/g, ' ')
								.trim()
						} finally {
							clearTimeout(timeoutId)
						}

						if (args.screenshot) {
							screenshotPath = undefined // Not available without agent-browser
							pageContent += '\n\n[Note: screenshot requires agent-browser binary. Install with: bun add agent-browser]'
						}
					}
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err)
					// Fall back to simple fetch on any agent-browser error
					try {
						const controller = new AbortController()
						const timeoutId = setTimeout(() => controller.abort(), 30_000)
						try {
							const resp = await fetch(args.url, {
								signal: controller.signal,
								headers: {
									'User-Agent': 'QuestPie-Autopilot/1.0 (+https://autopilot.questpie.com)',
									'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
								},
							})
							const html = await resp.text()
							pageContent = html
								.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
								.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
								.replace(/<[^>]+>/g, ' ')
								.replace(/\s+/g, ' ')
								.trim()
						} finally {
							clearTimeout(timeoutId)
						}
					} catch (fetchErr) {
						const fetchMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
						return { content: [{ type: 'text' as const, text: `Browse failed: ${msg}. Fetch fallback also failed: ${fetchMsg}` }], isError: true }
					}
				}

				// Truncate very long pages
				const maxLen = 50_000
				if (pageContent.length > maxLen) {
					pageContent = `${pageContent.slice(0, maxLen)}\n\n[... truncated, ${pageContent.length} chars total ...]`
				}

				// Build response
				const parts: string[] = []
				parts.push(`## Page: ${args.url}\n`)

				if (args.extract) {
					parts.push(`*Extraction hint: "${args.extract}"*\n`)
				}

				parts.push(pageContent)

				if (screenshotPath) {
					parts.push(`\n**Screenshot saved:** ${screenshotPath}`)
				}

				return { content: [{ type: 'text' as const, text: parts.join('\n') }] }
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
