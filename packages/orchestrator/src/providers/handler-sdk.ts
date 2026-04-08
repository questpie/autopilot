/**
 * Handler SDK — lightweight helper for writing provider handlers.
 *
 * Reads stdin JSON envelope, routes to the matching op handler, writes result to stdout.
 * Handlers import this module and call defineHandler() with their op implementations.
 *
 * Usage:
 *   import { defineHandler, ok, fail, taskCreate, noop } from './handler-sdk'
 *
 *   defineHandler({
 *     'notify.send': async (envelope) => {
 *       // ... send notification
 *       return ok({ external_id: '123' })
 *     },
 *     'conversation.ingest': async (envelope) => {
 *       return taskCreate({ title: 'Bug report', type: 'bug' })
 *     },
 *   })
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface HandlerEnvelope {
	op: string
	provider_id: string
	provider_kind: 'notification_channel' | 'intent_channel' | 'conversation_channel'
	config: Record<string, unknown>
	secrets: Record<string, string>
	payload: Record<string, unknown>
}

export interface HandlerResult {
	ok: boolean
	external_id?: string
	metadata?: Record<string, unknown>
	error?: string
}

export type HandlerFn = (envelope: HandlerEnvelope) => Promise<HandlerResult>

// ─── Result helpers ──────────────────────────────────────────────────────────

export function ok(data?: Partial<HandlerResult>): HandlerResult {
	return { ok: true, ...data }
}

export function fail(error: string): HandlerResult {
	return { ok: false, error }
}

export interface TaskCreateInput {
	title: string
	type: string
	description?: string
	priority?: string
	assigned_to?: string
	workflow_id?: string
	metadata?: Record<string, unknown>
	[key: string]: unknown
}

export function taskCreate(input: TaskCreateInput): HandlerResult {
	return { ok: true, metadata: { action: 'task.create', input } }
}

// ─── Conversation-aware helpers ─────────────────────────────────────────

export interface QueryMessageInput {
	conversation_id: string
	thread_id?: string
	message: string
	sender_id?: string
	sender_name?: string
}

export function queryMessage(input: QueryMessageInput): HandlerResult {
	return { ok: true, metadata: { action: 'query.message', ...input } }
}

export interface ConversationActionInput {
	conversation_id: string
	thread_id?: string
}

export function conversationApprove(input: ConversationActionInput): HandlerResult {
	return { ok: true, metadata: { action: 'task.approve', ...input } }
}

export function conversationReject(input: ConversationActionInput & { message?: string }): HandlerResult {
	return { ok: true, metadata: { action: 'task.reject', ...input } }
}

export function conversationReply(input: ConversationActionInput & { message: string }): HandlerResult {
	return { ok: true, metadata: { action: 'task.reply', ...input } }
}

export interface ConversationTaskCreateInput {
	conversation_id: string
	thread_id?: string
	input: {
		title: string
		description?: string
		type?: string
		priority?: string
		assigned_to?: string
		workflow_id?: string
		metadata?: Record<string, unknown>
		[key: string]: unknown
	}
}

export function conversationTaskCreate(input: ConversationTaskCreateInput): HandlerResult {
	return {
		ok: true,
		metadata: {
			action: 'task.create',
			conversation_id: input.conversation_id,
			thread_id: input.thread_id,
			input: input.input,
		},
	}
}

export interface ConversationCommandInput {
	conversation_id: string
	thread_id?: string
	command: string
	args: string
	sender_id?: string
	sender_name?: string
}

export function conversationCommand(input: ConversationCommandInput): HandlerResult {
	return { ok: true, metadata: { action: 'conversation.command', ...input } }
}

export function noop(reason?: string): HandlerResult {
	return { ok: true, metadata: { action: 'noop', reason } }
}

// ─── Main entry point ────────────────────────────────────────────────────────

export function defineHandler(handlers: Record<string, HandlerFn>): void {
	// Read stdin, parse envelope, route to handler, write result to stdout
	const run = async () => {
		let input: string
		try {
			input = await Bun.stdin.text()
		} catch (err) {
			const result: HandlerResult = { ok: false, error: `Failed to read stdin: ${err instanceof Error ? err.message : String(err)}` }
			process.stdout.write(JSON.stringify(result))
			process.exit(0)
			return
		}

		let envelope: HandlerEnvelope
		try {
			envelope = JSON.parse(input)
		} catch (err) {
			const result: HandlerResult = { ok: false, error: `Invalid JSON on stdin: ${err instanceof Error ? err.message : String(err)}` }
			process.stdout.write(JSON.stringify(result))
			process.exit(0)
			return
		}

		const handler = handlers[envelope.op]
		if (!handler) {
			const result: HandlerResult = { ok: false, error: `Unknown op: ${envelope.op}` }
			process.stdout.write(JSON.stringify(result))
			process.exit(0)
			return
		}

		try {
			const result = await handler(envelope)
			process.stdout.write(JSON.stringify(result))
		} catch (err) {
			const result: HandlerResult = { ok: false, error: `Handler threw: ${err instanceof Error ? err.message : String(err)}` }
			process.stdout.write(JSON.stringify(result))
		}
		process.exit(0)
	}

	run().catch((err) => {
		const result: HandlerResult = { ok: false, error: `Fatal: ${err instanceof Error ? err.message : String(err)}` }
		process.stdout.write(JSON.stringify(result))
		process.exit(1)
	})
}
