/**
 * VFS Service — scope-aware virtual filesystem layer.
 *
 * Company scope: mutable files backed by company root on orchestrator.
 * Workspace scope: read-only files proxied through worker API.
 */
import { existsSync } from 'node:fs'
import { readdir, readFile, stat, writeFile, mkdir, rename } from 'node:fs/promises'
import { join, resolve, dirname, extname } from 'node:path'
import { createHash } from 'node:crypto'
import type { VfsParsedUri, VfsStatResponse, VfsListEntry, VfsWriteResponse, VfsDiffResponse } from '@questpie/autopilot-spec'

// ─── URI Parser ─────────────────────────────────────────────────────────────

const COMPANY_RE = /^company:\/\/(.*)$/
const WORKSPACE_RE = /^workspace:\/\/run\/([^/]+)\/(.*)$/
const WORKSPACE_ROOT_RE = /^workspace:\/\/run\/([^/]+)\/?$/

export class VfsUriError extends Error {
  constructor(
    message: string,
    public readonly code: 'invalid_uri' | 'scope_error' = 'invalid_uri',
  ) {
    super(message)
    this.name = 'VfsUriError'
  }
}

export function parseVfsUri(raw: string): VfsParsedUri {
  const companyMatch = raw.match(COMPANY_RE)
  if (companyMatch) {
    const path = companyMatch[1]!
    if (!path) throw new VfsUriError('company:// URI must include a path')
    return { scheme: 'company', path: normalizePath(path) }
  }

  const wsMatch = raw.match(WORKSPACE_RE)
  if (wsMatch) {
    return {
      scheme: 'workspace',
      runId: wsMatch[1]!,
      path: normalizePath(wsMatch[2]!),
    }
  }

  const wsRootMatch = raw.match(WORKSPACE_ROOT_RE)
  if (wsRootMatch) {
    return {
      scheme: 'workspace',
      runId: wsRootMatch[1]!,
      path: '',
    }
  }

  throw new VfsUriError(`Invalid VFS URI: ${raw}`)
}

function normalizePath(p: string): string {
  // Remove leading/trailing slashes, collapse double slashes
  return p.replace(/\/+/g, '/').replace(/^\/|\/$/g, '')
}

// ─── Security ───────────────────────────────────────────────────────────────

const BLOCKED_SEGMENTS = new Set([
  '.git', '.worktrees', 'node_modules', 'dist', 'build', 'coverage',
])

const BLOCKED_FILE_PATTERNS = [
  /^\.env($|\.)/, // .env, .env.local, .env.production, etc.
  /\.sqlite3?$/,
  /\.db$/,
]

export class VfsSecurityError extends Error {
  constructor(
    message: string,
    public readonly code: 'traversal_blocked' | 'path_blocked' | 'forbidden' = 'forbidden',
  ) {
    super(message)
    this.name = 'VfsSecurityError'
  }
}

function isBlockedSegment(name: string): boolean {
  if (BLOCKED_SEGMENTS.has(name)) return true
  return BLOCKED_FILE_PATTERNS.some((pattern) => pattern.test(name))
}

export function validatePath(relativePath: string, rootDir: string): string {
  const target = resolve(rootDir, relativePath)
  const resolvedRoot = resolve(rootDir)
  if (!target.startsWith(resolvedRoot + '/') && target !== resolvedRoot) {
    throw new VfsSecurityError('path traversal detected', 'traversal_blocked')
  }

  for (const seg of relativePath.split('/')) {
    if (isBlockedSegment(seg)) {
      throw new VfsSecurityError(`access to '${seg}' is blocked`, 'path_blocked')
    }
  }

  return target
}

// ─── MIME / text detection ──────────────────────────────────────────────────

const TEXT_EXTENSIONS = new Set([
  '.txt', '.md', '.markdown', '.json', '.yaml', '.yml', '.toml',
  '.xml', '.html', '.htm', '.css', '.scss', '.less',
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.py', '.rb', '.go', '.rs', '.java', '.kt', '.swift', '.c', '.cpp', '.h',
  '.sh', '.bash', '.zsh', '.fish',
  '.sql', '.graphql', '.gql',
  '.gitignore', '.dockerignore', '.editorconfig',
  '.csv', '.tsv', '.log', '.conf', '.cfg', '.ini',
  '.svelte', '.vue', '.astro',
  '.lock', '.prisma',
])

