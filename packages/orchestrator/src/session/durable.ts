import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { logger } from '../logger'

/**
 * Durable Streams integration for persistent, resumable session streams.
 *
 * The durable-streams-server binary is installed alongside Autopilot
 * (via the install script or `autopilot init`). On `autopilot start`,
 * we spawn it as a child process.
 *
 * @see https://durablestreams.com/quickstart
 */

const DEFAULT_PORT = 4437
const DURABLE_STREAMS_URL = process.env.DURABLE_STREAMS_URL ?? `http://127.0.0.1:${process.env.DURABLE_STREAMS_PORT ?? DEFAULT_PORT}`

let serverProcess: ChildProcess | null = null

/**
 * Start the durable-streams-server binary as a child process.
 *
 * Looks for the binary in:
 * 1. `DURABLE_STREAMS_BIN` env var
 * 2. `<companyRoot>/.bin/durable-streams-server`
 * 3. System PATH (`durable-streams-server`)
 *
 * If DURABLE_STREAMS_URL is set, assumes an external server and skips.
 */
export async function startDurableStreamServer(companyRoot: string): Promise<void> {
	// Skip if external server is configured
	if (process.env.DURABLE_STREAMS_URL) {
		logger.info('durable-streams', `using external server at ${DURABLE_STREAMS_URL}`)
		return
	}

	const port = process.env.DURABLE_STREAMS_PORT ?? String(DEFAULT_PORT)
	const dataDir = join(companyRoot, '.data', 'streams')

	// Find binary
	const binPaths = [
		process.env.DURABLE_STREAMS_BIN,
		join(companyRoot, '.bin', 'durable-streams-server'),
		'durable-streams-server', // system PATH
	].filter(Boolean) as string[]

	const binPath = binPaths.find((p) => p === 'durable-streams-server' || existsSync(p))

	if (!binPath) {
		logger.warn('durable-streams', 'binary not found — sessions use in-memory only. Run: autopilot init --install-streams')
		return
	}

	try {
		serverProcess = spawn(binPath, ['--port', port, '--data-dir', dataDir], {
			stdio: ['ignore', 'pipe', 'pipe'],
			detached: false,
		})

		serverProcess.stdout?.on('data', (data: Buffer) => {
			const msg = data.toString().trim()
			if (msg) logger.debug('durable-streams', msg)
		})

		serverProcess.stderr?.on('data', (data: Buffer) => {
			const msg = data.toString().trim()
			if (msg) logger.warn('durable-streams', msg)
		})

		serverProcess.on('exit', (code) => {
			if (code !== 0 && code !== null) {
				logger.error('durable-streams', `server exited with code ${code}`)
			}
			serverProcess = null
		})

		// Wait briefly for server to start
		await new Promise((resolve) => setTimeout(resolve, 500))

		logger.info('durable-streams', `server started on port ${port} (data: ${dataDir})`)
	} catch (err) {
		logger.warn('durable-streams', 'failed to start server', {
			error: err instanceof Error ? err.message : String(err),
		})
	}
}

/**
 * Stop the durable-streams-server process.
 */
export function stopDurableStreamServer(): void {
	if (serverProcess) {
		serverProcess.kill('SIGTERM')
		serverProcess = null
		logger.info('durable-streams', 'server stopped')
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
	try {
		const resp = await fetch(getSessionStreamUrl(sessionId), {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
		})
		if (!resp.ok && resp.status !== 409) {
			logger.warn('durable-streams', `failed to create stream for ${sessionId}: ${resp.status}`)
		}
	} catch {
		// Server not available — degrade gracefully
	}
}

export async function appendToSessionStream(sessionId: string, chunk: unknown): Promise<void> {
	try {
		await fetch(getSessionStreamUrl(sessionId), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(chunk),
		})
	} catch {
		// Fire-and-forget
	}
}

export async function steerSession(sessionId: string, message: string, from: string = 'user'): Promise<void> {
	await appendToSessionStream(sessionId, {
		type: 'user_steer',
		from,
		content: message,
		at: Date.now(),
	})
}
