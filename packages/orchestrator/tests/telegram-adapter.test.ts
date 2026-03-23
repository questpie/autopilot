import { describe, test, expect, afterEach } from 'bun:test'
import { createTelegramAdapter } from '../src/transports/adapters/telegram'
import type { TransportAdapter } from '../src/transports/registry'

describe('Telegram Adapter', () => {
	const originalFetch = globalThis.fetch

	afterEach(() => {
		globalThis.fetch = originalFetch
	})

	test('implements TransportAdapter interface', () => {
		const adapter = createTelegramAdapter({ botToken: 'test-token' })

		// Check that all required properties exist
		expect(adapter.name).toBe('telegram')
		expect(typeof adapter.send).toBe('function')
		expect(typeof adapter.formatIncoming).toBe('function')

		// Verify it satisfies the type at compile time
		const _typeCheck: TransportAdapter = adapter
	})

	test('send calls Telegram API with correct parameters', async () => {
		let capturedUrl = ''
		let capturedBody = ''

		globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
			capturedUrl = String(input)
			capturedBody = init?.body as string
			return new Response(JSON.stringify({ ok: true }), {
				headers: { 'Content-Type': 'application/json' },
			})
		}) as typeof fetch

		const adapter = createTelegramAdapter({ botToken: 'my-bot-token' })
		await adapter.send('12345', 'Hello world', {})

		expect(capturedUrl).toBe('https://api.telegram.org/botmy-bot-token/sendMessage')
		const body = JSON.parse(capturedBody)
		expect(body.chat_id).toBe('12345')
		expect(body.text).toBe('Hello world')
	})

	test('formatIncoming parses valid Telegram update', () => {
		const adapter = createTelegramAdapter({ botToken: 'test' })

		const payload = {
			update_id: 1,
			message: {
				message_id: 42,
				from: { id: 111, first_name: 'Alice', username: 'alice' },
				chat: { id: 999, type: 'private' },
				date: 1234567890,
				text: 'Hello bot',
			},
		}

		const result = adapter.formatIncoming!(payload)
		expect(result).not.toBeNull()
		expect(result!.from).toBe('alice')
		expect(result!.content).toBe('Hello bot')
		expect(result!.channel).toBe('999')
	})

	test('formatIncoming returns null for invalid payload', () => {
		const adapter = createTelegramAdapter({ botToken: 'test' })

		expect(adapter.formatIncoming!(null)).toBeNull()
		expect(adapter.formatIncoming!('string')).toBeNull()
		expect(adapter.formatIncoming!({ update_id: 1 })).toBeNull()
	})

	test('formatIncoming uses first_name when username is missing', () => {
		const adapter = createTelegramAdapter({ botToken: 'test' })

		const payload = {
			update_id: 1,
			message: {
				message_id: 1,
				from: { id: 111, first_name: 'Bob' },
				chat: { id: 123, type: 'private' },
				date: 0,
				text: 'Hi',
			},
		}

		const result = adapter.formatIncoming!(payload)
		expect(result).not.toBeNull()
		expect(result!.from).toBe('Bob')
	})

	test('formatIncoming returns null for update without text', () => {
		const adapter = createTelegramAdapter({ botToken: 'test' })

		const payload = {
			update_id: 1,
			message: {
				message_id: 1,
				from: { id: 111, first_name: 'Bob' },
				chat: { id: 123, type: 'private' },
				date: 0,
			},
		}

		const result = adapter.formatIncoming!(payload)
		expect(result).toBeNull()
	})
})
