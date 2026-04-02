import { z } from 'zod'

/** Compact event types that workers POST to orchestrator. */
export const WorkerEventTypeSchema = z.enum([
	'started',
	'progress',
	'tool_use',
	'artifact',
	'message_sent',
	'task_updated',
	'approval_needed',
	'error',
	'completed',
])

/** Normalized event from worker -> orchestrator. */
export const WorkerEventSchema = z.object({
	type: WorkerEventTypeSchema,
	summary: z.string(),
	metadata: z.record(z.string(), z.unknown()).optional(),
})

/** Final completion report from worker. */
export const RunCompletionSchema = z.object({
	status: z.enum(['completed', 'failed']),
	summary: z.string().optional(),
	tokens: z
		.object({
			input: z.number().int().default(0),
			output: z.number().int().default(0),
		})
		.optional(),
	artifacts: z
		.array(
			z.object({
				path: z.string(),
				action: z.string(),
			}),
		)
		.optional(),
	error: z.string().optional(),
	/** Worker-local runtime session ID (e.g. Claude session_id). Enables same-worker resume. */
	runtime_session_ref: z.string().optional(),
	/** Whether this run can be continued on the same worker. */
	resumable: z.boolean().optional(),
})
