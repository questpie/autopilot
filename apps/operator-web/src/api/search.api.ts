import { ApiError } from '@/lib/api'

export type SearchScope = 'tasks' | 'runs' | 'context' | 'schedules' | 'all'

export interface SearchResult {
  entityType: string
  entityId: string
  title: string | null
  snippet: string
  rank: number
}

export interface SearchResponse {
  results: SearchResult[]
  query: string
  scope: SearchScope
}

export async function searchAll(query: string, scope?: SearchScope): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q: query })
  if (scope) params.set('scope', scope)
  const res = await fetch(`/api/search?${params.toString()}`, { credentials: 'include' })
  if (!res.ok) {
    throw new ApiError(res.status, res.statusText, await res.json().catch(() => undefined))
  }
  const data = (await res.json()) as SearchResponse
  return data.results
}
