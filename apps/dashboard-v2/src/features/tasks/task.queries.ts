import { queryOptions } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query-keys"

interface TaskFilters {
  status?: string
  agent?: string
  project?: string
}

export function tasksQuery(filters?: TaskFilters) {
  return queryOptions({
    queryKey: queryKeys.tasks.list(filters as Record<string, unknown>),
    queryFn: async () => {
      const res = await api.api.tasks.$get({
        query: {
          status: filters?.status,
          agent: filters?.agent,
          project: filters?.project,
        },
      })
      if (!res.ok) throw new Error("Failed to fetch tasks")
      return res.json()
    },
  })
}

export function taskDetailQuery(id: string) {
  return queryOptions({
    queryKey: queryKeys.tasks.detail(id),
    queryFn: async () => {
      const res = await api.api.tasks[":id"].$get({
        param: { id },
      })
      if (!res.ok) throw new Error("Failed to fetch task")
      return res.json()
    },
    enabled: !!id,
  })
}
