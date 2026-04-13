import { useQuery } from '@tanstack/react-query'
import { getQueries } from '@/api/queries.api'

export const queryKeys = {
  all: ['queries'] as const,
  list: (filters?: { status?: string; agent_id?: string }) => ['queries', 'list', filters] as const,
}

export function useQueryList(filters?: { status?: string; agent_id?: string }) {
  return useQuery({
    queryKey: queryKeys.list(filters),
    queryFn: () => getQueries(filters),
  })
}
