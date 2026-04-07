import { z } from 'zod'

export const SessionModeSchema = z.enum(['query', 'task_thread'])

export const SessionStatusSchema = z.enum(['active', 'closed'])

/** Orchestrator-owned session record — lightweight conversation-mode tracking. */
export const SessionRowSchema = z.object({
	id: z.string(),
	provider_id: z.string(),
	external_conversation_id: z.string(),
	external_thread_id: z.string().nullable(),
	mode: SessionModeSchema,
	task_id: z.string().nullable(),
	last_query_id: z.string().nullable(),
	status: SessionStatusSchema,
	created_at: z.string(),
	updated_at: z.string(),
	metadata: z.string(),
})
