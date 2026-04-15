import type { VfsListResult, VfsStatResult, VfsDiffResult } from './types'
import { api, ApiError } from '@/lib/api'

function normalizePath(p: string): string {
  return p.replace(/^\.\//, '').replace(/^\/+/, '')
}

export async function vfsList(uri: string): Promise<VfsListResult> {
  const res = await api.api.vfs.list.$get({ query: { uri } })
  if (!res.ok) throw new Error(`Failed to list vfs: ${res.status}`)
  const data = (await res.json()) as VfsListResult
  data.entries = data.entries.map((e) => ({ ...e, path: normalizePath(e.path) }))
  return data
}

export async function vfsStat(uri: string): Promise<VfsStatResult> {
  const res = await api.api.vfs.stat.$get({ query: { uri } })
  if (!res.ok) throw new Error(`Failed to stat vfs: ${res.status}`)
  return res.json() as Promise<VfsStatResult>
}

export interface VfsReadResult {
  content: string
  contentType: string
  size: number | null
}

export async function vfsDiff(uri: string, includeDirty = true): Promise<VfsDiffResult> {
  const include_dirty = includeDirty ? 'true' as const : 'false' as const
  const res = await api.api.vfs.diff.$get({ query: { uri, include_dirty } })
  if (!res.ok) throw new Error(`Failed to fetch vfs diff: ${res.status}`)
  return res.json() as Promise<VfsDiffResult>
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

export async function vfsWrite(uri: string, content: string): Promise<void> {
  const res = await fetch(`/api/vfs/write?uri=${encodeURIComponent(uri)}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    body: content,
  })
  if (!res.ok) {
    throw new ApiError(res.status, res.statusText)
  }
}
