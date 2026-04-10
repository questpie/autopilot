import { delay } from './mock/delay'

export interface SearchResult {
  results: unknown[]
  query: string
  scope: string
}

export async function search(
  query: string,
  scope?: string,
): Promise<SearchResult> {
  await delay(120)
  // In real implementation: GET /api/search?q=...&scope=...
  return {
    results: [],
    query,
    scope: scope ?? 'all',
  }
}
