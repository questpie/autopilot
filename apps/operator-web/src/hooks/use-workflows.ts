import { useQuery } from '@tanstack/react-query'
import { getWorkflows } from '@/api/workflows.api'

export const workflowKeys = {
  all: ['workflows'] as const,
}

export function useWorkflows() {
  return useQuery({
    queryKey: workflowKeys.all,
    queryFn: getWorkflows,
  })
}
