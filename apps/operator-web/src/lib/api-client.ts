/**
 * Minimal API client for operator-web.
 * Uses plain fetch — no hono/client dependency.
 * Vite proxies /api to the orchestrator in dev; in prod the SPA is served by the orchestrator.
 */

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

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: 'include',
  })
  if (!res.ok) {
    let body: unknown
    try {
      body = await res.json()
    } catch (_e: unknown) {
      /* no JSON body */
    }
    throw new ApiError(res.status, res.statusText, body)
  }
  return res.json() as Promise<T>
}
