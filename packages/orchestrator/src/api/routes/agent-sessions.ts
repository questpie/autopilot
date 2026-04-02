/**
 * Agent session stream routes — proxy to Durable Streams server.
 *
 * GET /agent-sessions/:id/stream → proxy read from durable stream (SSE live tailing)
 */
import { Hono } from 'hono'
import { describeRoute } from 'hono-openapi'
import { validator as zValidator } from 'hono-openapi'
import { z } from 'zod'
import { getDurableStreamBaseUrl } from '../../session/durable'
import type { AppEnv } from '../app'

const StreamQuerySchema = z.object({
	offset: z.string().optional(),
	live: z.string().optional(),
})

function normalizeStreamOffset(offset: string | undefined): string {
	if (!offset || offset.trim() === '' || offset === '0') {
		return '-1'
	}

	return offset
}

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
		zValidator('query', StreamQuerySchema),
		async (c) => {
			const sessionId = c.req.param('id')
			const { offset: rawOffset, live: queryLive } = c.req.valid('query')
			const baseUrl = getDurableStreamBaseUrl()
			const streamUrl = `${baseUrl}/v1/stream/sessions/${encodeURIComponent(sessionId)}`

			const url = new URL(streamUrl)
			const queryOffset = normalizeStreamOffset(rawOffset)
			url.searchParams.set('offset', queryOffset)
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

export { agentSessions }
