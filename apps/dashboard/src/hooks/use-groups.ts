import { useQuery } from '@tanstack/react-query'
import { apiFetch, queryKeys } from '@/lib/api'
import type { DashboardGroups } from '@/lib/types'

export function useGroups() {
	return useQuery({
		queryKey: queryKeys.groups,
		queryFn: () => apiFetch<DashboardGroups>('/api/groups'),
	})
}
