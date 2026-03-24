import { toast } from '@/hooks/use-toast'
import { apiFetch, apiPost, apiPut, queryKeys } from '@/lib/api'
import type { Task } from '@/lib/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export function useTasks() {
	return useQuery({
		queryKey: queryKeys.tasks,
		queryFn: () => apiFetch<Task[]>('/api/tasks'),
	})
}

export function useApproveTask() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: (taskId: string) => apiPost(`/api/tasks/${taskId}/approve`, {}),
		onMutate: async (taskId) => {
			await queryClient.cancelQueries({ queryKey: queryKeys.tasks })
			const previous = queryClient.getQueryData<Task[]>(queryKeys.tasks)
			queryClient.setQueryData<Task[]>(queryKeys.tasks, (old) =>
				old?.map((t) => (t.id === taskId ? { ...t, status: 'done' as const } : t)),
			)
			return { previous }
		},
		onError: (_err, _taskId, context) => {
			if (context?.previous) {
				queryClient.setQueryData(queryKeys.tasks, context.previous)
			}
		},
		onSuccess: () => {
			toast('Task approved', 'success')
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.tasks })
		},
	})
}

export function useRejectTask() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: ({ taskId, reason }: { taskId: string; reason: string }) =>
			apiPost(`/api/tasks/${taskId}/reject`, { reason }),
		onSuccess: () => {
			toast('Task rejected', 'warning')
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.tasks })
			queryClient.invalidateQueries({ queryKey: queryKeys.inbox })
		},
	})
}

export function useTask(taskId: string) {
	return useQuery({
		queryKey: queryKeys.task(taskId),
		queryFn: () => apiFetch<Task>(`/api/tasks/${taskId}`),
		enabled: !!taskId,
	})
}

export function useCreateTask() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: (data: {
			title: string
			description?: string
			type?: string
			priority?: string
			assigned_to?: string
			workflow?: string
			labels?: string[]
			project?: string
		}) => apiPost<Task>('/api/tasks', data),
		onSuccess: () => {
			toast('Task created', 'success')
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.tasks })
		},
	})
}

export function useUpdateTaskStatus() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: ({ taskId, status }: { taskId: string; status: string }) =>
			apiPut(`/api/tasks/${taskId}`, { status }),
		onMutate: async ({ taskId, status }) => {
			await queryClient.cancelQueries({ queryKey: queryKeys.tasks })
			const previous = queryClient.getQueryData<Task[]>(queryKeys.tasks)
			queryClient.setQueryData<Task[]>(queryKeys.tasks, (old) =>
				old?.map((t) => (t.id === taskId ? { ...t, status: status as Task['status'] } : t)),
			)
			return { previous }
		},
		onError: (_err, _vars, context) => {
			if (context?.previous) {
				queryClient.setQueryData(queryKeys.tasks, context.previous)
			}
		},
		onSuccess: () => {
			toast('Status updated', 'success')
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.tasks })
		},
	})
}

export function useAddTaskLabel() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: ({ taskId, label }: { taskId: string; label: string }) =>
			apiPost(`/api/tasks/${taskId}/label`, { label }),
		onSettled: (_d, _e, vars) => {
			queryClient.invalidateQueries({ queryKey: queryKeys.task(vars.taskId) })
			queryClient.invalidateQueries({ queryKey: queryKeys.tasks })
		},
	})
}

export function useAddTaskResource() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: ({
			taskId,
			resource,
		}: { taskId: string; resource: { type: string; path: string; label?: string } }) =>
			apiPost(`/api/tasks/${taskId}/link`, resource),
		onSuccess: () => {
			toast('Resource added', 'success')
		},
		onSettled: (_d, _e, vars) => {
			queryClient.invalidateQueries({ queryKey: queryKeys.task(vars.taskId) })
		},
	})
}
