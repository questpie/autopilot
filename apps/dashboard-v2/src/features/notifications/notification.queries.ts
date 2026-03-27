import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query-keys"

interface NotificationFilters {
  unread?: boolean
  type?: string
  limit?: number
}

export function notificationsQuery(filters?: NotificationFilters) {
  return queryOptions({
    queryKey: queryKeys.notifications.list(filters as Record<string, unknown>),
    queryFn: async () => {
      const res = await api.api.notifications.$get({
        query: {
          unread: filters?.unread ? "true" : undefined,
          type: filters?.type,
          limit: filters?.limit?.toString(),
        },
      })
      if (!res.ok) throw new Error("Failed to fetch notifications")
      return res.json()
    },
    refetchInterval: 60_000,
  })
}

export function unreadNotificationsQuery() {
  return queryOptions({
    queryKey: queryKeys.notifications.list({ unread: true }),
    queryFn: async () => {
      const res = await api.api.notifications.$get({
        query: { unread: "true", limit: "50" },
      })
      if (!res.ok) throw new Error("Failed to fetch unread notifications")
      return res.json()
    },
    refetchInterval: 30_000,
  })
}

export function useMarkRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.api.notifications[":id"].$patch({
        param: { id },
        json: { read: true },
      })
      if (!res.ok) throw new Error("Failed to mark notification as read")
      return res.json()
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.root })
    },
  })
}

export function useMarkAllRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const res = await api.api.notifications["mark-all-read"].$post()
      if (!res.ok) throw new Error("Failed to mark all as read")
      return res.json()
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.root })
    },
  })
}

export function useDismissNotification() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.api.notifications[":id"].$delete({
        param: { id },
      })
      if (!res.ok) throw new Error("Failed to delete notification")
      return res.json()
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.root })
    },
  })
}
