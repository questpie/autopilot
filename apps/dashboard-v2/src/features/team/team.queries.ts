import { queryOptions } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query-keys"

export const agentsQuery = queryOptions({
  queryKey: queryKeys.agents.list(),
  queryFn: async () => {
    const res = await api.api.agents.$get()
    if (!res.ok) throw new Error("Failed to fetch agents")
    return res.json()
  },
})

export function agentDetailQuery(id: string) {
  return queryOptions({
    queryKey: queryKeys.agents.detail(id),
    queryFn: async () => {
      const res = await api.api.agents[":id"].$get({
        param: { id },
      })
      if (!res.ok) throw new Error("Failed to fetch agent detail")
      return res.json()
    },
    enabled: !!id,
  })
}

