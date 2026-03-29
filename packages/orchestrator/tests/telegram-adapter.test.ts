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
})
