import { useQuery } from '@tanstack/react-query'
import { apiFetch, queryKeys } from '@/lib/api'
import type { OrchestratorStatus } from '@/lib/types'

export function useStatus() {
	return useQuery({
		queryKey: queryKeys.status,
		queryFn: () => apiFetch<OrchestratorStatus>('/api/status'),
	})
}
