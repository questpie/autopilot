/**
 * Workspace manager — creates and manages isolated git worktrees per run.
 *
 * Each active run gets its own git worktree so that:
 * - Multiple runs on the same machine don't collide
 * - Claude executes on an isolated branch, not the shared checkout
 * - Human can review diffs per-branch after completion
 *
 * Naming:
 *   worktree path:  <repoRoot>/.worktrees/run-<runId>
 *   branch name:    autopilot/run-<runId>
 *
 * Continuation runs reuse the worktree of the original run they continue from.
 *
 * Cleanup policy:
 *   - Completed + resumable: RETAIN (human may continue or review)
 *   - Completed + not resumable: REMOVE worktree, keep branch for review
 *   - Failed: REMOVE worktree, keep branch for debugging
 *   - Explicit cleanup: `cleanupWorkspace(runId, { removeBranch: true })`
 */

import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'

export interface WorkspaceInfo {
  /** Absolute path to the worktree directory. */
  path: string
  /** Git branch name for this workspace. */
  branch: string
  /** Whether this workspace was newly created (vs reused from continuation). */
  created: boolean
  /** The run ID that owns this workspace. */
  runId: string
  /** True when worktree isolation is unavailable (not a git repo). No isolation guarantee. */
  degraded: boolean
}

export interface WorkspaceManagerConfig {
  /** Root of the git repository (the main checkout). */
  repoRoot: string
  /** Base directory for worktrees. Defaults to <repoRoot>/.worktrees */
  worktreeBase?: string
}

export class WorkspaceManager {
  #repoRoot: string
  #worktreeBase: string

  constructor(config: WorkspaceManagerConfig) {
    this.#repoRoot = config.repoRoot
    this.#worktreeBase = config.worktreeBase ?? join(config.repoRoot, '.worktrees')
  }

  get repoRoot(): string {
    return this.#repoRoot
  }

  /**
   * Acquire an isolated workspace for a run.
   *
   * When taskId is provided, uses task-scoped worktree (persists across workflow steps):
   *   - path: .worktrees/{taskId}, branch: autopilot/{taskId}
   *   - Reuses existing worktree if present (subsequent workflow step)
   *   - Never removed by release() — persists until explicit cleanup
   *
   * When taskId is absent (query runs), uses per-run worktree (original behavior).
   *
   * For continuation runs (resumedFromRunId set), reuses the original run's worktree.
   * Falls back to repoRoot if not inside a git repo.
   */
  async acquire(opts: {
    runId: string
    taskId?: string | null
    resumedFromRunId?: string | null
    baseBranch?: string | null
  }): Promise<WorkspaceInfo> {
    // Check if this is a git repo
    if (!this.isGitRepo()) {
      console.warn(`[workspace] DEGRADED MODE: ${this.#repoRoot} is not a git repo — no worktree isolation`)
      return {
        path: this.#repoRoot,
        branch: '',
        created: false,
        runId: opts.runId,
        degraded: true,
      }
    }

    // Task-scoped worktree: keyed by taskId, persists across workflow steps
    if (opts.taskId) {
      const wtPath = this.worktreePath(opts.taskId)
      const branch = this.branchName(opts.taskId)

      // Reuse existing task worktree (subsequent step in same task)
      if (existsSync(wtPath)) {
        return { path: wtPath, branch, created: false, runId: opts.runId, degraded: false }
      }

      return this.createWorktree(wtPath, branch, opts.runId, opts.baseBranch)
    }

    // For continuations, reuse the original run's workspace
    if (opts.resumedFromRunId) {
      const originalPath = this.worktreePath(opts.resumedFromRunId)
      if (existsSync(originalPath)) {
        return {
          path: originalPath,
          branch: this.branchName(opts.resumedFromRunId),
          created: false,
          runId: opts.runId,
          degraded: false,
        }
      }
      // Original workspace gone — create fresh for the continuation
    }

    const wtPath = this.worktreePath(opts.runId)
    const branch = this.branchName(opts.runId)

    // If worktree already exists (e.g., retry after crash), reuse it
    if (existsSync(wtPath)) {
      return { path: wtPath, branch, created: false, runId: opts.runId, degraded: false }
    }

    return this.createWorktree(wtPath, branch, opts.runId, opts.baseBranch)
  }

