import { join } from 'node:path'
import { DurableStreamTestServer } from '@durable-streams/server'
import { env } from '../env'
import { logger } from '../logger'

/**
 * Durable Streams — persistent, resumable session streams.
 *
 * Uses @durable-streams/server directly as a JS dependency (no external binary).
 * File-backed storage for persistence across restarts.
 */

const DEFAULT_PORT = 4437

let server: DurableStreamTestServer | null = null

function getDurableStreamsConfig() {
	const port = env.DURABLE_STREAMS_PORT ?? DEFAULT_PORT
	return {
		port,
		url: env.DURABLE_STREAMS_URL ?? `http://127.0.0.1:${port}`,
		externalUrl: env.DURABLE_STREAMS_URL,
	}
}

/**
 * Start the durable streams server in-process.
 *
 * If DURABLE_STREAMS_URL is set, assumes an external server and skips.
 */
export async function startDurableStreamServer(companyRoot: string): Promise<void> {
	const config = getDurableStreamsConfig()
	if (config.externalUrl) {
		logger.info('durable-streams', `using external server at ${config.url}`)
		return
	}

	const dataDir = join(companyRoot, '.data', 'streams')

	server = new DurableStreamTestServer({
		port: config.port,
		host: '127.0.0.1',
		dataDir,
	})

	await server.start()
	logger.info('durable-streams', `server started on port ${config.port} (data: ${dataDir})`)
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
	const { url } = getDurableStreamsConfig()
	try {
		const resp = await fetch(`${url}/health`, { signal: AbortSignal.timeout(5000) })
		return { ok: resp.ok, latencyMs: Date.now() - start }
	} catch {
		return { ok: false, latencyMs: Date.now() - start }
	}
}

// ── Stream operations ─────────────────────────────────────────────────────

export function getDurableStreamBaseUrl(): string {
	return getDurableStreamsConfig().url
}

export function getSessionStreamUrl(sessionId: string): string {
	return `${getDurableStreamsConfig().url}/v1/stream/sessions/${encodeURIComponent(sessionId)}`
}

export async function createSessionStream(sessionId: string): Promise<void> {
	try {
		const resp = await fetch(getSessionStreamUrl(sessionId), {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
		})
		if (!resp.ok && resp.status !== 409) {
			throw new Error(`Failed to create stream for ${sessionId}: ${resp.status}`)
		}
	} catch (error) {
		logger.warn('durable-streams', `create stream failed for ${sessionId}`, {
			error: error instanceof Error ? error.message : String(error),
		})
	}
}

export async function appendToSessionStream(sessionId: string, chunk: unknown): Promise<void> {
	try {
		const resp = await fetch(getSessionStreamUrl(sessionId), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(chunk),
		})
		if (!resp.ok) {
			logger.warn('durable-streams', `append failed for ${sessionId}: ${resp.status}`)
		}
	} catch (error) {
		logger.warn('durable-streams', `append failed for ${sessionId}`, {
			error: error instanceof Error ? error.message : String(error),
		})
	}
}
