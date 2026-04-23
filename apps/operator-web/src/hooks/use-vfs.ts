import { useQuery } from '@tanstack/react-query'
import { vfsList, vfsRead, vfsDiff, vfsStat } from '@/api/vfs.api'

export const vfsKeys = {
  all: ['vfs'] as const,
  list: (uri: string) => ['vfs', 'list', uri] as const,
  stat: (uri: string) => ['vfs', 'stat', uri] as const,
  read: (uri: string) => ['vfs', 'read', uri] as const,
  diff: (uri: string) => ['vfs', 'diff', uri] as const,
}

export function useVfsList(uri: string | null) {
  return useQuery({
    queryKey: vfsKeys.list(uri!),
    queryFn: () => vfsList(uri!),
    enabled: uri !== null,
  })
}

export function useVfsStat(uri: string | null) {
  return useQuery({
    queryKey: vfsKeys.stat(uri!),
    queryFn: () => vfsStat(uri!),
    enabled: uri !== null,
  })
}

export function useVfsRead(uri: string | null) {
  return useQuery({
    queryKey: vfsKeys.read(uri!),
    queryFn: () => vfsRead(uri!),
    enabled: uri !== null,
  })
}

export function useVfsDiff(uri: string | null) {
  return useQuery({
    queryKey: vfsKeys.diff(uri!),
    queryFn: () => vfsDiff(uri!),
    enabled: uri !== null,
  })
}
