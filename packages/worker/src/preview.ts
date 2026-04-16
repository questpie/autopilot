/**
 * Preview file collectors.
 *
 * collectPreviewFiles — reads changed text files from a worktree via git diff.
 * collectPreviewDir  — recursively collects all files (text + binary) from a directory.
 *
 * Both produce preview_file artifacts for durable storage on the orchestrator.
 */

import { existsSync, readdirSync, statSync } from 'node:fs'
import { resolve, relative } from 'node:path'
import type { RunArtifact } from '@questpie/autopilot-spec'

const MAX_FILE_SIZE = 512 * 1024 // 512 KB
const SKIP_DIRS = new Set(['.git', '.worktrees', 'node_modules', '.autopilot', '.data'])

/** Extensions that are actually renderable in a browser preview. */
const PREVIEWABLE_EXTENSIONS = new Set([
  'html', 'htm',
  'css',
  'js', 'mjs',
  'svg', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'ico',
  'woff', 'woff2', 'ttf', 'otf', 'eot',
  'json',
  'wasm',
])

const MIME_BY_EXT: Record<string, string> = {
  html: 'text/html',
  htm: 'text/html',
  css: 'text/css',
  js: 'text/javascript',
  mjs: 'text/javascript',
  ts: 'text/typescript',
  json: 'application/json',
  svg: 'image/svg+xml',
  xml: 'application/xml',
  md: 'text/markdown',
  txt: 'text/plain',
}

const BINARY_MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  ico: 'image/x-icon',
  avif: 'image/avif',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  eot: 'application/vnd.ms-fontobject',
  wasm: 'application/wasm',
}

const ALL_MIME: Record<string, string> = { ...MIME_BY_EXT, ...BINARY_MIME_BY_EXT }

const MAX_DIR_FILE_SIZE = 2 * 1024 * 1024     // 2 MB per file
const MAX_DIR_TOTAL_SIZE = 20 * 1024 * 1024   // 20 MB total
const MAX_DIR_FILES = 500

function isTextFile(path: string): boolean {
  const ext = path.split('.').pop()?.toLowerCase()
  return ext !== undefined && ext in MIME_BY_EXT
}

function mimeType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  return MIME_BY_EXT[ext] ?? 'text/plain'
}

/**
 * Collect changed browser-previewable files from a worktree as preview_file artifacts.
 * Only includes files with extensions that are renderable in a browser preview
 * (HTML, CSS, JS, images, fonts, JSON, WASM). Source files like .ts/.tsx/.md are skipped.
 * Uses `git diff --name-only` to find what changed relative to the base branch.
 */
export async function collectPreviewFiles(
  worktreePath: string,
  repoRoot: string,
): Promise<RunArtifact[]> {
  const changedFiles = await getChangedFiles(worktreePath, repoRoot)
  if (changedFiles.length === 0) return []

  const artifacts: RunArtifact[] = []
  for (const relPath of changedFiles) {
    const ext = relPath.split('.').pop()?.toLowerCase()
    if (!ext || !PREVIEWABLE_EXTENSIONS.has(ext)) continue
    if (SKIP_DIRS.has(relPath.split('/')[0] ?? '')) continue

    const fullPath = `${worktreePath}/${relPath}`
    try {
      const file = Bun.file(fullPath)
      const size = file.size
      if (size > MAX_FILE_SIZE) continue

      const isBinary = ext in BINARY_MIME_BY_EXT
      const mime = ALL_MIME[ext] ?? (isBinary ? 'application/octet-stream' : 'text/plain')

      if (isBinary) {
        const buf = await file.arrayBuffer()
        artifacts.push({
          kind: 'preview_file',
          title: relPath,
          ref_kind: 'base64',
          ref_value: Buffer.from(buf).toString('base64'),
          mime_type: mime,
        })
      } else {
        const content = await file.text()
        artifacts.push({
          kind: 'preview_file',
          title: relPath,
          ref_kind: 'inline',
          ref_value: content,
          mime_type: mime,
        })
      }
    } catch {
      // File may have been deleted or is unreadable — skip
    }
  }

  return artifacts
}

/** Get list of changed files in the worktree relative to the default branch. */
async function getChangedFiles(worktreePath: string, repoRoot: string): Promise<string[]> {
  // Find the default branch to diff against
  const defaultBranch = await detectDefaultBranch(repoRoot)
  if (!defaultBranch) return []

  const proc = Bun.spawn(
    ['git', 'diff', '--name-only', '--diff-filter=ACMR', defaultBranch],
    { cwd: worktreePath, stdout: 'pipe', stderr: 'pipe' },
  )
  const stdout = await new Response(proc.stdout).text()
  const exitCode = await proc.exited
  if (exitCode !== 0) return []

  return stdout.trim().split('\n').filter(Boolean)
}

