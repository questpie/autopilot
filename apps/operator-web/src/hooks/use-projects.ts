import { deleteProject, getProjects, registerProject } from '@/api/projects.api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export const projectKeys = {
	all: ['projects'] as const,
	list: () => ['projects', 'list'] as const,
}

export function useProjects() {
	return useQuery({
		queryKey: projectKeys.list(),
		queryFn: getProjects,
	})
}

export function useRegisterProject() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: registerProject,
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: projectKeys.all })
			await queryClient.invalidateQueries({ queryKey: ['config'] })
		},
	})
}

export function useDeleteProject() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: deleteProject,
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: projectKeys.all })
			await queryClient.invalidateQueries({ queryKey: ['config'] })
		},
	})
}
