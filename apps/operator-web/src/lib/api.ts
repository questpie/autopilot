/**
 * Typed Hono RPC client for operator-web.
 *
 * Uses `hc<AppType>` for all endpoints in the orchestrator's typed route chain.
 * Config endpoints (/api/config/*) are NOT in the typed chain — they use `configFetch`.
 * Binary endpoints (vfs/read) use raw fetch for response header access.
 */
import { hc } from 'hono/client'
import type { AppType } from '@questpie/autopilot-orchestrator/api'

export const api = hc<AppType>('/', { init: { credentials: 'include' } })

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
