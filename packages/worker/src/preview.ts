/**
 * Preview file collector.
 *
 * After a run completes, reads changed files from the worktree and returns
 * them as inline artifacts for durable storage on the orchestrator.
 *
 * Only collects text-based files under a size limit. Binary files are skipped.
 */

import type { RunArtifact } from '@questpie/autopilot-spec'

const MAX_FILE_SIZE = 512 * 1024 // 512 KB
const SKIP_DIRS = new Set(['.git', '.worktrees', 'node_modules', '.autopilot', '.data'])

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

function isTextFile(path: string): boolean {
  const ext = path.split('.').pop()?.toLowerCase()
  return ext !== undefined && ext in MIME_BY_EXT
}

function mimeType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  return MIME_BY_EXT[ext] ?? 'text/plain'
}

/**
 * Collect changed text files from a worktree as preview_file artifacts.
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
    if (!isTextFile(relPath)) continue
    if (SKIP_DIRS.has(relPath.split('/')[0] ?? '')) continue

    const fullPath = `${worktreePath}/${relPath}`
    try {
      const file = Bun.file(fullPath)
      const size = file.size
      if (size > MAX_FILE_SIZE) continue

      const content = await file.text()
      artifacts.push({
        kind: 'preview_file',
        title: relPath,
        ref_kind: 'inline',
        ref_value: content,
        mime_type: mimeType(relPath),
      })
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
