import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch, apiPost, queryKeys } from '@/lib/api'
import type { Artifact } from '@/lib/types'

export function useArtifacts() {
	return useQuery({
		queryKey: queryKeys.artifacts,
		queryFn: async () => {
			const res = await apiFetch<{ artifacts: Artifact[] } | Artifact[]>('/api/artifacts')
			return Array.isArray(res) ? res : res.artifacts
		},
	})
}

export function useStartArtifact() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (id: string) => apiPost(`/api/artifacts/${id}/start`, {}),
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.artifacts })
		},
	})
}

export function useStopArtifact() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (id: string) => apiPost(`/api/artifacts/${id}/stop`, {}),
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.artifacts })
		},
	})
}
