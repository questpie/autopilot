import { join } from 'node:path'
import { DurableStreamTestServer } from '@durable-streams/server'
import { logger } from '../logger'

/**
 * Durable Streams — persistent, resumable session streams.
 *
 * Uses @durable-streams/server directly as a JS dependency (no external binary).
 * File-backed storage for persistence across restarts.
 */

const DEFAULT_PORT = 4437

const DURABLE_STREAMS_URL = process.env.DURABLE_STREAMS_URL
	?? `http://127.0.0.1:${process.env.DURABLE_STREAMS_PORT ?? DEFAULT_PORT}`

let server: DurableStreamTestServer | null = null

/**
 * Start the durable streams server in-process.
 *
 * If DURABLE_STREAMS_URL is set, assumes an external server and skips.
 */
export async function startDurableStreamServer(companyRoot: string): Promise<void> {
	if (process.env.DURABLE_STREAMS_URL) {
		logger.info('durable-streams', `using external server at ${DURABLE_STREAMS_URL}`)
		return
	}

	const port = Number(process.env.DURABLE_STREAMS_PORT ?? DEFAULT_PORT)
	const dataDir = join(companyRoot, '.data', 'streams')

	server = new DurableStreamTestServer({
		port,
		host: '127.0.0.1',
		dataDir,
	})

	await server.start()
	logger.info('durable-streams', `server started on port ${port} (data: ${dataDir})`)
}

/**
 * Stop the durable streams server.
 */
export async function stopDurableStreamServer(): Promise<void> {
	if (server) {
		await server.stop()
		server = null
		logger.info('durable-streams', 'server stopped')
	}
}

/**
 * Health check for durable streams server.
 */
export async function checkDurableStreamHealth(): Promise<{ ok: boolean; latencyMs?: number }> {
	const start = Date.now()
	try {
		const resp = await fetch(`${DURABLE_STREAMS_URL}/health`, { signal: AbortSignal.timeout(5000) })
		return { ok: resp.ok, latencyMs: Date.now() - start }
	} catch {
		return { ok: false, latencyMs: Date.now() - start }
	}
}

// ── Stream operations ─────────────────────────────────────────────────────

export function getDurableStreamBaseUrl(): string {
	return DURABLE_STREAMS_URL
}

export function getSessionStreamUrl(sessionId: string): string {
	return `${DURABLE_STREAMS_URL}/v1/stream/sessions/${encodeURIComponent(sessionId)}`
}

export async function createSessionStream(sessionId: string): Promise<void> {
	const resp = await fetch(getSessionStreamUrl(sessionId), {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
	})
	if (!resp.ok && resp.status !== 409) {
		throw new Error(`Failed to create stream for ${sessionId}: ${resp.status}`)
	}
}

export async function appendToSessionStream(sessionId: string, chunk: unknown): Promise<void> {
	await fetch(getSessionStreamUrl(sessionId), {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(chunk),
	})
}

export async function steerSession(sessionId: string, message: string, from: string = 'user'): Promise<void> {
	await appendToSessionStream(sessionId, {
		type: 'user_steer',
		from,
		content: message,
		at: Date.now(),
	})
}
