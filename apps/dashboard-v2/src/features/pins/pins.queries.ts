import { queryOptions } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query-keys"

export const pinsQuery = queryOptions({
  queryKey: queryKeys.pins.list(),
  queryFn: async () => {
    const res = await api.api.pins.$get()
    if (!res.ok) throw new Error("Failed to fetch pins")
    return res.json()
  },
})
