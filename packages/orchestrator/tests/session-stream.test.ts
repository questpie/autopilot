import { describe, test, expect } from 'bun:test'
import { SessionStreamManager } from '../src/session/stream'
import type { StreamChunk } from '@questpie/autopilot-spec'

function makeChunk(type: StreamChunk['type'], content: string): StreamChunk {
	return { at: Date.now(), type, content }
}

describe('SessionStreamManager', () => {
	test('createStream and getActiveStreams', () => {
		const manager = new SessionStreamManager()

		manager.createStream('session-1', 'dev')
		manager.createStream('session-2', 'pm')

		const active = manager.getActiveStreams()
		expect(active).toHaveLength(2)
		expect(active).toContainEqual({ sessionId: 'session-1', agentId: 'dev' })
		expect(active).toContainEqual({ sessionId: 'session-2', agentId: 'pm' })
	})

	test('endStream removes stream from active', () => {
		const manager = new SessionStreamManager()

		manager.createStream('session-1', 'dev')
		manager.createStream('session-2', 'pm')

		manager.endStream('session-1')

		const active = manager.getActiveStreams()
		expect(active).toHaveLength(1)
		expect(active[0].sessionId).toBe('session-2')
	})

	test('emit sends chunks to all subscribers', () => {
		const manager = new SessionStreamManager()
		manager.createStream('session-1', 'dev')

		const received1: StreamChunk[] = []
		const received2: StreamChunk[] = []

		manager.subscribe('session-1', (chunk) => received1.push(chunk))
		manager.subscribe('session-1', (chunk) => received2.push(chunk))

		const chunk = makeChunk('text', 'Hello world')
		manager.emit('session-1', chunk)

		expect(received1).toHaveLength(1)
		expect(received1[0].content).toBe('Hello world')
		expect(received2).toHaveLength(1)
		expect(received2[0].content).toBe('Hello world')
	})

	test('emit does nothing for non-existent session', () => {
		const manager = new SessionStreamManager()

		// Should not throw
		manager.emit('non-existent', makeChunk('text', 'test'))
	})

	test('subscribe returns working unsubscribe function', () => {
		const manager = new SessionStreamManager()
		manager.createStream('session-1', 'dev')

		const received: StreamChunk[] = []
		const unsubscribe = manager.subscribe('session-1', (chunk) => received.push(chunk))

		manager.emit('session-1', makeChunk('text', 'first'))
		expect(received).toHaveLength(1)

		unsubscribe()

		manager.emit('session-1', makeChunk('text', 'second'))
		expect(received).toHaveLength(1) // Still 1, unsubscribed
	})

	test('subscribe to non-existent session returns noop unsubscribe', () => {
		const manager = new SessionStreamManager()

		const unsubscribe = manager.subscribe('non-existent', () => {})
		// Should not throw
		unsubscribe()
	})

	test('endStream clears all listeners', () => {
		const manager = new SessionStreamManager()
		manager.createStream('session-1', 'dev')

		const received: StreamChunk[] = []
		manager.subscribe('session-1', (chunk) => received.push(chunk))

		manager.emit('session-1', makeChunk('text', 'before end'))
		expect(received).toHaveLength(1)

		manager.endStream('session-1')

		// Emit after end should do nothing
		manager.emit('session-1', makeChunk('text', 'after end'))
		expect(received).toHaveLength(1)
	})

	test('endStream on non-existent session does nothing', () => {
		const manager = new SessionStreamManager()
		// Should not throw
		manager.endStream('non-existent')
	})

	test('multiple chunk types flow through correctly', () => {
		const manager = new SessionStreamManager()
		manager.createStream('session-1', 'dev')

		const received: StreamChunk[] = []
		manager.subscribe('session-1', (chunk) => received.push(chunk))

		manager.emit('session-1', makeChunk('thinking', 'analyzing...'))
		manager.emit('session-1', makeChunk('tool_call', 'readFile'))
		manager.emit('session-1', makeChunk('text', 'result'))
		manager.emit('session-1', makeChunk('status', 'done'))

		expect(received).toHaveLength(4)
		expect(received.map((c) => c.type)).toEqual(['thinking', 'tool_call', 'text', 'status'])
	})
})
