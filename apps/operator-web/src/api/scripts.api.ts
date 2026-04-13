/**
 * Scripts API — wired to GET /api/scripts.
 * Returns standalone script definitions from authored config.
 */
import type { Script } from './types'
import { apiFetch, ApiError } from '@/lib/api-client'

export async function getScripts(): Promise<Script[]> {
  return apiFetch<Script[]>('/api/scripts')
}

export async function getScript(id: string): Promise<Script | null> {
  try {
    return await apiFetch<Script>(`/api/scripts/${encodeURIComponent(id)}`)
  } catch (err: unknown) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}
