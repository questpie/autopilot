import { describe, it, expect, afterEach, beforeEach } from 'bun:test'
import { eventBus } from '../src/events/event-bus'
import { ApiServer } from '../src/api/server'
import { createTestCompany } from './helpers'

describe('SSE endpoint', () => {
	let cleanup: () => Promise<void>
	let root: string
	let server: ApiServer
	const port = 17791

	beforeEach(async () => {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup

		await Bun.write(`${root}/company.yaml`, 'name: "Test"\nslug: "test"\n')
		await Bun.write(`${root}/team/agents.yaml`, '[]')

		server = new ApiServer({ companyRoot: root, port })
		await server.start()
	})

	afterEach(async () => {
		server.stop()
		if (cleanup) await cleanup()
	})

	it('should return text/event-stream and deliver events', async () => {
		// Emit an event with a small delay so the stream picks it up
		setTimeout(() => {
			eventBus.emit({ type: 'pin_changed', pinId: 'pin-42', action: 'created' })
		}, 200)

		const controller = new AbortController()
		setTimeout(() => controller.abort(), 3000) // Safety abort

		try {
			const chunks: string[] = []

			const response = await fetch(`http://localhost:${port}/api/events`, {
				signal: controller.signal,
			})

			// Verify headers
			expect(response.headers.get('content-type')).toBe('text/event-stream')
			expect(response.headers.get('cache-control')).toBe('no-cache')

			// Read first chunk
			const reader = response.body!.getReader()
			const decoder = new TextDecoder()
			const { value } = await reader.read()
			const text = decoder.decode(value)
			chunks.push(text)

			expect(text).toContain('data:')
			expect(text).toContain('pin_changed')

			reader.cancel()
		} catch (err) {
			if ((err as Error).name !== 'AbortError') throw err
		}
	}, 5000)
})
