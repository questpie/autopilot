/**
 * VFS adapter for operator-web.
 *
 * Scopes:
 * - company://<path> — business files (Zdroje screen). Readable + writable.
 * - workspace://run/<runId>/<path> — run workspace files (Subory screen). Read-only + diff.
 *
 * Mock adapter. Returns hardcoded data matching API response shapes.
 * Swap to real API: replace with hc<AppType>('/api/vfs').get().$get() (Hono client)
 */

import type { VfsStatResult, VfsListResult, VfsListEntry, VfsDiffResult } from './types'
import { delay } from './mock/delay'

// Mock data for company scope
const COMPANY_FILES: VfsListEntry[] = [
  { name: 'menu-jar-2026.pdf', path: 'menu-jar-2026.pdf', type: 'file', size: 245760, mime_type: 'application/pdf' },
  { name: 'brand-guidelines.pdf', path: 'brand-guidelines.pdf', type: 'file', size: 1258291, mime_type: 'application/pdf' },
  { name: 'o-nas.md', path: 'o-nas.md', type: 'file', size: 4096, mime_type: 'text/markdown' },
  { name: 'cennik-2026.xlsx', path: 'cennik-2026.xlsx', type: 'file', size: 57344, mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  { name: 'dodavatelia.csv', path: 'dodavatelia.csv', type: 'file', size: 12288, mime_type: 'text/csv' },
  { name: 'svadobna-sezona-brief.md', path: 'svadobna-sezona-brief.md', type: 'file', size: 2150, mime_type: 'text/markdown' },
  { name: 'images', path: 'images', type: 'directory' },
]

export async function vfsStat(uri: string): Promise<VfsStatResult> {
  await delay(60)
  const path = uri.replace('company://', '').replace('workspace://', '')
  const entry = COMPANY_FILES.find(f => f.path === path)
  return {
    uri,
    type: entry?.type ?? 'file',
    size: entry?.size ?? 0,
    mime_type: entry?.mime_type ?? null,
    writable: uri.startsWith('company://'),
    etag: `mock-etag-${Date.now()}`,
  }
}

export async function vfsList(uri: string): Promise<VfsListResult> {
  await delay(80)
  if (uri.startsWith('company://')) {
    return { uri, entries: COMPANY_FILES }
  }
  // workspace scope: return mock workspace entries
  return { uri, entries: [] }
}

export async function vfsRead(_uri: string): Promise<{ content: string; mimeType: string }> {
  await delay(100)
  // Mock: return placeholder content
  return { content: 'Mock file content', mimeType: 'text/plain' }
}

export async function vfsDiff(uri: string): Promise<VfsDiffResult> {
  await delay(80)
  // Mock: return empty diff
  return {
    uri,
    base: 'main',
    head: 'task/T-151',
    files: [],
    stats: { files_changed: 0, insertions: 0, deletions: 0 },
  }
}
