import { mkdir, readdir } from 'node:fs/promises'
import { join } from 'path'
import { stringify } from 'yaml'
import { z } from 'zod'
import { PATHS } from '@questpie/autopilot-spec'
import { createTask, readTask, findTask, updateTask, moveTask } from '../fs/tasks'
import { sendChannelMessage, sendDirectMessage } from '../fs/messages'
import { createPin, removePin } from '../fs/pins'
import { appendActivity } from '../fs/activity'
import { readYamlUnsafe, writeYaml } from '../fs/yaml'
import { loadSkillContent } from '../skills'

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

// ─── Autopilot tool definitions ────────────────────────────────────────────

/**
 * Build the full set of autopilot tools available to agents.
 *
 * Includes: `send_message`, `create_task`, `update_task`, `add_blocker`,
 * `pin_to_board`, `unpin_from_board`, `create_artifact`, `skill_request`,
 * `search_knowledge`, `update_knowledge`, `http_request`, `ask_agent`,
 * and `resolve_blocker`.
 */
export function createAutopilotTools(companyRoot: string): ToolDefinition[] {
	// biome-ignore lint: generic variance is intentional
	const tools: Array<ToolDefinition<any>> = [
		// Communication
		defineTool(
			'send_message',
			'Send a message to a channel or another agent',
			z.object({
				to: z.string().describe('Target: "channel:dev", "agent:marek", "human:dominik"'),
				content: z.string().describe('Message content'),
				priority: z.enum(['urgent', 'high', 'normal', 'low']).optional().describe('Message priority'),
				references: z.array(z.string()).optional().describe('Referenced file paths or task IDs'),
			}),
			async (args, ctx) => {
				const [type, target] = args.to.split(':')
				const msgData = {
					id: `msg-${Date.now().toString(36)}`,
					from: ctx.agentId,
					at: new Date().toISOString(),
					content: args.content,
					mentions: [],
					references: args.references ?? [],
					reactions: [],
					thread: null,
					external: false,
				}
				if (type === 'channel') {
					await sendChannelMessage(companyRoot, target!, msgData)
				} else {
					await sendDirectMessage(companyRoot, ctx.agentId, target!, msgData)
				}
				return { content: [{ type: 'text' as const, text: `Message sent to ${args.to}` }] }
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
				const task = await createTask(companyRoot, {
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
				})
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
				const updates: Record<string, unknown> = {}
				if (args.status) updates.status = args.status
				await updateTask(companyRoot, args.task_id, updates, ctx.agentId)
				if (args.status) {
					await moveTask(companyRoot, args.task_id, args.status, ctx.agentId)
				}
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
				await updateTask(
					companyRoot,
					args.task_id,
					{
						status: 'blocked',
					},
					ctx.agentId,
				)
				await moveTask(companyRoot, args.task_id, 'blocked', ctx.agentId)
				return { content: [{ type: 'text' as const, text: `Task ${args.task_id} blocked: ${args.reason}` }] }
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
				await createPin(companyRoot, {
					id: `pin-${Date.now().toString(36)}`,
					group: args.group,
					title: args.title,
					content: args.content ?? '',
					type: args.type,
					created_by: ctx.agentId,
					created_at: new Date().toISOString(),
					metadata: args.metadata ?? {},
				})
				return { content: [{ type: 'text' as const, text: `Pinned: ${args.title}` }] }
			},
		),

		defineTool(
			'unpin_from_board',
			'Remove a pin from the dashboard',
			z.object({
				pin_id: z.string(),
			}),
			async (args) => {
				await removePin(companyRoot, args.pin_id)
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
				const artifactDir = join(companyRoot, 'artifacts', args.name)
				await Bun.write(join(artifactDir, '.gitkeep'), '')

				for (const [filePath, content] of Object.entries(args.files)) {
					await Bun.write(join(artifactDir, filePath), content)
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

		// Knowledge
		defineTool(
			'search_knowledge',
			'Search the company knowledge base',
			z.object({
				query: z.string().describe('Search query'),
				scope: z.string().optional().describe('Limit to path like "technical" or "brand"'),
				max_results: z.number().optional().describe('Max results, default 10'),
			}),
			async (args) => {
				const knowledgeDir = join(companyRoot, PATHS.KNOWLEDGE_DIR.replace(/^\/company/, ''))
				const searchDir = args.scope ? join(knowledgeDir, args.scope) : knowledgeDir
				const maxResults = args.max_results ?? 10
				const results: Array<{ path: string; snippet: string }> = []

				async function searchRecursive(dir: string): Promise<void> {
					let entries: import('node:fs').Dirent[]
					try {
						entries = await readdir(dir, { withFileTypes: true })
					} catch {
						return
					}
					for (const entry of entries) {
						if (results.length >= maxResults) return
						const fullPath = join(dir, entry.name)
						if (entry.isDirectory()) {
							await searchRecursive(fullPath)
						} else if (entry.name.endsWith('.md')) {
							try {
								const content = await Bun.file(fullPath).text()
								const queryLower = args.query.toLowerCase()
								const lines = content.split('\n')
								for (const line of lines) {
									if (line.toLowerCase().includes(queryLower)) {
										const relPath = fullPath.slice(knowledgeDir.length + 1)
										results.push({ path: relPath, snippet: line.trim() })
										break
									}
								}
							} catch {
								// skip unreadable files
							}
						}
					}
				}

				await searchRecursive(searchDir)

				if (results.length === 0) {
					return { content: [{ type: 'text' as const, text: 'No results found.' }] }
				}

				const text = results.map((r) => `- ${r.path}: ${r.snippet}`).join('\n')
				return { content: [{ type: 'text' as const, text }] }
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
				const filePath = join(knowledgeDir, args.path)
				const dirPath = join(filePath, '..')
				await mkdir(dirPath, { recursive: true })
				await Bun.write(filePath, args.content)

				await appendActivity(companyRoot, {
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
			'ask_agent',
			'Ask another agent a question (they decide whether to answer)',
			z.object({
				to: z.string().describe('Agent ID to ask'),
				question: z.string(),
				reason: z.string().describe('Why you need this information'),
				urgency: z.enum(['low', 'normal', 'high']).optional(),
			}),
			async (args, ctx) => {
				const msgId = `msg-${Date.now().toString(36)}`
				const content = `**Question from ${ctx.agentId}:**\n${args.question}\n\n**Reason:** ${args.reason}`
				await sendDirectMessage(companyRoot, ctx.agentId, args.to, {
					id: msgId,
					content,
					references: [],
				})

				await createPin(companyRoot, {
					id: `pin-${Date.now().toString(36)}`,
					group: 'agents',
					title: `Agent Request: ${ctx.agentId} → ${args.to}`,
					content: args.question,
					type: 'info',
					created_by: ctx.agentId,
					created_at: new Date().toISOString(),
					metadata: {},
				})

				return {
					content: [{ type: 'text' as const, text: `Question sent to ${args.to}. They will respond when available.` }],
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
				const task = await readTask(companyRoot, args.task_id)
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

				// Write blockers directly via yaml since updateTask doesn't support blockers field
				const found = await findTask(companyRoot, args.task_id)
				if (found) {
					const timestamp = new Date().toISOString()
					const patched = {
						...task,
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
					}
					await writeYaml(found.path, patched)
				}

				// If task was blocked and all blockers now resolved, move back to active
				const allResolved = updatedBlockers.every((b) => b.resolved)
				if (task.status === 'blocked' && allResolved) {
					await moveTask(companyRoot, args.task_id, 'in_progress', ctx.agentId)
				}

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
