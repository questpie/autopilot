/**
 * VFS API — wired to /api/vfs endpoints.
 * All endpoints require user auth (session cookie).
 */
import type { VfsListResult, VfsStatResult, VfsDiffResult } from './types'
import { apiFetch, ApiError } from '@/lib/api-client'

export function vfsList(uri: string): Promise<VfsListResult> {
  return apiFetch<VfsListResult>(`/api/vfs/list?uri=${encodeURIComponent(uri)}`)
}

export function vfsStat(uri: string): Promise<VfsStatResult> {
  return apiFetch<VfsStatResult>(`/api/vfs/stat?uri=${encodeURIComponent(uri)}`)
}

export interface VfsReadResult {
  content: string
  contentType: string
  size: number | null
}

export function vfsDiff(uri: string, includeDirty = true): Promise<VfsDiffResult> {
  const params = new URLSearchParams({ uri, include_dirty: String(includeDirty) })
  return apiFetch<VfsDiffResult>(`/api/vfs/diff?${params}`)
}

export async function vfsRead(uri: string): Promise<VfsReadResult> {
  const res = await fetch(`/api/vfs/read?uri=${encodeURIComponent(uri)}`, { credentials: 'include' })
  if (!res.ok) {
    throw new ApiError(res.status, res.statusText)
  }
  const content = await res.text()
  const contentType = res.headers.get('content-type') ?? 'application/octet-stream'
  const sizeHeader = res.headers.get('x-vfs-size')
  const size = sizeHeader ? Number(sizeHeader) : null
  return { content, contentType, size }
}
