import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getTasks, getTaskDetail, getTaskActivity, getTaskArtifacts, approveTask, rejectTask } from '@/api/tasks.api'

export const taskKeys = {
  all: ['tasks'] as const,
  list: (filters?: { status?: string }) => ['tasks', 'list', filters] as const,
  detail: (id: string) => ['tasks', id] as const,
  activity: (id: string) => ['tasks', id, 'activity'] as const,
  artifacts: (id: string) => ['tasks', id, 'artifacts'] as const,
}

export function useTasks(filters?: { status?: string; assigned_to?: string; workflow_id?: string }) {
  return useQuery({
    queryKey: taskKeys.list(filters),
    queryFn: () => getTasks(filters),
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
      void queryClient.invalidateQueries({ queryKey: taskKeys.all })
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
      void queryClient.invalidateQueries({ queryKey: taskKeys.all })
    },
  })
}
