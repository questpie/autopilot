/**
 * SSE transport for Durable Streams via Hono client.
 *
 * The Hono client returns a standard Response — we grab its body
 * reader for incremental SSE parsing. All HTTP calls go through the
 * typed `api` client (credentials + SSR cookie forwarding included).
 */
import { api } from '@/lib/api'

export interface SseConnection {
	reader: ReadableStreamDefaultReader<Uint8Array>
	streamNextOffset: string | null
}

export async function connectAgentStream(
	sessionId: string,
	offset: string,
	signal: AbortSignal,
): Promise<SseConnection> {
	const response = await api.api['agent-sessions'][':id'].stream.$get(
		{
			param: { id: sessionId },
			query: { live: 'sse', offset },
		},
		{
			init: {
				signal,
				headers: { Accept: 'text/event-stream' },
			},
		},
	)

	if (!response.ok) {
		const body = await response.text().catch(() => '')
		throw new Error(body || `HTTP ${response.status}`)
	}

	const reader = response.body?.getReader()
	if (!reader) {
		throw new Error('No response body')
	}

	return {
		reader,
		streamNextOffset: response.headers.get('Stream-Next-Offset'),
	}
}
