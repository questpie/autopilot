/**
 * Agent session stream routes — proxy to Durable Streams server.
 *
 * GET  /agent-sessions/:id/stream  → proxy read from durable stream (SSE live tailing)
 * POST /agent-sessions/:id/steer   → append user message to steer a running session
 */
import { Hono } from 'hono'
import { describeRoute } from 'hono-openapi'
import { validator as zValidator } from 'hono-openapi'
import { z } from 'zod'
import { getDurableStreamBaseUrl, steerSession } from '../../session/durable'
import type { AppEnv } from '../app'

const agentSessions = new Hono<AppEnv>()
	// ── GET /agent-sessions/:id/stream — proxy durable stream read (SSE) ──
	.get(
		'/:id/stream',
		describeRoute({
			tags: ['agent-sessions'],
			description: 'Read an agent session stream via Durable Streams (supports SSE live tailing)',
			responses: {
				200: { description: 'Stream data (SSE or JSON)' },
				502: { description: 'Durable Streams server unavailable' },
			},
		}),
		async (c) => {
			const sessionId = c.req.param('id')
			const baseUrl = getDurableStreamBaseUrl()
			const streamUrl = `${baseUrl}/v1/stream/sessions/${encodeURIComponent(sessionId)}`

			// Forward query params (offset, live=sse, etc.)
			const url = new URL(streamUrl)
			const queryOffset = c.req.query('offset')
			const queryLive = c.req.query('live')
			if (queryOffset) url.searchParams.set('offset', queryOffset)
			if (queryLive) url.searchParams.set('live', queryLive)

			try {
				const resp = await fetch(url.toString(), {
					headers: { 'Accept': 'text/event-stream' },
				})

				if (!resp.ok) {
					return c.json({ error: `Durable stream error: ${resp.status}` }, 502)
				}

				// Proxy the response as-is (SSE or plain)
				return new Response(resp.body, {
					status: resp.status,
					headers: {
						'Content-Type': resp.headers.get('Content-Type') ?? 'text/event-stream',
						'Cache-Control': 'no-cache',
						'Connection': 'keep-alive',
						...(resp.headers.get('Stream-Next-Offset')
							? { 'Stream-Next-Offset': resp.headers.get('Stream-Next-Offset')! }
							: {}),
					},
				})
			} catch (err) {
				return c.json({ error: 'Durable Streams server unavailable' }, 502)
			}
		},
	)
	// ── POST /agent-sessions/:id/steer — send a steering message to a running session ──
	.post(
		'/:id/steer',
		describeRoute({
			tags: ['agent-sessions'],
			description: 'Send a message to steer a running agent session',
			responses: {
				200: { description: 'Message sent' },
			},
		}),
		zValidator('json', z.object({
			message: z.string().min(1, 'Message is required'),
		})),
		async (c) => {
			const sessionId = c.req.param('id')
			const { message } = c.req.valid('json')
			const actor = c.get('actor')

			await steerSession(sessionId, message, actor?.name ?? 'user')

			return c.json({ ok: true }, 200)
		},
	)

export { agentSessions }