const MIME_MAP: Record<string, string> = {
  '.txt': 'text/plain', '.md': 'text/markdown', '.markdown': 'text/markdown',
  '.json': 'application/json', '.yaml': 'application/yaml', '.yml': 'application/yaml',
  '.toml': 'application/toml', '.xml': 'application/xml',
  '.html': 'text/html', '.htm': 'text/html', '.css': 'text/css',
  '.js': 'text/javascript', '.jsx': 'text/javascript', '.mjs': 'text/javascript',
  '.ts': 'text/typescript', '.tsx': 'text/typescript',
  '.py': 'text/x-python', '.rb': 'text/x-ruby', '.go': 'text/x-go',
  '.rs': 'text/x-rust', '.java': 'text/x-java', '.sh': 'text/x-shellscript',
  '.sql': 'text/x-sql', '.csv': 'text/csv',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.pdf': 'application/pdf', '.zip': 'application/zip',
}

function getMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase()
  return MIME_MAP[ext] ?? 'application/octet-stream'
}

function isTextFile(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase()
  return TEXT_EXTENSIONS.has(ext)
}

function computeEtag(content: Buffer): string {
  return createHash('md5').update(content).digest('hex')
}

// ─── Worker Client interface ────────────────────────────────────────────────

/** Shape returned by the worker /workspaces/:runId/files endpoint. */
interface WorkerFileEntry {
  name: string
  type: 'file' | 'directory'
  size?: number
  path: string
}

export interface WorkerConnection {
  baseUrl: string
  token: string
}

export interface WorkerRegistry {
  getWorkerForRun(runId: string): Promise<WorkerConnection | null>
}

export interface ReadResult {
  content: Buffer
  mimeType: string
  size: number
  etag: string | null
  writable: boolean
  isText: boolean
}

// ─── VFS Service ────────────────────────────────────────────────────────────

export class VfsService {
  constructor(
    private companyRoot: string,
    private workerRegistry: WorkerRegistry,
  ) {}

  // ── Stat ────────────────────────────────────────────────────────────────

  async stat(uri: string): Promise<VfsStatResponse> {
    const parsed = parseVfsUri(uri)

    if (parsed.scheme === 'company') {
      return this.companyStatInternal(parsed.path, uri)
    }
    return this.workspaceStatInternal(parsed.runId, parsed.path, uri)
  }

  private async companyStatInternal(relativePath: string, uri: string): Promise<VfsStatResponse> {
    const absPath = validatePath(relativePath, this.companyRoot)

    if (!existsSync(absPath)) {
      throw new VfsNotFoundError(`not found: ${uri}`)
    }

    const st = await stat(absPath)
    const isDir = st.isDirectory()
    const mimeType = isDir ? null : getMimeType(relativePath)
    const etag = isDir ? null : computeEtag(await readFile(absPath))

    return {
      uri,
      type: isDir ? 'directory' : 'file',
      size: isDir ? 0 : st.size,
      mime_type: mimeType,
      writable: true,
      etag,
    }
  }

  private async workspaceStatInternal(runId: string, relativePath: string, uri: string): Promise<VfsStatResponse> {
    const conn = await this.getWorkerConnection(runId)

    if (!relativePath) {
      return { uri, type: 'directory', size: 0, mime_type: null, writable: false, etag: null }
    }

    const lastSlash = relativePath.lastIndexOf('/')
    const parentPath = lastSlash >= 0 ? relativePath.slice(0, lastSlash) : ''
    const fileName = lastSlash >= 0 ? relativePath.slice(lastSlash + 1) : relativePath

    const params: Record<string, string> = {}
    if (parentPath) params.path = parentPath

    const res = await this.workerFetch(conn, `/workspaces/${runId}/files`, params)
    const entries = (await res.json()) as WorkerFileEntry[]
    const entry = entries.find((e) => e.name === fileName)

    if (!entry) {
      throw new VfsNotFoundError(`not found in workspace: ${uri}`)
    }

    const isDir = entry.type === 'directory'
    return {
      uri,
      type: isDir ? 'directory' : 'file',
      size: entry.size ?? 0,
      mime_type: isDir ? null : getMimeType(fileName),
      writable: false,
      etag: null,
    }
  }

