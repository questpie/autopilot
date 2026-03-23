import { useQuery } from '@tanstack/react-query'
import { apiFetch, queryKeys } from '@/lib/api'
import type { Skill } from '@/lib/types'

export function useSkills() {
	return useQuery({
		queryKey: queryKeys.skills,
		queryFn: () => apiFetch<Skill[]>('/api/skills'),
	})
}