  /**
   * Release a workspace after run completion.
   *
   * Policy:
   * - taskId present: NEVER remove (task worktrees persist across steps)
   * - resumable=true: retain worktree (human may continue)
   * - resumable=false: remove worktree, keep branch
   * - removeBranch=true: also delete the branch
   */
  async release(opts: {
    runId: string
    taskId?: string | null
    resumable?: boolean
    removeBranch?: boolean
  }): Promise<{ removed: boolean; branch: string }> {
    // Task-scoped worktrees persist across workflow steps — never auto-remove
    if (opts.taskId) {
      const branch = this.branchName(opts.taskId)
      return { removed: false, branch }
    }

    const branch = this.branchName(opts.runId)
    const wtPath = this.worktreePath(opts.runId)

    // Retain workspace for resumable runs
    if (opts.resumable) {
      return { removed: false, branch }
    }

    if (!existsSync(wtPath)) {
      return { removed: false, branch }
    }

    // Remove worktree
    Bun.spawnSync(['git', 'worktree', 'remove', '--force', wtPath], {
      cwd: this.#repoRoot,
      stdout: 'pipe',
      stderr: 'pipe',
    })

    // Prune stale worktree metadata
    Bun.spawnSync(['git', 'worktree', 'prune'], {
      cwd: this.#repoRoot,
      stdout: 'pipe',
      stderr: 'pipe',
    })

    // Optionally remove branch
    if (opts.removeBranch) {
      Bun.spawnSync(['git', 'branch', '-D', branch], {
        cwd: this.#repoRoot,
        stdout: 'pipe',
        stderr: 'pipe',
      })
    }

    return { removed: true, branch }
  }

  /** Get the base directory for all worktrees. */
  getWorktreeBase(): string {
    return this.#worktreeBase
  }

  /** Check if a workspace exists for a run. */
  exists(runId: string): boolean {
    return existsSync(this.worktreePath(runId))
  }

  /** Get the worktree path for a run ID. */
  worktreePath(runId: string): string {
    // Sanitize runId for filesystem safety
    const safe = runId.replace(/[^a-zA-Z0-9_-]/g, '_')
    return join(this.#worktreeBase, safe)
  }

  /** Get the branch name for a run ID. */
  branchName(runId: string): string {
    const safe = runId.replace(/[^a-zA-Z0-9_-]/g, '_')
    return `autopilot/${safe}`
  }

  /**
   * Create a worktree + branch. Shared by task-scoped and run-scoped paths.
   * If baseBranch is provided, branches from it instead of HEAD.
   */
  private async createWorktree(
    wtPath: string,
    branch: string,
    runId: string,
    baseBranch?: string | null,
  ): Promise<WorkspaceInfo> {
    await mkdir(this.#worktreeBase, { recursive: true })

    // Build the git worktree add command
    const args = baseBranch
      ? ['git', 'worktree', 'add', '-b', branch, wtPath, baseBranch]
      : ['git', 'worktree', 'add', '-b', branch, wtPath]

    const result = Bun.spawnSync(args, {
      cwd: this.#repoRoot,
      stdout: 'pipe',
      stderr: 'pipe',
    })

    if (result.exitCode !== 0) {
      const stderr = result.stderr.toString().trim()
      // Branch may already exist (from a previous failed run) — try without -b
      if (stderr.includes('already exists')) {
        const retryArgs = ['git', 'worktree', 'add', wtPath, branch]
        const retry = Bun.spawnSync(retryArgs, {
          cwd: this.#repoRoot,
          stdout: 'pipe',
          stderr: 'pipe',
        })
        if (retry.exitCode !== 0) {
          throw new Error(
            `Failed to create worktree: ${retry.stderr.toString().trim()}`,
          )
        }
      } else {
        throw new Error(`Failed to create worktree: ${stderr}`)
      }
    }

    return { path: wtPath, branch, created: true, runId, degraded: false }
  }

  private isGitRepo(): boolean {
    const result = Bun.spawnSync(
      ['git', 'rev-parse', '--is-inside-work-tree'],
      { cwd: this.#repoRoot, stdout: 'pipe', stderr: 'pipe' },
    )
    return result.exitCode === 0
  }
}
