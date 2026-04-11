import { z } from 'zod'

/**
 * Backend session mode.
 * - `query`: stateless question/answer — no durable task binding.
 * - `task_thread`: session bound to a task (includes discussion-style conversations,
 *   which the UI may present as a distinct "discussion" type).
 */
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
	status: SessionStatusSchema,
	created_at: z.string(),
	updated_at: z.string(),
	metadata: z.string(),
	runtime_session_ref: z.string().nullable(),
	preferred_worker_id: z.string().nullable(),
})

export const SessionMessageRoleSchema = z.enum(['user', 'assistant', 'system'])

/** Session message record — durable conversation/system message log. */
export const SessionMessageRowSchema = z.object({
	id: z.string(),
	session_id: z.string(),
	role: SessionMessageRoleSchema,
	content: z.string(),
	query_id: z.string().nullable(),
	external_message_id: z.string().nullable(),
	metadata: z.string(),
	created_at: z.string(),
})
