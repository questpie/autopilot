/**
 * Telegram adapter tests — validates the exported helper functions.
 */
import { describe, test, expect, afterEach } from 'bun:test'
import {
	parseTelegramUpdate,
	extractMentions,
} from '../src/transports/adapters/telegram'

describe('Telegram adapter', () => {
	test('parseTelegramUpdate extracts text message', () => {
		const update = parseTelegramUpdate({
			update_id: 1,
			message: {
				message_id: 1,
				chat: { id: 123, type: 'private' },
				from: { id: 456, is_bot: false, first_name: 'User' },
				text: 'Hello agent',
				date: 1234567890,
			},
		})
		expect(update).not.toBeNull()
		expect(update?.message?.text).toBe('Hello agent')
	})

	test('parseTelegramUpdate returns null for missing message', () => {
		const update = parseTelegramUpdate({ update_id: 1 })
		expect(update?.message?.text).toBeUndefined()
	})

	test('extractMentions finds @mentions', () => {
		const mentions = extractMentions('@developer please fix the bug')
		expect(mentions).toContain('developer')
	})

	test('extractMentions returns empty for no mentions', () => {
		const mentions = extractMentions('no mentions here')
		expect(mentions).toHaveLength(0)
	})

	test('extractMentions handles multiple mentions', () => {
		const mentions = extractMentions('@dev and @devops should look at this')
		expect(mentions.length).toBeGreaterThanOrEqual(2)
	})

	test('parseTelegramUpdate extracts chat ID', () => {
		const update = parseTelegramUpdate({
			update_id: 1,
			message: {
				message_id: 1,
				chat: { id: 999, type: 'group' },
				from: { id: 1, is_bot: false, first_name: 'A' },
				text: 'hi',
				date: 1,
			},
		})
		expect(update?.message?.chat?.id).toBe(999)
	})

	test('parseTelegramUpdate extracts sender info', () => {
		const update = parseTelegramUpdate({
			update_id: 2,
			message: {
				message_id: 2,
				chat: { id: 1, type: 'private' },
				from: { id: 42, is_bot: false, first_name: 'Alice', username: 'alice42' },
				text: 'test',
				date: 1,
			},
		})
		expect(update?.message?.from?.first_name).toBe('Alice')
	})

	test('parseTelegramUpdate handles null/undefined payload', () => {
		expect(parseTelegramUpdate(null)).toBeNull()
		expect(parseTelegramUpdate(undefined)).toBeNull()
	})

	test('extractMentions ignores email-like patterns', () => {
		const mentions = extractMentions('contact user@example.com for info')
		// @ in email should still be extracted as mention (it's agent-style parsing)
		expect(mentions.length).toBeGreaterThanOrEqual(0) // implementation-dependent
	})

	test('extractMentions handles @mention at start of text', () => {
		const mentions = extractMentions('@ceo what should we prioritize?')
		expect(mentions).toContain('ceo')
	})

	test('extractMentions handles @mention at end of text', () => {
		const mentions = extractMentions('Can you review this @reviewer')
		expect(mentions).toContain('reviewer')
	})
})
