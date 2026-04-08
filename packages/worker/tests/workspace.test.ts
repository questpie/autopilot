import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { existsSync } from 'node:fs'
import { WorkspaceManager } from '../src/workspace'

/**
 * Creates a temporary git repo for testing worktree behavior.
 */
async function createTempGitRepo(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'ws-test-'))
  Bun.spawnSync(['git', 'init'], { cwd: dir, stdout: 'pipe', stderr: 'pipe' })
  Bun.spawnSync(['git', 'config', 'user.email', 'test@test.com'], {
    cwd: dir,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  Bun.spawnSync(['git', 'config', 'user.name', 'Test'], {
    cwd: dir,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  // Need at least one commit for worktrees to work
  Bun.spawnSync(['git', 'commit', '--allow-empty', '-m', 'init'], {
    cwd: dir,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  return dir
}

describe('WorkspaceManager', () => {
  let repoDir: string
  let manager: WorkspaceManager

  beforeAll(async () => {
    repoDir = await createTempGitRepo()
    manager = new WorkspaceManager({ repoRoot: repoDir })
  })

  afterAll(async () => {
    // Clean up all worktrees before removing temp dir
    Bun.spawnSync(['git', 'worktree', 'prune'], {
      cwd: repoDir,
      stdout: 'pipe',
      stderr: 'pipe',
    })
    await rm(repoDir, { recursive: true, force: true })
  })

  test('acquire creates a worktree with deterministic path and branch', async () => {
    const ws = await manager.acquire({ runId: 'run-test-1' })

    expect(ws.created).toBe(true)
    expect(ws.degraded).toBe(false)
    expect(ws.runId).toBe('run-test-1')
    expect(ws.path).toContain('run-test-1')
    expect(ws.branch).toBe('autopilot/run-test-1')
    expect(existsSync(ws.path)).toBe(true)

    // Verify it's actually a git worktree
    const result = Bun.spawnSync(['git', 'worktree', 'list'], {
      cwd: repoDir,
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const output = result.stdout.toString()
    expect(output).toContain('run-test-1')

    // Cleanup
    await manager.release({ runId: 'run-test-1' })
  })

  test('two runs get different isolated workspaces', async () => {
    const ws1 = await manager.acquire({ runId: 'run-iso-a' })
    const ws2 = await manager.acquire({ runId: 'run-iso-b' })

    expect(ws1.path).not.toBe(ws2.path)
    expect(ws1.branch).not.toBe(ws2.branch)
    expect(existsSync(ws1.path)).toBe(true)
    expect(existsSync(ws2.path)).toBe(true)

    await manager.release({ runId: 'run-iso-a' })
    await manager.release({ runId: 'run-iso-b' })
  })

  test('continuation reuses original run workspace', async () => {
    // Create original workspace
    const original = await manager.acquire({ runId: 'run-orig-1' })
    expect(original.created).toBe(true)

    // Continuation should reuse it
    const continuation = await manager.acquire({
      runId: 'run-cont-1',
      resumedFromRunId: 'run-orig-1',
    })
    expect(continuation.path).toBe(original.path)
    expect(continuation.branch).toBe(original.branch)
    expect(continuation.created).toBe(false)

    await manager.release({ runId: 'run-orig-1' })
  })

  test('continuation creates fresh workspace if original is gone', async () => {
    // Don't create original workspace, just request continuation
    const ws = await manager.acquire({
      runId: 'run-cont-orphan',
      resumedFromRunId: 'run-nonexistent',
    })

    expect(ws.created).toBe(true)
    expect(ws.path).toContain('run-cont-orphan')
    expect(ws.branch).toBe('autopilot/run-cont-orphan')

    await manager.release({ runId: 'run-cont-orphan' })
  })

  test('release with resumable=true retains workspace', async () => {
    const ws = await manager.acquire({ runId: 'run-keep-1' })
    expect(existsSync(ws.path)).toBe(true)

    const result = await manager.release({ runId: 'run-keep-1', resumable: true })
    expect(result.removed).toBe(false)
    expect(existsSync(ws.path)).toBe(true) // Still there

    // Now actually clean it up
    await manager.release({ runId: 'run-keep-1', resumable: false })
  })

  test('release with resumable=false removes worktree but keeps branch', async () => {
    const ws = await manager.acquire({ runId: 'run-cleanup-1' })
    expect(existsSync(ws.path)).toBe(true)

    const result = await manager.release({ runId: 'run-cleanup-1', resumable: false })
    expect(result.removed).toBe(true)
    expect(result.branch).toBe('autopilot/run-cleanup-1')
    expect(existsSync(ws.path)).toBe(false) // Worktree gone

    // But branch should still exist
    const branchCheck = Bun.spawnSync(
      ['git', 'branch', '--list', 'autopilot/run-cleanup-1'],
      { cwd: repoDir, stdout: 'pipe', stderr: 'pipe' },
    )
    expect(branchCheck.stdout.toString().trim()).toContain('autopilot/run-cleanup-1')
  })

  test('release with removeBranch=true also deletes the branch', async () => {
    const ws = await manager.acquire({ runId: 'run-fullclean-1' })
    await manager.release({ runId: 'run-fullclean-1', removeBranch: true })

    // Both worktree and branch should be gone
    expect(existsSync(ws.path)).toBe(false)
    const branchCheck = Bun.spawnSync(
      ['git', 'branch', '--list', 'autopilot/run-fullclean-1'],
      { cwd: repoDir, stdout: 'pipe', stderr: 'pipe' },
    )
    expect(branchCheck.stdout.toString().trim()).toBe('')
  })

  test('acquire is idempotent for same runId', async () => {
    const ws1 = await manager.acquire({ runId: 'run-idem-1' })
    expect(ws1.created).toBe(true)

    // Second acquire should reuse, not fail
    const ws2 = await manager.acquire({ runId: 'run-idem-1' })
    expect(ws2.path).toBe(ws1.path)
    expect(ws2.created).toBe(false)

    await manager.release({ runId: 'run-idem-1' })
  })

  test('exists() returns correct state', async () => {
    expect(manager.exists('run-exists-1')).toBe(false)

    await manager.acquire({ runId: 'run-exists-1' })
    expect(manager.exists('run-exists-1')).toBe(true)

    await manager.release({ runId: 'run-exists-1' })
    expect(manager.exists('run-exists-1')).toBe(false)
  })

  test('worktreePath and branchName are deterministic', () => {
    expect(manager.worktreePath('run-abc-123')).toContain('run-abc-123')
    expect(manager.branchName('run-abc-123')).toBe('autopilot/run-abc-123')

    // Same input always same output
    expect(manager.worktreePath('run-abc-123')).toBe(manager.worktreePath('run-abc-123'))
  })
})

describe('WorkspaceManager.repoRoot (workspace_mode: none support)', () => {
  let repoDir: string

  beforeAll(async () => {
    repoDir = await createTempGitRepo()
  })

  afterAll(async () => {
    await rm(repoDir, { recursive: true, force: true })
  })

  test('repoRoot getter exposes the main checkout path for degraded workspace', () => {
    const mgr = new WorkspaceManager({ repoRoot: repoDir })
    // Worker uses repoRoot to construct a degraded WorkspaceInfo when workspace_mode is 'none'
    expect(mgr.repoRoot).toBe(repoDir)
    expect(existsSync(mgr.repoRoot)).toBe(true)
  })
})

describe('WorkspaceManager (non-git directory)', () => {
  let tmpDir: string

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ws-nongit-'))
  })

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  test('falls back to repoRoot in degraded mode when not in a git repo', async () => {
    const mgr = new WorkspaceManager({ repoRoot: tmpDir })
    const ws = await mgr.acquire({ runId: 'run-nogit-1' })

    expect(ws.path).toBe(tmpDir)
    expect(ws.branch).toBe('')
    expect(ws.created).toBe(false)
    expect(ws.degraded).toBe(true)
  })
})
