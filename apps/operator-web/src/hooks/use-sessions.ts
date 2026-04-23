import { useQuery } from '@tanstack/react-query'
import { getSessions } from '@/api/sessions.api'

export const sessionKeys = {
  all: ['sessions'] as const,
  list: (filters?: { provider_id?: string; status?: string; mode?: string }) => ['sessions', 'list', filters] as const,
}

export function useSessions(filters?: { provider_id?: string; status?: string; mode?: string }) {
  return useQuery({
    queryKey: sessionKeys.list(filters),
    queryFn: () => getSessions(filters),
  })
}
