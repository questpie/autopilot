import { useQuery } from '@tanstack/react-query'
import { getSchedules } from '@/api/schedules.api'

export const scheduleKeys = {
  all: ['schedules'] as const,
  list: (filters?: { enabled?: boolean }) => ['schedules', 'list', filters] as const,
}

export function useSchedules(filters?: { enabled?: boolean }) {
  return useQuery({
    queryKey: scheduleKeys.list(filters),
    queryFn: () => getSchedules(filters),
  })
}
