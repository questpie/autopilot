import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Schedule } from '@/api/types'
import { getSchedules, getSchedule, toggleSchedule, triggerSchedule } from '@/api/schedules.api'

export const scheduleKeys = {
  all: ['schedules'] as const,
  detail: (id: string) => ['schedules', id] as const,
}

export function useSchedules() {
  return useQuery({
    queryKey: scheduleKeys.all,
    queryFn: () => getSchedules(),
  })
}

export function useScheduleDetail(id: string | null) {
  return useQuery({
    queryKey: scheduleKeys.detail(id!),
    queryFn: () => getSchedule(id!),
    enabled: id !== null,
  })
}

export function useToggleSchedule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => toggleSchedule(id, enabled),
    onMutate: async ({ id, enabled }) => {
      await queryClient.cancelQueries({ queryKey: scheduleKeys.all })
      const previous = queryClient.getQueryData<Schedule[]>(scheduleKeys.all)
      queryClient.setQueryData<Schedule[]>(scheduleKeys.all, (old) =>
        old?.map((s) => (s.id === id ? { ...s, enabled } : s)),
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(scheduleKeys.all, context.previous)
      }
    },
    onSettled: (_data, _err, { id }) => {
      void queryClient.invalidateQueries({ queryKey: scheduleKeys.all })
      void queryClient.invalidateQueries({ queryKey: scheduleKeys.detail(id) })
    },
  })
}

export function useTriggerSchedule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => triggerSchedule(id),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: scheduleKeys.detail(id) })
    },
  })
}
