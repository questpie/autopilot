import { queryOptions } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query-keys"

export const inboxQuery = queryOptions({
  queryKey: queryKeys.inbox.list(),
  queryFn: async () => {
    const res = await api.api.inbox.$get()
    if (!res.ok) throw new Error("Failed to fetch inbox")
    return res.json()
  },
})