/** Detect the default branch (main or master). */
async function detectDefaultBranch(repoRoot: string): Promise<string | null> {
  for (const candidate of ['main', 'master']) {
    const proc = Bun.spawn(
      ['git', 'rev-parse', '--verify', candidate],
      { cwd: repoRoot, stdout: 'pipe', stderr: 'pipe' },
    )
    await new Response(proc.stdout).text()
    if ((await proc.exited) === 0) return candidate
  }
  return null
}

export interface CollectPreviewDirResult {
  files: RunArtifact[]
  metadata: {
    entry?: string
    file_count: number
    total_size: number
    source_dir: string
  }
}

/**
 * Collect all files in a directory as preview_file artifacts.
 *
 * Prefer a single self-contained HTML preview when feasible.
 * Use preview_dir when the output naturally consists of multiple local assets.
 */
export async function collectPreviewDir(
  dirPath: string,
  opts?: {
    entry?: string
    maxFileSize?: number
    maxTotalSize?: number
    maxFiles?: number
  },
): Promise<CollectPreviewDirResult> {
  const maxFileSize = opts?.maxFileSize ?? MAX_DIR_FILE_SIZE
  const maxTotalSize = opts?.maxTotalSize ?? MAX_DIR_TOTAL_SIZE
  const maxFiles = opts?.maxFiles ?? MAX_DIR_FILES

  const resolved = resolve(dirPath)

  // Verify directory exists
  if (!existsSync(resolved)) {
    throw new Error(`preview_dir: directory does not exist: ${dirPath}`)
  }
  const dirStat = statSync(resolved)
  if (!dirStat.isDirectory()) {
    throw new Error(`preview_dir: path is not a directory: ${dirPath}`)
  }

  const entries = readdirSync(resolved, { withFileTypes: true, recursive: true })
  const artifacts: RunArtifact[] = []
  let totalSize = 0

  for (const entry of entries) {
    if (!entry.isFile()) continue

    // parentPath is standard; older Node/Bun versions expose .path instead
    const parentDir = entry.parentPath ?? ('path' in entry ? String(entry.path) : resolved)
    const fullPath = resolve(parentDir, entry.name)
    const relPath = relative(resolved, fullPath)

    // Skip excluded dirs
    const parts = relPath.split('/')
    if (parts.some(p => SKIP_DIRS.has(p))) continue

    // Check file count limit
    if (artifacts.length >= maxFiles) {
      throw new Error(`preview_dir: file count limit exceeded (max ${maxFiles} files)`)
    }

    const fileStat = statSync(fullPath)
    const fileSize = fileStat.size

    // Check individual file size
    if (fileSize > maxFileSize) {
      throw new Error(
        `preview_dir: file "${relPath}" exceeds size limit (${fileSize} bytes > ${maxFileSize} bytes)`
      )
    }

    // Check total size
    totalSize += fileSize
    if (totalSize > maxTotalSize) {
      throw new Error(
        `preview_dir: total size limit exceeded (${totalSize} bytes > ${maxTotalSize} bytes)`
      )
    }

    const ext = entry.name.split('.').pop()?.toLowerCase() ?? ''
    const isText = ext in MIME_BY_EXT
    const isBinary = ext in BINARY_MIME_BY_EXT
    const mime = ALL_MIME[ext]

    if (isText) {
      const content = await Bun.file(fullPath).text()
      artifacts.push({
        kind: 'preview_file',
        title: relPath,
        ref_kind: 'inline',
        ref_value: content,
        mime_type: mime ?? 'text/plain',
      })
    } else if (isBinary) {
      const buf = await Bun.file(fullPath).arrayBuffer()
      artifacts.push({
        kind: 'preview_file',
        title: relPath,
        ref_kind: 'base64',
        ref_value: Buffer.from(buf).toString('base64'),
        mime_type: mime ?? 'application/octet-stream',
      })
    } else {
      // Unknown extension: sniff first 8 KB for null bytes to decide text vs binary
      const buf = await Bun.file(fullPath).arrayBuffer()
      const isBinaryContent = new Uint8Array(buf, 0, Math.min(8192, buf.byteLength)).some(b => b === 0)

      artifacts.push({
        kind: 'preview_file',
        title: relPath,
        ref_kind: isBinaryContent ? 'base64' : 'inline',
        ref_value: isBinaryContent
          ? Buffer.from(buf).toString('base64')
          : new TextDecoder().decode(buf),
        mime_type: isBinaryContent ? 'application/octet-stream' : 'text/plain',
      })
    }
  }

  return {
    files: artifacts,
    metadata: {
      entry: opts?.entry,
      file_count: artifacts.length,
      total_size: totalSize,
      source_dir: dirPath,
    },
  }
}
