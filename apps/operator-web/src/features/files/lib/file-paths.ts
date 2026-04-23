export type FilesLayout = 'list' | 'grid' | 'columns' | 'preview'

export interface SavedFilesLocation {
  path: string | null
  runId: string | null
  type: 'file' | 'directory'
  label: string
  viewedAt: string
}

export function buildUri(runId: string | null, path: string | null): string {
  if (runId) {
    return path ? `workspace://run/${runId}/${path}` : `workspace://run/${runId}/`
  }
  return path ? `company://${path}` : 'company://.'
}

export function buildContentUrl(uri: string): string {
  return `/api/vfs/read?uri=${encodeURIComponent(uri)}`
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function buildPathSegments(path: string | null): { label: string; path: string | null }[] {
  if (!path) return []
  const parts = path.split('/').filter(Boolean)
  return parts.map((part, i) => ({
    label: part,
    path: parts.slice(0, i + 1).join('/'),
  }))
}

export function buildColumnPaths(path: string | null): Array<string | null> {
  if (!path) return [null]
  const parts = path.split('/').filter(Boolean)
  return [null, ...parts.map((_, index) => parts.slice(0, index + 1).join('/'))]
}

export function getParentPath(path: string | null): string | null {
  if (!path) return null
  const parts = path.split('/').filter(Boolean)
  if (parts.length <= 1) return null
  return parts.slice(0, -1).join('/')
}

export function getBaseName(path: string | null, fallback = 'Files'): string {
  if (!path) return fallback
  const parts = path.split('/').filter(Boolean)
  return parts[parts.length - 1] ?? fallback
}

export function locationKey(location: Pick<SavedFilesLocation, 'path' | 'runId' | 'type'>): string {
  return `${location.runId ?? 'company'}:${location.type}:${location.path ?? '.'}`
}

export function normalizeSavedFilesLocation(value: unknown): SavedFilesLocation | null {
  if (typeof value !== 'object' || value === null) return null
  const candidate = value as Record<string, unknown>
  const path = typeof candidate.path === 'string' ? candidate.path : candidate.path === null ? null : null
  const runId = typeof candidate.runId === 'string' ? candidate.runId : candidate.runId === null ? null : null
  const type = candidate.type === 'file' || candidate.type === 'directory' ? candidate.type : null
  const label = typeof candidate.label === 'string' ? candidate.label : getBaseName(path)
  const viewedAt = typeof candidate.viewedAt === 'string' ? candidate.viewedAt : new Date().toISOString()
  if (!type) return null
  return { path, runId, type, label, viewedAt }
}
