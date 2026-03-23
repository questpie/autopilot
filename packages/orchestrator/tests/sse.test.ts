import { describe, it, expect } from 'bun:test'
import { eventBus } from '../src/events/event-bus'

describe('SSE endpoint', () => {
	it('should deliver events through eventBus subscription', async () => {
		const received: unknown[] = []
		const unsubscribe = eventBus.subscribe((event) => {
			received.push(event)
		})

		eventBus.emit({ type: 'pin_changed', pinId: 'pin-42', action: 'created' })
		eventBus.emit({ type: 'task_changed', taskId: 'task-1', status: 'active' })

		expect(received).toHaveLength(2)
		expect(received[0]).toEqual({ type: 'pin_changed', pinId: 'pin-42', action: 'created' })
		expect(received[1]).toEqual({ type: 'task_changed', taskId: 'task-1', status: 'active' })

		unsubscribe()

		// After unsubscribe, no more events
		eventBus.emit({ type: 'pin_changed', pinId: 'pin-99', action: 'removed' })
		expect(received).toHaveLength(2)
	})

	it('should format events as SSE data lines', () => {
		const event = { type: 'pin_changed', pinId: 'pin-42', action: 'created' }
		const sseData = `data: ${JSON.stringify(event)}\n\n`

		expect(sseData).toContain('data:')
		expect(sseData).toContain('pin_changed')
		expect(sseData).toContain('pin-42')
		expect(sseData.endsWith('\n\n')).toBe(true)
	})
})
