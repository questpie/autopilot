import { describe, it, expect, afterEach } from 'bun:test'
import { sendChannelMessage, sendDirectMessage, readChannelMessages } from '../src/fs/messages'
import { createTestCompany } from './helpers'

describe('messages', () => {
	let cleanup: () => Promise<void>
	let root: string

	afterEach(async () => {
		if (cleanup) await cleanup()
	})

	it('should send a channel message', async () => {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup

		const msg = await sendChannelMessage(root, 'general', {
			from: 'developer',
			content: 'Hello team',
		})

		expect(msg.id).toMatch(/^msg-/)
		expect(msg.channel).toBe('general')
		expect(msg.from).toBe('developer')
		expect(msg.content).toBe('Hello team')
		expect(msg.at).toBeDefined()
	})

	it('should read channel messages', async () => {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup

		await sendChannelMessage(root, 'dev', {
			from: 'developer',
			content: 'First message',
			id: 'msg-001',
		})
		await sendChannelMessage(root, 'dev', {
			from: 'reviewer',
			content: 'Second message',
			id: 'msg-002',
		})

		const messages = await readChannelMessages(root, 'dev')
		expect(messages).toHaveLength(2)
		expect(messages[0]?.content).toBe('First message')
		expect(messages[1]?.content).toBe('Second message')
	})

	it('should limit channel messages', async () => {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup

		await sendChannelMessage(root, 'general', {
			from: 'a',
			content: 'One',
			id: 'msg-a1',
		})
		await sendChannelMessage(root, 'general', {
			from: 'b',
			content: 'Two',
			id: 'msg-a2',
		})
		await sendChannelMessage(root, 'general', {
			from: 'c',
			content: 'Three',
			id: 'msg-a3',
		})

		const messages = await readChannelMessages(root, 'general', 2)
		expect(messages).toHaveLength(2)
		expect(messages[0]?.content).toBe('Two')
		expect(messages[1]?.content).toBe('Three')
	})

	it('should return empty array for non-existent channel', async () => {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup

		const messages = await readChannelMessages(root, 'nonexistent')
		expect(messages).toEqual([])
	})

	it('should send a direct message', async () => {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup

		const msg = await sendDirectMessage(root, 'developer', 'reviewer', {
			content: 'Can you review this?',
		})

		expect(msg.id).toMatch(/^msg-/)
		expect(msg.from).toBe('developer')
		expect(msg.to).toBe('reviewer')
		expect(msg.content).toBe('Can you review this?')
	})

	it('should create channel folder if it does not exist', async () => {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup

		const msg = await sendChannelMessage(root, 'new-channel', {
			from: 'bot',
			content: 'First in new channel',
		})

		expect(msg.channel).toBe('new-channel')

		const messages = await readChannelMessages(root, 'new-channel')
		expect(messages).toHaveLength(1)
	})
})
