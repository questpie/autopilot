import { useQuery } from '@tanstack/react-query'
import type { TypeDefinition } from '@/lib/renderer-registry'

export const typeKeys = {
  all: ['types'] as const,
}

export function useTypes() {
  return useQuery({
    queryKey: typeKeys.all,
    queryFn: async () => {
      const res = await fetch('/api/types', { credentials: 'include' })
      if (!res.ok) throw new Error(`Failed to fetch types: ${res.status}`)
      return res.json() as Promise<{ types: TypeDefinition[] }>
    },
  })
}

export function useType(typeId: string | null | undefined) {
  const typesQuery = useTypes()
  const type = typesQuery.data?.types.find((t) => t.id === typeId)
  return { data: type, isLoading: typesQuery.isLoading }
}
