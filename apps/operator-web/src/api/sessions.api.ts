import type { Session } from './types'
import { api } from '@/lib/api'

export async function getSessions(filters?: { provider_id?: string; status?: string; mode?: string }): Promise<Session[]> {
  const query: Record<string, string> = {}
  if (filters?.provider_id) query.provider_id = filters.provider_id
  if (filters?.status) query.status = filters.status
  if (filters?.mode) query.mode = filters.mode

  const res = await api.api.sessions.$get({ query })
  if (!res.ok) throw new Error(`Failed to fetch sessions: ${res.status}`)
  return res.json() as Promise<Session[]>
}
