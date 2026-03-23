import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test'
import {
	sendTelegramMessage,
	parseTelegramUpdate,
	extractMentions,
	setTelegramWebhook,
} from '../src/transports/telegram'
import type { TelegramConfig, TelegramUpdate } from '../src/transports/telegram'

describe('Telegram Transport', () => {
	describe('parseTelegramUpdate', () => {
		test('parses a valid text message update', () => {
			const payload = {
				update_id: 123456789,
				message: {
					message_id: 1,
					from: { id: 987654321, first_name: 'John', username: 'john' },
					chat: { id: 987654321, type: 'private' },
					date: 1234567890,
					text: '@sam check the spec',
				},
			}

			const result = parseTelegramUpdate(payload)
			expect(result).not.toBeNull()
			expect(result!.update_id).toBe(123456789)
			expect(result!.message!.text).toBe('@sam check the spec')
			expect(result!.message!.chat.id).toBe(987654321)
			expect(result!.message!.from!.username).toBe('john')
		})

		test('returns null for null payload', () => {
			expect(parseTelegramUpdate(null)).toBeNull()
		})

		test('returns null for non-object payload', () => {
			expect(parseTelegramUpdate('string')).toBeNull()
			expect(parseTelegramUpdate(42)).toBeNull()
		})

		test('returns null for payload without update_id', () => {
			expect(parseTelegramUpdate({ message: {} })).toBeNull()
		})

		test('returns null for payload without message', () => {
			expect(parseTelegramUpdate({ update_id: 1 })).toBeNull()
		})

		test('returns null for message without chat', () => {
			expect(parseTelegramUpdate({
				update_id: 1,
				message: { text: 'hello' },
			})).toBeNull()
		})

		test('returns null for message with chat missing id', () => {
			expect(parseTelegramUpdate({
				update_id: 1,
				message: { chat: { type: 'private' }, text: 'hello' },
			})).toBeNull()
		})

		test('parses group chat message', () => {
			const payload = {
				update_id: 1,
				message: {
					message_id: 42,
					from: { id: 111, first_name: 'Alice' },
					chat: { id: -100123456, type: 'supergroup', title: 'Dev Team' },
					date: 1234567890,
					text: '@max deploy the fix',
				},
			}

			const result = parseTelegramUpdate(payload)
			expect(result).not.toBeNull()
			expect(result!.message!.chat.type).toBe('supergroup')
			expect(result!.message!.chat.title).toBe('Dev Team')
		})

		test('parses message without from field', () => {
			const payload = {
				update_id: 1,
				message: {
					message_id: 1,
					chat: { id: 123, type: 'private' },
					date: 0,
					text: 'hello',
				},
			}

			const result = parseTelegramUpdate(payload)
			expect(result).not.toBeNull()
			expect(result!.message!.from).toBeUndefined()
		})
	})

	describe('extractMentions', () => {
		test('extracts single mention', () => {
			expect(extractMentions('@sam check the spec')).toEqual(['sam'])
		})

		test('extracts multiple mentions', () => {
			const mentions = extractMentions('@sam @max check the spec')
			expect(mentions).toEqual(['sam', 'max'])
		})

		test('returns empty array for no mentions', () => {
			expect(extractMentions('check the spec')).toEqual([])
		})

		test('handles mentions with hyphens and underscores', () => {
			expect(extractMentions('@dev-ops do the thing')).toEqual(['dev-ops'])
			expect(extractMentions('@dev_ops do the thing')).toEqual(['dev_ops'])
		})

		test('lowercases mentions', () => {
			expect(extractMentions('@SAM @Max check')).toEqual(['sam', 'max'])
		})

		test('handles mention at end of message', () => {
			expect(extractMentions('hey @ceo')).toEqual(['ceo'])
		})

		test('handles mention-only message', () => {
			expect(extractMentions('@riley')).toEqual(['riley'])
		})
	})

	describe('sendTelegramMessage', () => {
		const originalFetch = globalThis.fetch

		afterEach(() => {
			globalThis.fetch = originalFetch
		})

		test('sends message with correct parameters', async () => {
			let capturedUrl = ''
			let capturedOptions: RequestInit | undefined

			globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
				capturedUrl = String(input)
				capturedOptions = init
				return new Response(JSON.stringify({ ok: true }), {
					headers: { 'Content-Type': 'application/json' },
				})
			}) as typeof fetch

			const config: TelegramConfig = {
				botToken: 'test-token-123',
				chatId: 987654321,
			}

			const result = await sendTelegramMessage(config, 'Hello world')

			expect(result.ok).toBe(true)
			expect(capturedUrl).toBe('https://api.telegram.org/bottest-token-123/sendMessage')
			expect(capturedOptions?.method).toBe('POST')
			expect(capturedOptions?.headers).toEqual({ 'Content-Type': 'application/json' })

			const body = JSON.parse(capturedOptions!.body as string)
			expect(body.chat_id).toBe(987654321)
			expect(body.text).toBe('Hello world')
			expect(body.parse_mode).toBe('Markdown')
		})

		test('handles string chat_id', async () => {
			let capturedBody = ''

			globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
				capturedBody = init?.body as string
				return new Response(JSON.stringify({ ok: true }), {
					headers: { 'Content-Type': 'application/json' },
				})
			}) as typeof fetch

			await sendTelegramMessage({ botToken: 'tok', chatId: '@mychannel' }, 'msg')

			const body = JSON.parse(capturedBody)
			expect(body.chat_id).toBe('@mychannel')
		})

		test('handles API error response', async () => {
			globalThis.fetch = (async () => {
				return new Response(JSON.stringify({
					ok: false,
					description: 'Bad Request: chat not found',
				}), {
					headers: { 'Content-Type': 'application/json' },
				})
			}) as typeof fetch

			const result = await sendTelegramMessage(
				{ botToken: 'tok', chatId: 999 },
				'msg',
			)

			expect(result.ok).toBe(false)
			expect(result.description).toBe('Bad Request: chat not found')
		})
	})

	describe('setTelegramWebhook', () => {
		const originalFetch = globalThis.fetch

		afterEach(() => {
			globalThis.fetch = originalFetch
		})

		test('sets webhook with correct URL and allowed_updates', async () => {
			let capturedUrl = ''
			let capturedBody = ''

			globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
				capturedUrl = String(input)
				capturedBody = init?.body as string
				return new Response(JSON.stringify({ ok: true }), {
					headers: { 'Content-Type': 'application/json' },
				})
			}) as typeof fetch

			const result = await setTelegramWebhook('my-token', 'https://example.com/hooks/telegram')

			expect(result.ok).toBe(true)
			expect(capturedUrl).toBe('https://api.telegram.org/botmy-token/setWebhook')

			const body = JSON.parse(capturedBody)
			expect(body.url).toBe('https://example.com/hooks/telegram')
			expect(body.allowed_updates).toEqual(['message'])
		})
	})
})
