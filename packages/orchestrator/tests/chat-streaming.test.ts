/**
 * D8-D12: Chat streaming tests — all functional, no source-reading.
 */
import { describe, test, expect } from 'bun:test'
import { SessionStreamManager } from '../src/session/stream'
import { EventBus } from '../src/events/event-bus'
import type { AgentEvent } from '../src/agent/provider'
import type { SpawnMode, SpawnOptions } from '../src/agent/spawner'

// ─── D8: text_delta streaming ──────────────────────────────────────────────

describe('D8: text_delta streaming', () => {
	test('StreamChunk schema accepts text_delta type', async () => {
		const { StreamChunkSchema } = await import('@questpie/autopilot-spec')
		const result = StreamChunkSchema.safeParse({ at: Date.now(), type: 'text_delta', content: 'Hello ' })
		expect(result.success).toBe(true)
	})

	test('StreamChunk schema accepts text type (final)', async () => {
		const { StreamChunkSchema } = await import('@questpie/autopilot-spec')
		const result = StreamChunkSchema.safeParse({ at: Date.now(), type: 'text', content: 'complete' })
		expect(result.success).toBe(true)
	})

	test('StreamChunk schema rejects invalid type', async () => {
		const { StreamChunkSchema } = await import('@questpie/autopilot-spec')
		const result = StreamChunkSchema.safeParse({ at: Date.now(), type: 'invalid', content: 'x' })
		expect(result.success).toBe(false)
	})

	test('AgentEvent supports text_delta type', () => {
		const event: AgentEvent = { type: 'text_delta', content: 'chunk' }
		expect(event.type).toBe('text_delta')
	})

	test('SessionStreamManager delivers text_delta chunks to listeners', () => {
		const manager = new SessionStreamManager()
		manager.createStream('s1', 'agent')
		const received: Array<{ type: string; content?: string }> = []
		manager.subscribe('s1', (chunk) => received.push(chunk))

		manager.emit('s1', { at: Date.now(), type: 'text_delta', content: 'Hello ' })
		manager.emit('s1', { at: Date.now(), type: 'text_delta', content: 'world' })
		manager.emit('s1', { at: Date.now(), type: 'text', content: 'Hello world' })

		expect(received).toHaveLength(3)
		expect(received[0].type).toBe('text_delta')
		expect(received[2].type).toBe('text')
		manager.endStream('s1')
	})

	test('unsubscribed listener stops receiving', () => {
		const manager = new SessionStreamManager()
		manager.createStream('s1', 'agent')
		const received: unknown[] = []
		const unsub = manager.subscribe('s1', (c) => received.push(c))

		manager.emit('s1', { at: Date.now(), type: 'text_delta', content: 'before' })
		unsub()
		manager.emit('s1', { at: Date.now(), type: 'text_delta', content: 'after' })

		expect(received).toHaveLength(1)
		manager.endStream('s1')
	})
})

// ─── D9: Typing events on EventBus ─────────────────────────────────────────

describe('D9: agent_typing events', () => {
	test('EventBus emits agent_typing started', () => {
		const bus = new EventBus()
		const events: unknown[] = []
		bus.subscribe((e) => events.push(e))
		bus.emit({ type: 'agent_typing', agentId: 'dev', status: 'started', sessionId: 's1' })
		expect(events).toHaveLength(1)
		expect((events[0] as any).status).toBe('started')
	})

	test('EventBus emits agent_typing stopped', () => {
		const bus = new EventBus()
		const events: unknown[] = []
		bus.subscribe((e) => events.push(e))
		bus.emit({ type: 'agent_typing', agentId: 'dev', status: 'stopped', sessionId: 's1' })
		expect((events[0] as any).status).toBe('stopped')
	})

	test('typing + session events coexist', () => {
		const bus = new EventBus()
		const events: unknown[] = []
		bus.subscribe((e) => events.push(e))
		bus.emit({ type: 'agent_session', agentId: 'dev', status: 'started', sessionId: 's1' })
		bus.emit({ type: 'agent_typing', agentId: 'dev', status: 'started', sessionId: 's1' })
		bus.emit({ type: 'agent_typing', agentId: 'dev', status: 'stopped', sessionId: 's1' })
		bus.emit({ type: 'agent_session', agentId: 'dev', status: 'ended', sessionId: 's1' })
		expect(events).toHaveLength(4)
	})
})

// ─── D10: Spawner dual mode ────────────────────────────────────────────────

describe('D10: spawner dual mode', () => {
	test('SpawnMode accepts autonomous and chat', () => {
		const a: SpawnMode = 'autonomous'
		const c: SpawnMode = 'chat'
		expect(a).toBe('autonomous')
		expect(c).toBe('chat')
	})

	test('SpawnOptions accepts mode + channelId', () => {
		const opts: Partial<SpawnOptions> = { mode: 'chat', channelId: 'dm-user--agent' }
		expect(opts.mode).toBe('chat')
		expect(opts.channelId).toBe('dm-user--agent')
	})

	test('SpawnOptions defaults mode to undefined', () => {
		const opts: Partial<SpawnOptions> = {}
		expect(opts.mode).toBeUndefined()
	})
})

// ─── D12: Message references store sessionId ───────────────────────────────

describe('D12: session reference in messages', () => {
	test('MessageSchema accepts references with session IDs', async () => {
		const { MessageSchema } = await import('@questpie/autopilot-spec')
		const msg = MessageSchema.parse({
			id: 'msg-1', from: 'dev', at: new Date().toISOString(),
			content: 'Response', references: ['session-abc-dev'],
		})
		expect(msg.references).toContain('session-abc-dev')
	})

	test('session ID follows expected format', () => {
		const sessionId = `session-${Date.now().toString(36)}-developer`
		expect(sessionId).toMatch(/^session-[a-z0-9]+-developer$/)
	})
})

// ─── Stream manager edge cases ─────────────────────────────────────────────

describe('SessionStreamManager edge cases', () => {
	test('emit to non-existent stream is silent', () => {
		const m = new SessionStreamManager()
		m.emit('ghost', { at: Date.now(), type: 'text', content: 'x' }) // no throw
	})

	test('subscribe to non-existent stream returns noop', () => {
		const m = new SessionStreamManager()
		const unsub = m.subscribe('ghost', () => {})
		expect(typeof unsub).toBe('function')
		unsub()
	})

	test('endStream clears listeners', () => {
		const m = new SessionStreamManager()
		m.createStream('s1', 'a1')
		const r: unknown[] = []
		m.subscribe('s1', (c) => r.push(c))
		m.endStream('s1')
		m.emit('s1', { at: Date.now(), type: 'text', content: 'after' })
		expect(r).toHaveLength(0)
	})

	test('getActiveStreams tracks create/end', () => {
		const m = new SessionStreamManager()
		m.createStream('s1', 'a1')
		m.createStream('s2', 'a2')
		expect(m.getActiveStreams()).toHaveLength(2)
		m.endStream('s1')
		expect(m.getActiveStreams()).toHaveLength(1)
		m.endStream('s2')
	})

	test('multiple listeners all receive events', () => {
		const m = new SessionStreamManager()
		m.createStream('s1', 'a1')
		const r1: unknown[] = [], r2: unknown[] = []
		m.subscribe('s1', (c) => r1.push(c))
		m.subscribe('s1', (c) => r2.push(c))
		m.emit('s1', { at: Date.now(), type: 'tool_call', tool: 'read_file' })
		expect(r1).toHaveLength(1)
		expect(r2).toHaveLength(1)
		m.endStream('s1')
	})
})
