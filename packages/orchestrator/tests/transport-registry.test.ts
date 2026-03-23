import { describe, test, expect, beforeEach } from 'bun:test'
import { TransportRegistry } from '../src/transports/registry'
import type { TransportAdapter } from '../src/transports/registry'

function createMockAdapter(name: string): TransportAdapter {
	return {
		name,
		async send(_to: string, _content: string, _config: Record<string, unknown>): Promise<void> {},
		formatIncoming(payload: unknown) {
			if (!payload || typeof payload !== 'object') return null
			const p = payload as Record<string, string>
			return { from: p.from ?? 'unknown', content: p.content ?? '' }
		},
	}
}

describe('TransportRegistry', () => {
	let registry: TransportRegistry

	beforeEach(() => {
		registry = new TransportRegistry()
	})

	test('register and get an adapter', () => {
		const adapter = createMockAdapter('telegram')
		registry.register(adapter)

		const result = registry.get('telegram')
		expect(result).toBe(adapter)
	})

	test('get returns undefined for unknown adapter', () => {
		expect(registry.get('slack')).toBeUndefined()
	})

	test('has returns true for registered adapter', () => {
		registry.register(createMockAdapter('telegram'))
		expect(registry.has('telegram')).toBe(true)
	})

	test('has returns false for unregistered adapter', () => {
		expect(registry.has('telegram')).toBe(false)
	})

	test('list returns all registered adapter names', () => {
		registry.register(createMockAdapter('telegram'))
		registry.register(createMockAdapter('slack'))
		registry.register(createMockAdapter('email'))

		const names = registry.list()
		expect(names).toEqual(['telegram', 'slack', 'email'])
	})

	test('list returns empty array when no adapters registered', () => {
		expect(registry.list()).toEqual([])
	})

	test('register overwrites existing adapter with same name', () => {
		const adapter1 = createMockAdapter('telegram')
		const adapter2 = createMockAdapter('telegram')

		registry.register(adapter1)
		registry.register(adapter2)

		expect(registry.get('telegram')).toBe(adapter2)
		expect(registry.list()).toEqual(['telegram'])
	})
})
