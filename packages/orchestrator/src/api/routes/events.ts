import { Hono } from 'hono'
import { describeRoute } from 'hono-openapi'
import { eventBus } from '../../events'
import type { AutopilotEvent } from '../../events'
import type { AppEnv } from '../app'

const events = new Hono<AppEnv>()

events.get(
	'/',
	describeRoute({
		tags: ['events'],
		description: 'Server-Sent Events stream of real-time autopilot events with 30s heartbeat',
		responses: {
			200: { description: 'SSE stream' },
		},
	}),
	async (c) => {
		const { readable, writable } = new TransformStream()
		const writer = writable.getWriter()
		const encoder = new TextEncoder()

		function send(data: string): void {
			writer.write(encoder.encode(`data: ${data}\n\n`)).catch(() => {
				// client disconnected — ignore write errors
			})
		}

		// Subscribe to all autopilot events
		const unsubscribe = eventBus.subscribe((event: AutopilotEvent) => {
			send(JSON.stringify(event))
		})

		// Heartbeat every 30 seconds to keep the connection alive
		const heartbeat = setInterval(() => {
			send(JSON.stringify({ type: 'heartbeat', ts: new Date().toISOString() }))
		}, 30_000)

		// Clean up on client disconnect
		c.req.raw.signal.addEventListener('abort', () => {
			clearInterval(heartbeat)
			unsubscribe()
			writer.close().catch(() => {})
		})

		return new Response(readable, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive',
			},
		})
	},
)

export { events }
