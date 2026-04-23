import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createTask, getTasks, getTaskRelations, getTaskDetail, getTaskActivity, getTaskArtifacts, approveTask, rejectTask, replyTask, retryTask, cancelTask, type CreateTaskInput } from '@/api/tasks.api'
import { chatSessionKeys } from './use-chat-sessions'
import { queryKeys } from './use-queries'
import { runKeys } from './use-runs'

export const taskKeys = {
  all: ['tasks'] as const,
  list: (filters?: { status?: string }) => ['tasks', 'list', filters] as const,
  relations: ['tasks', 'relations'] as const,
  detail: (id: string) => ['tasks', id] as const,
  activity: (id: string) => ['tasks', id, 'activity'] as const,
  artifacts: (id: string) => ['tasks', id, 'artifacts'] as const,
}

function invalidateTaskSideEffects(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: taskKeys.all })
  void queryClient.invalidateQueries({ queryKey: chatSessionKeys.all })
  void queryClient.invalidateQueries({ queryKey: queryKeys.all })
  void queryClient.invalidateQueries({ queryKey: runKeys.all })
}

export function useTasks(filters?: { status?: string; assigned_to?: string; workflow_id?: string }) {
  return useQuery({
    queryKey: taskKeys.list(filters),
    queryFn: () => getTasks(filters),
  })
}

export function useCreateTask() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (input: CreateTaskInput) => createTask(input),
		onSuccess: () => {
			invalidateTaskSideEffects(queryClient)
		},
	})
}

export function useTaskRelations() {
  return useQuery({
    queryKey: taskKeys.relations,
    queryFn: () => getTaskRelations('decomposes_to'),
  })
}

export function useTaskDetail(id: string | null) {
  return useQuery({
    queryKey: taskKeys.detail(id!),
    queryFn: () => getTaskDetail(id!),
    enabled: id !== null,
  })
}

export function useTaskActivity(id: string | null) {
  return useQuery({
    queryKey: taskKeys.activity(id!),
    queryFn: () => getTaskActivity(id!),
    enabled: id !== null,
  })
}

export function useTaskArtifacts(id: string | null) {
  return useQuery({
    queryKey: taskKeys.artifacts(id!),
    queryFn: () => getTaskArtifacts(id!),
    enabled: id !== null,
  })
}

export function useApproveTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => approveTask(id),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.detail(id) })
      void queryClient.invalidateQueries({ queryKey: taskKeys.activity(id) })
      invalidateTaskSideEffects(queryClient)
    },
  })
}

export function useRejectTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, message }: { id: string; message: string }) => rejectTask(id, message),
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.detail(id) })
      void queryClient.invalidateQueries({ queryKey: taskKeys.activity(id) })
      invalidateTaskSideEffects(queryClient)
    },
  })
}

export function useReplyTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, message }: { id: string; message: string }) => replyTask(id, message),
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.detail(id) })
      void queryClient.invalidateQueries({ queryKey: taskKeys.activity(id) })
      invalidateTaskSideEffects(queryClient)
    },
  })
}

export function useRetryTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => retryTask(id),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.detail(id) })
      void queryClient.invalidateQueries({ queryKey: taskKeys.activity(id) })
      invalidateTaskSideEffects(queryClient)
    },
  })
}

export function useCancelTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => cancelTask(id, reason),
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.detail(id) })
      void queryClient.invalidateQueries({ queryKey: taskKeys.activity(id) })
      invalidateTaskSideEffects(queryClient)
    },
  })
}
