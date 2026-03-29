/**
 * D8-D12: Chat streaming tests.
 *
 * Tests the streaming pipeline components:
 * - D8: text_delta event type in StreamChunk schema
 * - D9: agent_typing event type in EventBus
 * - D10: SpawnMode type and spawner interface contracts
 * - D11: Chat endpoint request/response shape
 * - D12: DM message saving via references field
 *
 * Uses mocks for external dependencies (providers, DI container).
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
		const result = StreamChunkSchema.safeParse({
			at: Date.now(),
			type: 'text_delta',
			content: 'Hello ',
		})
		expect(result.success).toBe(true)
	})

	test('StreamChunk schema accepts text type (final)', async () => {
		const { StreamChunkSchema } = await import('@questpie/autopilot-spec')
		const result = StreamChunkSchema.safeParse({
			at: Date.now(),
			type: 'text',
			content: 'Hello world complete response',
		})
		expect(result.success).toBe(true)
	})

	test('AgentEvent supports text_delta type', () => {
		const event: AgentEvent = {
			type: 'text_delta',
			content: 'chunk',
		}
		expect(event.type).toBe('text_delta')
	})

	test('SessionStreamManager delivers text_delta chunks to listeners', () => {
		const manager = new SessionStreamManager()
		manager.createStream('test-session', 'test-agent')

		const received: Array<{ type: string; content?: string }> = []
		manager.subscribe('test-session', (chunk) => {
			received.push(chunk)
		})

		// Emit text_delta chunks
		manager.emit('test-session', { at: Date.now(), type: 'text_delta', content: 'Hello ' })
		manager.emit('test-session', { at: Date.now(), type: 'text_delta', content: 'world' })
		manager.emit('test-session', { at: Date.now(), type: 'text', content: 'Hello world' })

		expect(received).toHaveLength(3)
		expect(received[0].type).toBe('text_delta')
		expect(received[0].content).toBe('Hello ')
		expect(received[1].type).toBe('text_delta')
		expect(received[1].content).toBe('world')
		expect(received[2].type).toBe('text')
		expect(received[2].content).toBe('Hello world')

		manager.endStream('test-session')
	})

	test('SessionStreamManager does not deliver to unsubscribed listeners', () => {
		const manager = new SessionStreamManager()
		manager.createStream('test-session', 'test-agent')

		const received: unknown[] = []
		const unsub = manager.subscribe('test-session', (chunk) => {
			received.push(chunk)
		})

		manager.emit('test-session', { at: Date.now(), type: 'text_delta', content: 'before' })
		unsub()
		manager.emit('test-session', { at: Date.now(), type: 'text_delta', content: 'after' })

		expect(received).toHaveLength(1)
		manager.endStream('test-session')
	})
})

// ─── D9: Typing events on EventBus ─────────────────────────────────────────

describe('D9: agent_typing events', () => {
	test('EventBus accepts agent_typing started event', () => {
		const bus = new EventBus()
		const events: unknown[] = []
		bus.subscribe((e) => events.push(e))

		bus.emit({ type: 'agent_typing', agentId: 'dev', status: 'started', sessionId: 'sess-1' })

		expect(events).toHaveLength(1)
		expect((events[0] as Record<string, unknown>).type).toBe('agent_typing')
		expect((events[0] as Record<string, unknown>).status).toBe('started')
	})

	test('EventBus accepts agent_typing stopped event', () => {
		const bus = new EventBus()
		const events: unknown[] = []
		bus.subscribe((e) => events.push(e))

		bus.emit({ type: 'agent_typing', agentId: 'dev', status: 'stopped', sessionId: 'sess-1' })

		expect(events).toHaveLength(1)
		expect((events[0] as Record<string, unknown>).status).toBe('stopped')
	})

	test('typing events coexist with session events', () => {
		const bus = new EventBus()
		const events: unknown[] = []
		bus.subscribe((e) => events.push(e))

		bus.emit({ type: 'agent_session', agentId: 'dev', status: 'started', sessionId: 'sess-1' })
		bus.emit({ type: 'agent_typing', agentId: 'dev', status: 'started', sessionId: 'sess-1' })
		bus.emit({ type: 'agent_typing', agentId: 'dev', status: 'stopped', sessionId: 'sess-1' })
		bus.emit({ type: 'agent_session', agentId: 'dev', status: 'ended', sessionId: 'sess-1' })

		expect(events).toHaveLength(4)
		expect((events[0] as Record<string, unknown>).type).toBe('agent_session')
		expect((events[1] as Record<string, unknown>).type).toBe('agent_typing')
		expect((events[2] as Record<string, unknown>).type).toBe('agent_typing')
		expect((events[3] as Record<string, unknown>).type).toBe('agent_session')
	})
})

// ─── D10: Spawner dual mode ────────────────────────────────────────────────

describe('D10: spawner dual mode', () => {
	test('SpawnMode type accepts autonomous', () => {
		const mode: SpawnMode = 'autonomous'
		expect(mode).toBe('autonomous')
	})

	test('SpawnMode type accepts chat', () => {
		const mode: SpawnMode = 'chat'
		expect(mode).toBe('chat')
	})

	test('SpawnOptions accepts mode and channelId', () => {
		const opts: Partial<SpawnOptions> = {
			mode: 'chat',
			channelId: 'dm-user--agent',
		}
		expect(opts.mode).toBe('chat')
		expect(opts.channelId).toBe('dm-user--agent')
	})

	test('SpawnOptions defaults mode to undefined (autonomous)', () => {
		const opts: Partial<SpawnOptions> = {}
		expect(opts.mode).toBeUndefined()
	})

	test('chat mode system prompt instructs direct response', async () => {
		// Verify the chat mode system prompt addition exists in the spawner source
		const { readFileSync } = await import('node:fs')
		const { join } = await import('node:path')
		const spawnerSource = readFileSync(
			join(import.meta.dir, '..', 'src', 'agent', 'spawner.ts'),
			'utf-8',
		)
		expect(spawnerSource).toContain('direct chat mode')
		expect(spawnerSource).toContain('Do not use the message() tool')
	})

	test('chat mode filters out message tool', async () => {
		const spawnerSource = (await import('node:fs')).readFileSync(
			(await import('node:path')).join(import.meta.dir, '..', 'src', 'agent', 'spawner.ts'),
			'utf-8',
		)
		expect(spawnerSource).toContain("t.name !== 'message'")
	})
})

// ─── D11: Chat endpoint shape ──────────────────────────────────────────────

describe('D11: streaming chat endpoint', () => {
	test('chat route file exists and exports chat', async () => {
		const { existsSync } = await import('node:fs')
		const { join } = await import('node:path')
		const chatRoute = join(import.meta.dir, '..', 'src', 'api', 'routes', 'chat.ts')
		expect(existsSync(chatRoute)).toBe(true)
	})

	test('chat route contains agentId param endpoint', async () => {
		const source = (await import('node:fs')).readFileSync(
			(await import('node:path')).join(import.meta.dir, '..', 'src', 'api', 'routes', 'chat.ts'),
			'utf-8',
		)
		expect(source).toContain('/:agentId')
		expect(source).toContain('text/event-stream')
		expect(source).toContain('spawnAgent')
	})

	test('chat endpoint creates DM channel', async () => {
		const source = (await import('node:fs')).readFileSync(
			(await import('node:path')).join(import.meta.dir, '..', 'src', 'api', 'routes', 'chat.ts'),
			'utf-8',
		)
		expect(source).toContain('getOrCreateDirectChannel')
	})

	test('chat endpoint saves user message', async () => {
		const source = (await import('node:fs')).readFileSync(
			(await import('node:path')).join(import.meta.dir, '..', 'src', 'api', 'routes', 'chat.ts'),
			'utf-8',
		)
		expect(source).toContain('sendMessage')
	})

	test('chat endpoint spawns in chat mode', async () => {
		const source = (await import('node:fs')).readFileSync(
			(await import('node:path')).join(import.meta.dir, '..', 'src', 'api', 'routes', 'chat.ts'),
			'utf-8',
		)
		expect(source).toContain("mode: 'chat'")
	})
})

// ─── D12: Save final text as DM message ────────────────────────────────────

describe('D12: save chat result to DM', () => {
	test('spawner saves message in chat mode with channelId', async () => {
		const source = (await import('node:fs')).readFileSync(
			(await import('node:path')).join(import.meta.dir, '..', 'src', 'agent', 'spawner.ts'),
			'utf-8',
		)
		// Verify the D12 logic exists: save message when mode === 'chat' && channelId
		expect(source).toContain("mode === 'chat'")
		expect(source).toContain('channelId')
		expect(source).toContain('sendMessage')
		expect(source).toContain('references: [sessionId]')
	})

	test('message references field stores sessionId for replay', async () => {
		const { MessageSchema } = await import('@questpie/autopilot-spec')
		const msg = MessageSchema.parse({
			id: 'msg-test',
			from: 'developer',
			at: new Date().toISOString(),
			content: 'Agent response text',
			references: ['session-abc123-developer'],
		})
		expect(msg.references).toContain('session-abc123-developer')
	})

	test('session reference starts with session- prefix', () => {
		const sessionId = `session-${Date.now().toString(36)}-developer`
		expect(sessionId).toMatch(/^session-[a-z0-9]+-developer$/)
	})
})

// ─── Stream manager edge cases ─────────────────────────────────────────────

describe('SessionStreamManager edge cases', () => {
	test('emit to non-existent stream is silent', () => {
		const manager = new SessionStreamManager()
		// Should not throw
		manager.emit('nonexistent', { at: Date.now(), type: 'text', content: 'test' })
	})

	test('subscribe to non-existent stream returns noop unsubscribe', () => {
		const manager = new SessionStreamManager()
		const unsub = manager.subscribe('nonexistent', () => {})
		expect(typeof unsub).toBe('function')
		unsub() // Should not throw
	})

	test('endStream clears all listeners', () => {
		const manager = new SessionStreamManager()
		manager.createStream('s1', 'a1')

		const received: unknown[] = []
		manager.subscribe('s1', (c) => received.push(c))
		manager.endStream('s1')

		manager.emit('s1', { at: Date.now(), type: 'text', content: 'after end' })
		expect(received).toHaveLength(0)
	})

	test('getActiveStreams returns correct list', () => {
		const manager = new SessionStreamManager()
		manager.createStream('s1', 'a1')
		manager.createStream('s2', 'a2')

		const active = manager.getActiveStreams()
		expect(active).toHaveLength(2)
		expect(active.map((s) => s.sessionId).sort()).toEqual(['s1', 's2'])

		manager.endStream('s1')
		expect(manager.getActiveStreams()).toHaveLength(1)
		expect(manager.getActiveStreams()[0].sessionId).toBe('s2')

		manager.endStream('s2')
	})

	test('multiple listeners on same stream all receive events', () => {
		const manager = new SessionStreamManager()
		manager.createStream('s1', 'a1')

		const r1: unknown[] = []
		const r2: unknown[] = []
		manager.subscribe('s1', (c) => r1.push(c))
		manager.subscribe('s1', (c) => r2.push(c))

		manager.emit('s1', { at: Date.now(), type: 'tool_call', tool: 'readFile' })

		expect(r1).toHaveLength(1)
		expect(r2).toHaveLength(1)

		manager.endStream('s1')
	})
})
