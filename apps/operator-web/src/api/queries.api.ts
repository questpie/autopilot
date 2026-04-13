/**
 * Queries API — wired to /api/queries.
 */
import type { Query } from './types'
import { apiFetch } from '@/lib/api-client'

export async function getQueries(filters?: { status?: string; agent_id?: string }): Promise<Query[]> {
  const params = new URLSearchParams()
  if (filters?.status) params.set('status', filters.status)
  if (filters?.agent_id) params.set('agent_id', filters.agent_id)
  const qs = params.toString()
  return apiFetch<Query[]>(`/api/queries${qs ? `?${qs}` : ''}`)
}
