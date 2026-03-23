import { useQuery } from '@tanstack/react-query'
import { apiFetch, queryKeys, REFETCH } from '@/lib/api'
import type { Pin } from '@/lib/types'

export function usePins() {
	return useQuery({
		queryKey: queryKeys.pins,
		queryFn: () => apiFetch<Pin[]>('/api/pins'),
		refetchInterval: REFETCH.pins,
	})
}
