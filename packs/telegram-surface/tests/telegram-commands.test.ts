/**
 * Tests for Telegram handler conversation.ingest command routing.
 *
 * Each test spawns the handler as a subprocess with a crafted envelope on stdin
 * and asserts the structured JSON result on stdout.
 *
 * Key invariant: the Telegram handler emits generic `conversation.command`
 * actions — it does NOT know workflow IDs or company config.
 */
import { describe, test, expect } from 'bun:test'
import { join } from 'node:path'

const HANDLER_PATH = join(import.meta.dir, '..', 'handlers', 'telegram.ts')

interface HandlerResult {
	ok: boolean
	external_id?: string
	metadata?: Record<string, unknown>
	error?: string
}

function makeEnvelope(text: string, overrides?: { reply_to_message?: Record<string, unknown> }): Record<string, unknown> {
	const message: Record<string, unknown> = {
		message_id: 777,
		chat: { id: 12345 },
		from: { id: 111, first_name: 'Test' },
		text,
	}
	if (overrides?.reply_to_message) {
		message.reply_to_message = overrides.reply_to_message
	}
	return {
		op: 'conversation.ingest',
		provider_id: 'telegram',
		provider_kind: 'conversation_channel',
		config: { default_chat_id: '123' },
		secrets: { bot_token: 'test-token' },
		payload: { message },
	}
}

async function runHandler(envelope: Record<string, unknown>): Promise<HandlerResult> {
	const proc = Bun.spawn(['bun', 'run', HANDLER_PATH], {
		stdin: new Blob([JSON.stringify(envelope)]),
		stdout: 'pipe',
		stderr: 'pipe',
	})
	const output = await new Response(proc.stdout).text()
	await proc.exited
	return JSON.parse(output)
}

describe('Telegram handler: conversation.command routing', () => {
	test('/build nainštaluj providera → conversation.command', async () => {
		const result = await runHandler(makeEnvelope('/build nainštaluj providera'))

		expect(result.ok).toBe(true)
		expect(result.metadata?.action).toBe('conversation.command')
		expect(result.metadata?.command).toBe('build')
		expect(result.metadata?.args).toBe('nainštaluj providera')
		expect(result.metadata?.thread_id).toBe('777')
		expect(result.metadata?.sender_id).toBe('111')
		expect(result.metadata?.sender_name).toBe('Test')
	})

	test('/build reply preserves reply thread_id', async () => {
		const result = await runHandler(makeEnvelope('/build follow up', {
			reply_to_message: { message_id: 999 },
		}))

		expect(result.ok).toBe(true)
		expect(result.metadata?.action).toBe('conversation.command')
		expect(result.metadata?.command).toBe('build')
		expect(result.metadata?.thread_id).toBe('999')
	})

	test('/direct napíš básničku → conversation.command', async () => {
		const result = await runHandler(makeEnvelope('/direct napíš básničku'))

		expect(result.ok).toBe(true)
		expect(result.metadata?.action).toBe('conversation.command')
		expect(result.metadata?.command).toBe('direct')
		expect(result.metadata?.args).toBe('napíš básničku')
	})

	test('/task create tests → conversation.command', async () => {
		const result = await runHandler(makeEnvelope('/task create tests'))

		expect(result.ok).toBe(true)
		expect(result.metadata?.action).toBe('conversation.command')
		expect(result.metadata?.command).toBe('task')
		expect(result.metadata?.args).toBe('create tests')
	})

	test('/somecommand (no args) → conversation.command with empty args', async () => {
		const result = await runHandler(makeEnvelope('/somecommand'))

		expect(result.ok).toBe(true)
		expect(result.metadata?.action).toBe('conversation.command')
		expect(result.metadata?.command).toBe('somecommand')
		expect(result.metadata?.args).toBe('')
	})

	test('handler has no hardcoded workflow IDs', async () => {
		// Any /command name forwards generically — handler doesn't know workflow IDs
		const result = await runHandler(makeEnvelope('/anything do stuff'))

		expect(result.ok).toBe(true)
		expect(result.metadata?.action).toBe('conversation.command')
		expect(result.metadata?.command).toBe('anything')
		expect(result.metadata?.args).toBe('do stuff')
		// No workflow_id in the result — that's orchestrator's job
		expect(result.metadata).not.toHaveProperty('workflow_id')
	})
})

describe('Telegram handler: reserved commands stay unchanged', () => {
	test('plain text "ahoj" → query.message', async () => {
		const result = await runHandler(makeEnvelope('ahoj'))

		expect(result.ok).toBe(true)
		expect(result.metadata?.action).toBe('query.message')
		expect(result.metadata?.message).toBe('ahoj')
		expect(result.metadata?.conversation_id).toBe('12345')
		expect(result.metadata?.sender_id).toBe('111')
		expect(result.metadata?.sender_name).toBe('Test')
	})

	test('/approve → task.approve', async () => {
		const result = await runHandler(makeEnvelope('/approve'))

		expect(result.ok).toBe(true)
		expect(result.metadata?.action).toBe('task.approve')
	})

	test('/reject with reason → task.reject', async () => {
		const result = await runHandler(makeEnvelope('/reject not good enough'))

		expect(result.ok).toBe(true)
		expect(result.metadata?.action).toBe('task.reject')
		expect(result.metadata?.message).toBe('not good enough')
	})

	test('/reply message → task.reply', async () => {
		const result = await runHandler(makeEnvelope('/reply fix the tests first'))

		expect(result.ok).toBe(true)
		expect(result.metadata?.action).toBe('task.reply')
		expect(result.metadata?.message).toBe('fix the tests first')
	})

	test('/reset → query.message (passthrough)', async () => {
		const result = await runHandler(makeEnvelope('/reset'))

		expect(result.ok).toBe(true)
		expect(result.metadata?.action).toBe('query.message')
		expect(result.metadata?.message).toBe('/reset')
	})

	test('/new → query.message (passthrough)', async () => {
		const result = await runHandler(makeEnvelope('/new'))

		expect(result.ok).toBe(true)
		expect(result.metadata?.action).toBe('query.message')
		expect(result.metadata?.message).toBe('/new')
	})

	test('/clear → query.message (passthrough)', async () => {
		const result = await runHandler(makeEnvelope('/clear'))

		expect(result.ok).toBe(true)
		expect(result.metadata?.action).toBe('query.message')
		expect(result.metadata?.message).toBe('/clear')
	})
})

describe('Telegram handler: callback_query', () => {
	test('approve callback → task.approve', async () => {
		const envelope = {
			op: 'conversation.ingest',
			provider_id: 'telegram',
			provider_kind: 'conversation_channel',
			config: { default_chat_id: '123' },
			secrets: { bot_token: 'test-token' },
			payload: {
				callback_query: {
					id: 'cb-1',
					data: 'approve:task-42',
					message: {
						message_id: 999,
						chat: { id: 12345 },
					},
				},
			},
		}

		const result = await runHandler(envelope)

		expect(result.ok).toBe(true)
		expect(result.metadata?.action).toBe('task.approve')
		expect(result.metadata?.conversation_id).toBe('12345')
		expect(result.metadata?.thread_id).toBe('999')
	})
})
