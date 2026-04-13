import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getRuns, getRun, steerRun } from '@/api/runs.api'

export const runKeys = {
  all: ['runs'] as const,
  list: (filters?: { status?: string }) => ['runs', 'list', filters] as const,
  detail: (id: string) => ['runs', id] as const,
}

export function useRuns(filters?: { status?: string; agent_id?: string; task_id?: string }) {
  return useQuery({
    queryKey: runKeys.list(filters),
    queryFn: () => getRuns(filters),
  })
}

export function useRunDetail(id: string | null) {
  return useQuery({
    queryKey: runKeys.detail(id!),
    queryFn: () => getRun(id!),
    enabled: id !== null,
  })
}

export function useSteerRun() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ runId, message }: { runId: string; message: string }) => steerRun(runId, message),
    onSuccess: (_data, { runId }) => {
      void queryClient.invalidateQueries({ queryKey: runKeys.detail(runId) })
    },
  })
}
