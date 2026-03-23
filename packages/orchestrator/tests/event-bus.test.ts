import { describe, it, expect } from 'bun:test'
import { EventBus } from '../src/events/event-bus'
import type { AutopilotEvent } from '../src/events/event-bus'

describe('EventBus', () => {
	it('should emit events to subscribers', () => {
		const bus = new EventBus()
		const received: AutopilotEvent[] = []

		bus.subscribe((event) => {
			received.push(event)
		})

		bus.emit({ type: 'task_changed', taskId: 'task-1', status: 'active' })

		expect(received).toHaveLength(1)
		expect(received[0]!.type).toBe('task_changed')
	})

	it('should support multiple listeners', () => {
		const bus = new EventBus()
		let count1 = 0
		let count2 = 0

		bus.subscribe(() => { count1++ })
		bus.subscribe(() => { count2++ })

		bus.emit({ type: 'pin_changed', pinId: 'pin-1', action: 'created' })

		expect(count1).toBe(1)
		expect(count2).toBe(1)
	})

	it('should unsubscribe correctly', () => {
		const bus = new EventBus()
		const received: AutopilotEvent[] = []

		const unsubscribe = bus.subscribe((event) => {
			received.push(event)
		})

		bus.emit({ type: 'task_changed', taskId: 'task-1', status: 'active' })
		expect(received).toHaveLength(1)

		unsubscribe()

		bus.emit({ type: 'task_changed', taskId: 'task-2', status: 'done' })
		expect(received).toHaveLength(1) // no new events
	})

	it('should report listener count', () => {
		const bus = new EventBus()
		expect(bus.listenerCount).toBe(0)

		const unsub1 = bus.subscribe(() => {})
		expect(bus.listenerCount).toBe(1)

		const unsub2 = bus.subscribe(() => {})
		expect(bus.listenerCount).toBe(2)

		unsub1()
		expect(bus.listenerCount).toBe(1)

		unsub2()
		expect(bus.listenerCount).toBe(0)
	})

	it('should not throw when a listener errors', () => {
		const bus = new EventBus()
		const received: AutopilotEvent[] = []

		bus.subscribe(() => {
			throw new Error('boom')
		})
		bus.subscribe((event) => {
			received.push(event)
		})

		bus.emit({ type: 'activity', agent: 'sam', toolName: 'write_file', summary: 'wrote a file' })

		// Second listener should still receive the event
		expect(received).toHaveLength(1)
	})

	it('should handle all event types', () => {
		const bus = new EventBus()
		const received: AutopilotEvent[] = []
		bus.subscribe((event) => { received.push(event) })

		bus.emit({ type: 'task_changed', taskId: 't1', status: 'active' })
		bus.emit({ type: 'message', channel: 'general', from: 'sam', content: 'hello' })
		bus.emit({ type: 'activity', agent: 'sam', toolName: 'read_file', summary: 'read a file' })
		bus.emit({ type: 'pin_changed', pinId: 'p1', action: 'created' })
		bus.emit({ type: 'agent_session', agentId: 'sam', status: 'started', sessionId: 's1' })
		bus.emit({ type: 'workflow_advanced', taskId: 't1', from: 'dev', to: 'review' })

		expect(received).toHaveLength(6)
		expect(received.map(e => e.type)).toEqual([
			'task_changed',
			'message',
			'activity',
			'pin_changed',
			'agent_session',
			'workflow_advanced',
		])
	})
})
