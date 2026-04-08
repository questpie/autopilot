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
	provider_kind: string
	config: Record<string, unknown>
	secrets: Record<string, string>
	payload: Record<string, unknown>
}

export interface HandlerResult {
	ok: boolean
	external_id?: string
	metadata?: Record<string, unknown>
	error?: string
	action?: string
	input?: Record<string, unknown>
	reason?: string
	message?: string
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
	return { ok: true, action: 'task.create', input }
}

export function approve(): HandlerResult {
	return { ok: true, action: 'task.approve' }
}

export function reject(reason?: string): HandlerResult {
	return { ok: true, action: 'task.reject', reason }
}

export function reply(message: string): HandlerResult {
	return { ok: true, action: 'task.reply', message }
}

export function query(message: string): HandlerResult {
	return { ok: true, action: 'query.message', message }
}

export function noop(reason?: string): HandlerResult {
	return { ok: true, action: 'noop', reason }
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
