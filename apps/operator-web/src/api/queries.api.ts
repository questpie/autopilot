import type { Query } from './types'
import { api } from '@/lib/api'

export async function getQueries(filters?: { status?: string; agent_id?: string }): Promise<Query[]> {
  const query: Record<string, string> = {}
  if (filters?.status) query.status = filters.status
  if (filters?.agent_id) query.agent_id = filters.agent_id
  const res = await api.api.queries.$get({ query })
  if (!res.ok) throw new Error(`Failed to list queries: ${res.status}`)
  return res.json() as Promise<Query[]>
}
