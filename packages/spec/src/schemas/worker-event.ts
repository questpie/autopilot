import { z } from 'zod'
import { RunArtifactSchema } from './artifact'

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
	'external_action',
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
	artifacts: z.array(RunArtifactSchema).optional(),
	error: z.string().optional(),
	/** Worker-local runtime session ID (e.g. Claude session_id). Enables same-worker resume. */
	runtime_session_ref: z.string().optional(),
	/** Whether this run can be continued on the same worker. */
	resumable: z.boolean().optional(),
	/** Structured output fields extracted from the agent's result block.
	 *  Used by the workflow engine for generic transition matching.
	 *  E.g. { outcome: 'approved', priority: 'high' }. If omitted, default next step is used. */
	outputs: z.record(z.string()).optional(),
})
