import { useQuery } from '@tanstack/react-query'
import type { ItemRecord } from '@/lib/renderer-registry'

export const itemKeys = {
  all: ['items'] as const,
  detail: (path: string) => ['items', 'detail', path] as const,
  children: (parentPath: string | undefined) => ['items', 'children', parentPath] as const,
  byType: (type: string) => ['items', 'byType', type] as const,
  search: (query: string) => ['items', 'search', query] as const,
}

export function useItem(path: string | undefined) {
  return useQuery({
    queryKey: itemKeys.detail(path!),
    queryFn: async () => {
      const res = await fetch(`/api/items?path=${encodeURIComponent(path!)}`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error(`Failed to fetch item: ${res.status}`)
      return res.json() as Promise<ItemRecord>
    },
    enabled: path != null,
  })
}

export function useItemChildren(parentPath: string | undefined) {
  return useQuery({
    queryKey: itemKeys.children(parentPath),
    queryFn: async () => {
      const params = new URLSearchParams()
      if (parentPath !== undefined) params.set('parent', parentPath)
      const res = await fetch(`/api/items?${params.toString()}`, { credentials: 'include' })
      if (!res.ok) throw new Error(`Failed to fetch items: ${res.status}`)
      return res.json() as Promise<{ items: ItemRecord[]; cursor: string | null }>
    },
    enabled: parentPath !== undefined,
  })
}

export function useItemsByType(type: string) {
  return useQuery({
    queryKey: itemKeys.byType(type),
    queryFn: async () => {
      const res = await fetch(`/api/items?type=${encodeURIComponent(type)}`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error(`Failed to fetch items: ${res.status}`)
      return res.json() as Promise<{ items: ItemRecord[]; cursor: string | null }>
    },
  })
}

export function useItemSearch(query: string) {
  return useQuery({
    queryKey: itemKeys.search(query),
    queryFn: async () => {
      const res = await fetch(`/api/items/search?q=${encodeURIComponent(query)}`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error(`Failed to search: ${res.status}`)
      return res.json() as Promise<{ items: ItemRecord[] }>
    },
    enabled: query.length > 0,
  })
}
