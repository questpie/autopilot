import { z } from 'zod'
import { createTask, updateTask, moveTask } from '../fs/tasks'
import { sendChannelMessage, sendDirectMessage } from '../fs/messages'
import { createPin, removePin } from '../fs/pins'
import { appendActivity } from '../fs/activity'

// -- Tool definition types --

export interface ToolDefinition<T extends z.ZodType = z.ZodType> {
	name: string
	description: string
	schema: T
	execute: (args: z.output<T>, context: ToolContext) => Promise<ToolResult>
}

export interface ToolContext {
	companyRoot: string
	agentId: string
}

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

// -- Autopilot tool definitions --

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
