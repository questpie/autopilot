import { queryOptions } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query-keys"

export const channelsQuery = queryOptions({
  queryKey: queryKeys.channels.list(),
  queryFn: async () => {
    const res = await api.api.channels.$get()
    if (!res.ok) throw new Error("Failed to fetch channels")
    return res.json()
  },
})

export function channelDetailQuery(id: string) {
  return queryOptions({
    queryKey: queryKeys.channels.detail(id),
    queryFn: async () => {
      const res = await api.api.channels[":id"].$get({
        param: { id },
      })
      if (!res.ok) throw new Error("Failed to fetch channel")
      return res.json()
    },
    enabled: !!id,
  })
}

export function messagesQuery(channelId: string, limit = 50) {
  return queryOptions({
    queryKey: queryKeys.messages.list({ channel: channelId, limit }),
    queryFn: async () => {
      const res = await api.api.channels[":id"].messages.$get({
        param: { id: channelId },
        query: { limit: limit.toString() },
      })
      if (!res.ok) throw new Error("Failed to fetch messages")
      return res.json()
    },
    enabled: !!channelId,
  })
}

export function channelMembersQuery(channelId: string) {
  return queryOptions({
    queryKey: queryKeys.channels.detail(`${channelId}-members`),
    queryFn: async () => {
      const res = await api.api.channels[":id"].members.$get({
        param: { id: channelId },
      })
      if (!res.ok) throw new Error("Failed to fetch members")
      return res.json()
    },
    enabled: !!channelId,
  })
}
