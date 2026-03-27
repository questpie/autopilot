import { queryOptions } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query-keys"

export function activityQuery(filters?: { agent?: string; limit?: number }) {
  return queryOptions({
    queryKey: queryKeys.activity.list(filters),
    queryFn: async () => {
      const res = await api.api.activity.$get({
        query: {
          agent: filters?.agent,
          limit: filters?.limit?.toString(),
        },
      })
      if (!res.ok) throw new Error("Failed to fetch activity")
      return res.json()
    },
  })
}
