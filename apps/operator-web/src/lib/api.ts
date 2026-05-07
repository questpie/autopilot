/**
 * Hono RPC client for operator-web.
 *
 * API modules keep explicit response types locally so operator-web typecheck does
 * not pull the Bun-only orchestrator source into the browser TypeScript program.
 * Config endpoints (/api/config/*) are NOT in the typed chain — they use `configFetch`.
 * Binary endpoints (workspace-inspection/read, knowledge raw reads) use raw fetch for response header access.
 */
import { hc } from 'hono/client'

export const api: any = hc('/', { init: { credentials: 'include' } })

/**
 * Lightweight fetch for endpoints not in the Hono typed route chain
 * (/api/config/*, /api/health, /api/status).
 */
export async function configFetch<T>(path: string): Promise<T> {
	const res = await fetch(path, { credentials: 'include' })
	if (!res.ok) {
		throw new ApiError(res.status, res.statusText, await res.json().catch(() => undefined))
	}
	return res.json() as Promise<T>
}

export class ApiError extends Error {
	constructor(
		public readonly status: number,
		public readonly statusText: string,
		public readonly body?: unknown,
	) {
		super(`API ${status}: ${statusText}`)
		this.name = 'ApiError'
	}
}
