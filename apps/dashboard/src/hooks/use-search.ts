import { apiFetch, queryKeys } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'

export interface SearchResultItem {
	entityType: 'task' | 'message' | 'knowledge' | 'pin' | 'file'
	entityId: string
	title: string | null
	snippet: string
	score: number
}

export interface SearchResponse {
	results: SearchResultItem[]
	query: string
	mode: string
	total: number
}

export function useSearch(query: string, options?: { type?: string; mode?: string }) {
	const params = new URLSearchParams()
	if (query) params.set('q', query)
	if (options?.type) params.set('type', options.type)
	if (options?.mode) params.set('mode', options.mode)

	return useQuery({
		queryKey: ['search', query, options?.type, options?.mode],
		queryFn: () => apiFetch<SearchResponse>(`/api/search?${params.toString()}`),
		enabled: query.length > 1,
		staleTime: 5_000,
	})
}
