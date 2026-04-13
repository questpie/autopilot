import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { searchAll } from '@/api/search.api'
import type { SearchScope } from '@/api/search.api'

export { type SearchScope }

export const searchKeys = {
  search: (query: string, scope?: SearchScope) => ['search', query, scope ?? 'all'] as const,
}

export function useSearch(query: string, scope?: SearchScope) {
  const [debouncedQuery, setDebouncedQuery] = useState(query)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  return useQuery({
    queryKey: searchKeys.search(debouncedQuery, scope),
    queryFn: () => searchAll(debouncedQuery, scope),
    enabled: debouncedQuery.length >= 2,
    staleTime: 10_000,
  })
}
