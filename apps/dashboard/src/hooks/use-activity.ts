import { useQuery } from '@tanstack/react-query'
import { apiFetch, queryKeys, REFETCH } from '@/lib/api'
import type { ActivityEntry } from '@/lib/types'

export function useActivity(agent?: string) {
	return useQuery({
		queryKey: queryKeys.activity(agent),
		queryFn: () => {
			const params = agent ? `?agent=${agent}` : ''
			return apiFetch<ActivityEntry[]>(`/api/activity${params}`)
		},
		refetchInterval: REFETCH.activity,
	})
}
