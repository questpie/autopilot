import { z } from 'zod'
import { SESSION_STATUSES } from '../constants'

export const SessionMetaSchema = z.object({
	id: z.string(),
	agent: z.string(),
	trigger: z.object({
		type: z.string(),
		task_id: z.string().optional(),
		schedule_id: z.string().optional(),
		webhook_id: z.string().optional(),
	}),
	status: z.enum(SESSION_STATUSES),
	started_at: z.string().datetime(),
	ended_at: z.string().datetime().optional(),
	token_usage: z
		.object({
			input: z.number().int().default(0),
			output: z.number().int().default(0),
		})
		.default({}),
	cost_estimate: z.string().optional(),
	tool_calls: z.number().int().default(0),
	errors: z.number().int().default(0),
})

export const StreamChunkSchema = z.object({
	at: z.number(),
	type: z.enum(['thinking', 'text', 'tool_call', 'tool_result', 'error', 'status']),
	content: z.string().optional(),
	tool: z.string().optional(),
	params: z.record(z.unknown()).optional(),
})
