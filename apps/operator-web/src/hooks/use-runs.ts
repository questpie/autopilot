import { useQuery } from '@tanstack/react-query'
import { getRuns, getRun, getRunEvents } from '@/api/runs.api'

export const runKeys = {
  all: ['runs'] as const,
  list: (filters?: { status?: string }) => ['runs', 'list', filters] as const,
  detail: (id: string) => ['runs', id] as const,
  events: (id: string) => ['runs', id, 'events'] as const,
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

export function useRunEvents(runId: string | null) {
  return useQuery({
    queryKey: runKeys.events(runId!),
    queryFn: () => getRunEvents(runId!),
    enabled: runId !== null,
  })
}