  // ── List ────────────────────────────────────────────────────────────────

  async list(uri: string): Promise<{ uri: string; entries: VfsListEntry[] }> {
    const parsed = parseVfsUri(uri)

    if (parsed.scheme === 'company') {
      return this.companyListInternal(parsed.path, uri)
    }
    return this.workspaceListInternal(parsed.runId, parsed.path, uri)
  }

  private async companyListInternal(relativePath: string, uri: string): Promise<{ uri: string; entries: VfsListEntry[] }> {
    const absPath = validatePath(relativePath, this.companyRoot)

    if (!existsSync(absPath)) {
      throw new VfsNotFoundError(`not found: ${uri}`)
    }

    const st = await stat(absPath)
    if (!st.isDirectory()) {
      throw new VfsNotFoundError(`not a directory: ${uri}`)
    }

    const dirEntries = await readdir(absPath, { withFileTypes: true })
    const entries: VfsListEntry[] = []

    for (const entry of dirEntries) {
      if (entry.name.startsWith('.') || isBlockedSegment(entry.name)) continue

      const entryRelPath = relativePath ? `${relativePath}/${entry.name}` : entry.name

      if (entry.isDirectory()) {
        entries.push({ name: entry.name, path: entryRelPath, type: 'directory', mime_type: null })
      } else if (entry.isFile()) {
        const fileStat = await stat(join(absPath, entry.name))
        entries.push({
          name: entry.name,
          path: entryRelPath,
          type: 'file',
          size: fileStat.size,
          mime_type: getMimeType(entry.name),
        })
      }
    }

    entries.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
      return a.name.localeCompare(b.name)
    })

    return { uri, entries }
  }

  private async workspaceListInternal(runId: string, relativePath: string, uri: string): Promise<{ uri: string; entries: VfsListEntry[] }> {
    const conn = await this.getWorkerConnection(runId)
    const params: Record<string, string> = {}
    if (relativePath) params.path = relativePath

    const res = await this.workerFetch(conn, `/workspaces/${runId}/files`, params)
    const workerEntries = (await res.json()) as WorkerFileEntry[]

    const entries: VfsListEntry[] = workerEntries.map((e) => ({
      name: e.name,
      path: e.path,
      type: e.type as 'file' | 'directory',
      size: e.size,
      mime_type: e.type === 'file' ? getMimeType(e.name) : null,
    }))

    return { uri, entries }
  }

  // ── Read ────────────────────────────────────────────────────────────────

  async read(uri: string): Promise<ReadResult> {
    const parsed = parseVfsUri(uri)

    if (parsed.scheme === 'company') {
      return this.companyReadInternal(parsed.path)
    }
    return this.workspaceReadInternal(parsed.runId, parsed.path)
  }

  private async companyReadInternal(relativePath: string): Promise<ReadResult> {
    const absPath = validatePath(relativePath, this.companyRoot)

    if (!existsSync(absPath)) {
      throw new VfsNotFoundError(`not found: company://${relativePath}`)
    }

    const st = await stat(absPath)
    if (!st.isFile()) {
      throw new VfsNotFoundError(`not a file: company://${relativePath}`)
    }

    const content = await readFile(absPath)
    return {
      content: Buffer.from(content),
      mimeType: getMimeType(relativePath),
      size: st.size,
      etag: computeEtag(Buffer.from(content)),
      writable: true,
      isText: isTextFile(relativePath),
    }
  }

  private async workspaceReadInternal(runId: string, relativePath: string): Promise<ReadResult> {
    const conn = await this.getWorkerConnection(runId)
    const res = await this.workerFetch(conn, `/workspaces/${runId}/file`, { path: relativePath })

    const content = Buffer.from(await res.arrayBuffer())
    return {
      content,
      mimeType: res.headers.get('Content-Type') ?? 'application/octet-stream',
      size: Number(res.headers.get('X-Vfs-Size') ?? content.length),
      etag: null,
      writable: false,
      isText: res.headers.get('X-Vfs-Text') === 'true',
    }
  }

  // ── Write ───────────────────────────────────────────────────────────────

  async write(uri: string, content: Buffer, options?: { etag?: string }): Promise<VfsWriteResponse> {
    const parsed = parseVfsUri(uri)

    if (parsed.scheme !== 'company') {
      throw new VfsReadOnlyError(`write not allowed on ${parsed.scheme}:// scope`)
    }

    const absPath = validatePath(parsed.path, this.companyRoot)

    // Optimistic concurrency check
    if (options?.etag && existsSync(absPath)) {
      const existing = Buffer.from(await readFile(absPath))
      const currentEtag = computeEtag(existing)
      if (currentEtag !== options.etag) {
        throw new VfsEtagMismatchError(`etag mismatch: expected ${options.etag}, got ${currentEtag}`)
      }
    }

    // Atomic write: write to temp file, then rename
    const dir = dirname(absPath)
    await mkdir(dir, { recursive: true })

    const tmpPath = `${absPath}.vfs-tmp-${Date.now()}`
    await writeFile(tmpPath, content)
    await rename(tmpPath, absPath)

    const newEtag = computeEtag(content)

    return {
      uri,
      size: content.length,
      etag: newEtag,
      written_at: new Date().toISOString(),
    }
  }

  // ── Diff ────────────────────────────────────────────────────────────────

  async diff(uri: string, options?: { includeDirty?: boolean }): Promise<VfsDiffResponse> {
    const parsed = parseVfsUri(uri)

    if (parsed.scheme !== 'workspace') {
      throw new VfsScopeError('diff is only supported on workspace:// scope')
    }

    const conn = await this.getWorkerConnection(parsed.runId)

    const params: Record<string, string> = {}
    if (parsed.path) params.path = parsed.path
    if (options?.includeDirty) params.include_dirty = 'true'

    const res = await this.workerFetch(conn, `/workspaces/${parsed.runId}/diff`, params)
    const data = (await res.json()) as Omit<VfsDiffResponse, 'uri'>

    return { uri, ...data }
  }

  // ── Worker helpers ──────────────────────────────────────────────────

  private async getWorkerConnection(runId: string): Promise<WorkerConnection> {
    const conn = await this.workerRegistry.getWorkerForRun(runId)
    if (!conn) {
      throw new VfsWorkerUnavailableError(`no worker available for run ${runId}`)
    }
    return conn
  }

  private async workerFetch(conn: WorkerConnection, path: string, params?: Record<string, string>): Promise<Response> {
    const url = new URL(path, conn.baseUrl)
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v)
      }
    }
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${conn.token}` },
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: 'unknown' })) as { error?: string }
      throw new VfsNotFoundError(body.error ?? `worker request failed: ${path}`)
    }
    return res
  }
}

// ─── Error classes ──────────────────────────────────────────────────────────

export class VfsNotFoundError extends Error {
  readonly code = 'not_found' as const
  constructor(message: string) { super(message); this.name = 'VfsNotFoundError' }
}

export class VfsReadOnlyError extends Error {
  readonly code = 'read_only' as const
  constructor(message: string) { super(message); this.name = 'VfsReadOnlyError' }
}

export class VfsEtagMismatchError extends Error {
  readonly code = 'etag_mismatch' as const
  constructor(message: string) { super(message); this.name = 'VfsEtagMismatchError' }
}

export class VfsScopeError extends Error {
  readonly code = 'scope_error' as const
  constructor(message: string) { super(message); this.name = 'VfsScopeError' }
}

export class VfsWorkerUnavailableError extends Error {
  readonly code = 'worker_unavailable' as const
  constructor(message: string) { super(message); this.name = 'VfsWorkerUnavailableError' }
}
