import { useQuery } from '@tanstack/react-query'
import { apiFetch, queryKeys } from '@/lib/api'
import type { Agent } from '@/lib/types'

export function useAgents() {
	return useQuery({
		queryKey: queryKeys.agents,
		queryFn: () => apiFetch<Agent[]>('/api/agents'),
	})
}
