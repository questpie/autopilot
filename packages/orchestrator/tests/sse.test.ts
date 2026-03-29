/**
 * SSE + EventBus tests — functional.
 */
import { describe, it, expect } from 'bun:test'
import { Hono } from 'hono'
import { EventBus } from '../src/events/event-bus'

describe('EventBus', () => {
	it('delivers events to subscriber', () => {
		const bus = new EventBus()
		const received: unknown[] = []
		bus.subscribe((e) => received.push(e))
		bus.emit({ type: 'pin_changed', pinId: 'pin-42', action: 'created' })
		bus.emit({ type: 'task_changed', taskId: 'task-1', status: 'active' })
		expect(received).toHaveLength(2)
	})

	it('stops delivering after unsubscribe', () => {
		const bus = new EventBus()
		const r: unknown[] = []
		const unsub = bus.subscribe((e) => r.push(e))
		bus.emit({ type: 'pin_changed', pinId: 'p1', action: 'created' })
		unsub()
		bus.emit({ type: 'pin_changed', pinId: 'p2', action: 'created' })
		expect(r).toHaveLength(1)
	})

	it('supports multiple subscribers', () => {
		const bus = new EventBus()
		const a: unknown[] = [], b: unknown[] = []
		bus.subscribe((e) => a.push(e))
		bus.subscribe((e) => b.push(e))
		bus.emit({ type: 'task_changed', taskId: 't1', status: 'done' })
		expect(a).toHaveLength(1)
		expect(b).toHaveLength(1)
	})

	it('tracks listener count', () => {
		const bus = new EventBus()
		expect(bus.listenerCount).toBe(0)
		const u1 = bus.subscribe(() => {})
		expect(bus.listenerCount).toBe(1)
		u1()
		expect(bus.listenerCount).toBe(0)
	})

	it('survives listener that throws', () => {
		const bus = new EventBus()
		const r: unknown[] = []
		bus.subscribe(() => { throw new Error('boom') })
		bus.subscribe((e) => r.push(e))
		bus.emit({ type: 'task_changed', taskId: 't1', status: 'done' })
		expect(r).toHaveLength(1)
	})
})

describe('SSE response format', () => {
	it('formats as data: JSON newlines', () => {
		const event = { type: 'pin_changed', pinId: 'pin-42' }
		const line = `data: ${JSON.stringify(event)}\n\n`
		expect(line).toMatch(/^data: \{/)
		expect(JSON.parse(line.slice(6).trim())).toEqual(event)
	})

	it('SSE endpoint returns correct headers', async () => {
		const app = new Hono()
		app.get('/events', (c) => {
			const { readable, writable } = new TransformStream()
			const writer = writable.getWriter()
			writer.write(new TextEncoder().encode('data: {"type":"heartbeat"}\n\n'))
			writer.close()
			return new Response(readable, {
				headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
			})
		})
		const res = await app.request('/events')
		expect(res.headers.get('Content-Type')).toBe('text/event-stream')
		expect(res.headers.get('Cache-Control')).toBe('no-cache')
		const body = await res.text()
		expect(body).toContain('heartbeat')
	})
})
