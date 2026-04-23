import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteUserPreference, getUserPreferences, setUserPreference } from '@/api/preferences.api'

export const preferenceKeys = {
  all: ['preferences'] as const,
}

export function useUserPreferences(enabled = true) {
  return useQuery({
    queryKey: preferenceKeys.all,
    queryFn: getUserPreferences,
    enabled,
  })
}

export function useSetUserPreference() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: unknown }) => setUserPreference(key, value),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: preferenceKeys.all })
    },
  })
}

export function useDeleteUserPreference() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (key: string) => deleteUserPreference(key),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: preferenceKeys.all })
    },
  })
}
