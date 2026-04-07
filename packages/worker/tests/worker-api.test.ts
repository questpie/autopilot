/**
 * Tests for the worker app API (read-only observability surface).
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createWorkerApi, type WorkerApiDeps, type WorkerApiAppType } from '../src/api'
import { createWorkerApiClient } from '../src/api-client'
import { WorkspaceManager } from '../src/workspace'
import type { ResolvedRuntime } from '../src/runtime-config'
import type { WorkerCapability } from '../src/worker'
import {
  HealthResponseSchema,
  WorkerStatusSchema,
  WorkspaceEntrySchema,
  WorkspaceDetailSchema,
  DiffResultSchema,
  FileEntrySchema,
  ErrorResponseSchema,
} from '../src/api-schemas'
import { z } from 'zod'
import { hc } from 'hono/client'

// ─── Test helpers ───────────────────────────────────────────────────────────

async function createTempGitRepo(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'worker-api-test-'))
  Bun.spawnSync(['git', 'init', '-b', 'main'], { cwd: dir, stdout: 'pipe', stderr: 'pipe' })
  Bun.spawnSync(['git', 'config', 'user.email', 'test@test.com'], { cwd: dir, stdout: 'pipe', stderr: 'pipe' })
  Bun.spawnSync(['git', 'config', 'user.name', 'Test'], { cwd: dir, stdout: 'pipe', stderr: 'pipe' })
  // Create initial commit so we have a HEAD
  await writeFile(join(dir, 'README.md'), '# Test repo\n')
  Bun.spawnSync(['git', 'add', '.'], { cwd: dir, stdout: 'pipe', stderr: 'pipe' })
  Bun.spawnSync(['git', 'commit', '-m', 'initial'], { cwd: dir, stdout: 'pipe', stderr: 'pipe' })
  return dir
}

function makeFakeRuntime(): ResolvedRuntime {
  return {
    config: { runtime: 'claude-code', models: ['claude-sonnet-4-20250514'], tags: ['test'] },
    resolvedBinaryPath: '/usr/bin/true', // exists and returns 0
    adapter: { start: async () => undefined, onEvent: () => {}, stop: async () => {} },
    capability: {
      runtime: 'claude-code',
      models: ['claude-sonnet-4-20250514'],
      maxConcurrent: 1,
      tags: ['test'],
    } as WorkerCapability,
  }
}

function makeDeps(overrides: Partial<WorkerApiDeps> = {}): WorkerApiDeps {
  return {
    workerId: 'worker-test-123',
    deviceId: 'device-test',
    name: 'Test Worker',
    repoRoot: null,
    tags: ['dev'],
    isLocalDev: true,
    maxConcurrentRuns: 1,
    getActiveRunIds: () => new Set<string>(),
    getResolvedRuntimes: () => [makeFakeRuntime()],
    getWorkspace: () => null,
    ...overrides,
  }
}

const TEST_TOKEN = 'test-token-abc123'

function createTestApi(deps: WorkerApiDeps) {
  return createWorkerApi(deps, { token: TEST_TOKEN, port: 0 })
}

async function fetchApi(app: ReturnType<typeof createWorkerApi>['app'], path: string, opts?: { token?: string | null }): Promise<Response> {
  const headers: Record<string, string> = {}
  const token = opts?.token === undefined ? TEST_TOKEN : opts.token
  if (token !== null) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return app.request(path, { headers })
}

// ─── Auth tests ─────────────────────────────────────────────────────────────

describe('Worker API auth', () => {
  test('rejects requests without token', async () => {
    const { app } = createTestApi(makeDeps())
    const res = await fetchApi(app, '/health', { token: null })
    expect(res.status).toBe(401)
  })

  test('rejects requests with wrong token', async () => {
    const { app } = createTestApi(makeDeps())
    const res = await fetchApi(app, '/health', { token: 'wrong-token' })
    expect(res.status).toBe(401)
  })

  test('accepts requests with correct token', async () => {
    const { app } = createTestApi(makeDeps())
    const res = await fetchApi(app, '/health')
    expect(res.status).toBe(200)
  })
})

// ─── Health endpoint ────────────────────────────────────────────────────────

describe('GET /health', () => {
  test('returns ok and uptime', async () => {
    const { app } = createTestApi(makeDeps())
    const res = await fetchApi(app, '/health')
    const data = await res.json() as any
    expect(data.ok).toBe(true)
    expect(typeof data.uptime_ms).toBe('number')
    expect(data.worker_id).toBe('worker-test-123')
  })
})

// ─── Status endpoint ────────────────────────────────────────────────────────

describe('GET /status', () => {
  test('returns worker identity and runtime status', async () => {
    const { app } = createTestApi(makeDeps())
    const res = await fetchApi(app, '/status')
    const data = await res.json() as any
    expect(data.worker_id).toBe('worker-test-123')
    expect(data.device_id).toBe('device-test')
    expect(data.name).toBe('Test Worker')
    expect(data.tags).toEqual(['dev'])
    expect(data.enrolled).toBe(false) // isLocalDev=true → enrolled=false
    expect(data.active_run_ids).toEqual([])
    expect(data.max_concurrent_runs).toBe(1)
    expect(data.runtimes).toHaveLength(1)
    expect(data.runtimes[0].runtime).toBe('claude-code')
    expect(data.runtimes[0].models).toEqual(['claude-sonnet-4-20250514'])
  })

  test('returns repo_root and default_branch when repo is configured', async () => {
    const repoRoot = await createTempGitRepo()
    const { app } = createTestApi(makeDeps({ repoRoot }))
    const res = await fetchApi(app, '/status')
    const data = await res.json() as any
    expect(data.repo_root).toBe(repoRoot)
    expect(data.default_branch).toBe('main')
  })

  test('returns active_run_ids when runs are active', async () => {
    const { app } = createTestApi(makeDeps({
      getActiveRunIds: () => new Set(['run-active-789', 'run-active-abc']),
    }))
    const res = await fetchApi(app, '/status')
    const data = await res.json() as any
    expect(data.active_run_ids).toEqual(expect.arrayContaining(['run-active-789', 'run-active-abc']))
    expect(data.active_run_ids).toHaveLength(2)
  })
})

// ─── Workspaces endpoints ───────────────────────────────────────────────────

describe('GET /workspaces', () => {
  test('returns empty array when no workspace manager', async () => {
    const { app } = createTestApi(makeDeps())
    const res = await fetchApi(app, '/workspaces')
    const data = await res.json() as any
    expect(data).toEqual([])
  })

  test('lists active worktrees', async () => {
    const repoRoot = await createTempGitRepo()
    const workspace = new WorkspaceManager({ repoRoot })
    // Create a worktree
    await workspace.acquire({ runId: 'run-ws-test' })

    const { app } = createTestApi(makeDeps({
      repoRoot,
      getWorkspace: () => workspace,
      getActiveRunIds: () => new Set(['run-ws-test']),
    }))

    const res = await fetchApi(app, '/workspaces')
    const data = await res.json() as any[]
    expect(data.length).toBeGreaterThanOrEqual(1)
    const ws = data.find((w: any) => w.run_id === 'run-ws-test')
    expect(ws).toBeDefined()
    expect(ws.branch).toBe('autopilot/run-ws-test')
    expect(ws.status).toBe('active')

    // Cleanup
    await workspace.release({ runId: 'run-ws-test', removeBranch: true })
  })
})

describe('GET /workspaces/:runId', () => {
  let repoRoot: string
  let workspace: WorkspaceManager

  beforeAll(async () => {
    repoRoot = await createTempGitRepo()
    workspace = new WorkspaceManager({ repoRoot })
    await workspace.acquire({ runId: 'run-detail-test' })
    // Make a change in the worktree so drift is visible
    const wtPath = workspace.worktreePath('run-detail-test')
    await writeFile(join(wtPath, 'new-file.txt'), 'hello\n')
    Bun.spawnSync(['git', 'add', '.'], { cwd: wtPath, stdout: 'pipe', stderr: 'pipe' })
    Bun.spawnSync(['git', 'commit', '-m', 'test change'], { cwd: wtPath, stdout: 'pipe', stderr: 'pipe' })
  })

  afterAll(async () => {
    await workspace.release({ runId: 'run-detail-test', removeBranch: true })
  })

  test('returns workspace detail with drift', async () => {
    const { app } = createTestApi(makeDeps({
      repoRoot,
      getWorkspace: () => workspace,
    }))

    const res = await fetchApi(app, '/workspaces/run-detail-test')
    const data = await res.json() as any
    expect(data.run_id).toBe('run-detail-test')
    expect(data.branch).toBe('autopilot/run-detail-test')
    expect(data.drift).toBeDefined()
    expect(data.drift.base_branch).toBe('main')
    expect(data.drift.ahead).toBeGreaterThanOrEqual(1)
    expect(data.drift.changed_files.length).toBeGreaterThanOrEqual(1)
  })

  test('returns 404 for non-existent workspace', async () => {
    const { app } = createTestApi(makeDeps({
      repoRoot,
      getWorkspace: () => workspace,
    }))

    const res = await fetchApi(app, '/workspaces/run-does-not-exist')
    expect(res.status).toBe(404)
  })
})

// ─── Diff endpoint ──────────────────────────────────────────────────────────

describe('GET /workspaces/:runId/diff', () => {
  let repoRoot: string
  let workspace: WorkspaceManager

  beforeAll(async () => {
    repoRoot = await createTempGitRepo()
    workspace = new WorkspaceManager({ repoRoot })
    await workspace.acquire({ runId: 'run-diff-test' })
    const wtPath = workspace.worktreePath('run-diff-test')
    await writeFile(join(wtPath, 'changed.ts'), 'export const x = 1\n')
    Bun.spawnSync(['git', 'add', '.'], { cwd: wtPath, stdout: 'pipe', stderr: 'pipe' })
    Bun.spawnSync(['git', 'commit', '-m', 'add file'], { cwd: wtPath, stdout: 'pipe', stderr: 'pipe' })
  })

  afterAll(async () => {
    await workspace.release({ runId: 'run-diff-test', removeBranch: true })
  })

  test('returns diff with file list and stats', async () => {
    const { app } = createTestApi(makeDeps({
      repoRoot,
      getWorkspace: () => workspace,
    }))

    const res = await fetchApi(app, '/workspaces/run-diff-test/diff')
    const data = await res.json() as any
    expect(data.base).toBe('main')
    expect(data.head).toBeTruthy()
    expect(data.files.length).toBeGreaterThanOrEqual(1)
    const changedFile = data.files.find((f: any) => f.path === 'changed.ts')
    expect(changedFile).toBeDefined()
    expect(changedFile.diff).toContain('export const x = 1')
    expect(data.stats.files_changed).toBeGreaterThanOrEqual(1)
  })

  test('returns single file diff when path query is set', async () => {
    const { app } = createTestApi(makeDeps({
      repoRoot,
      getWorkspace: () => workspace,
    }))

    const res = await fetchApi(app, '/workspaces/run-diff-test/diff?path=changed.ts')
    const data = await res.json() as any
    expect(data.files).toHaveLength(1)
    expect(data.files[0].path).toBe('changed.ts')
  })

  test('returns 404 for non-existent workspace', async () => {
    const { app } = createTestApi(makeDeps({
      repoRoot,
      getWorkspace: () => workspace,
    }))

    const res = await fetchApi(app, '/workspaces/run-nonexistent/diff')
    expect(res.status).toBe(404)
  })
})

// ─── Files endpoint ─────────────────────────────────────────────────────────

describe('GET /workspaces/:runId/files', () => {
  let repoRoot: string
  let workspace: WorkspaceManager

  beforeAll(async () => {
    repoRoot = await createTempGitRepo()
    workspace = new WorkspaceManager({ repoRoot })
    await workspace.acquire({ runId: 'run-files-test' })
    const wtPath = workspace.worktreePath('run-files-test')
    await mkdir(join(wtPath, 'src'), { recursive: true })
    await writeFile(join(wtPath, 'src', 'index.ts'), 'export {}\n')
    await writeFile(join(wtPath, 'package.json'), '{"name":"test"}\n')
  })

  afterAll(async () => {
    await workspace.release({ runId: 'run-files-test', removeBranch: true })
  })

  test('lists root directory', async () => {
    const { app } = createTestApi(makeDeps({
      repoRoot,
      getWorkspace: () => workspace,
    }))

    const res = await fetchApi(app, '/workspaces/run-files-test/files')
    const data = await res.json() as any[]
    expect(data.length).toBeGreaterThanOrEqual(2)
    // Should have src directory and some files
    const srcDir = data.find((f: any) => f.name === 'src')
    expect(srcDir).toBeDefined()
    expect(srcDir.type).toBe('directory')
    const pkg = data.find((f: any) => f.name === 'package.json')
    expect(pkg).toBeDefined()
    expect(pkg.type).toBe('file')
    expect(typeof pkg.size).toBe('number')
  })

  test('lists subdirectory', async () => {
    const { app } = createTestApi(makeDeps({
      repoRoot,
      getWorkspace: () => workspace,
    }))

    const res = await fetchApi(app, '/workspaces/run-files-test/files?path=src')
    const data = await res.json() as any[]
    const indexFile = data.find((f: any) => f.name === 'index.ts')
    expect(indexFile).toBeDefined()
    expect(indexFile.path).toBe('src/index.ts')
  })

  test('rejects path traversal', async () => {
    const { app } = createTestApi(makeDeps({
      repoRoot,
      getWorkspace: () => workspace,
    }))

    const res = await fetchApi(app, '/workspaces/run-files-test/files?path=../../')
    expect(res.status).toBe(400)
  })

  test('returns 404 for non-existent directory', async () => {
    const { app } = createTestApi(makeDeps({
      repoRoot,
      getWorkspace: () => workspace,
    }))

    const res = await fetchApi(app, '/workspaces/run-files-test/files?path=nonexistent')
    expect(res.status).toBe(404)
  })

  test('excludes hidden files/directories', async () => {
    const { app } = createTestApi(makeDeps({
      repoRoot,
      getWorkspace: () => workspace,
    }))

    const res = await fetchApi(app, '/workspaces/run-files-test/files')
    const data = await res.json() as any[]
    const hidden = data.filter((f: any) => f.name.startsWith('.'))
    expect(hidden).toHaveLength(0)
  })
})

// ─── Read-only boundary ─────────────────────────────────────────────────────

describe('Read-only boundary', () => {
  test('POST requests are not handled (404)', async () => {
    const { app } = createTestApi(makeDeps())
    const res = await app.request('/health', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` },
    })
    // Hono returns 404 for unmatched routes
    expect(res.status).toBe(404)
  })

  test('no mutation endpoints exist', async () => {
    const { app } = createTestApi(makeDeps())
    // Try common mutation paths — all should 404
    for (const path of ['/workspaces', '/tasks', '/runs', '/exec', '/git/commit']) {
      const res = await app.request(path, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TEST_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })
      expect(res.status).toBe(404)
    }
  })
})

// ─── Directories sorted correctly ───────────────────────────────────────────

describe('File listing sort order', () => {
  test('directories come before files', async () => {
    const repoRoot = await createTempGitRepo()
    const workspace = new WorkspaceManager({ repoRoot })
    await workspace.acquire({ runId: 'run-sort-test' })
    const wtPath = workspace.worktreePath('run-sort-test')
    await mkdir(join(wtPath, 'zebra'), { recursive: true })
    await writeFile(join(wtPath, 'alpha.txt'), 'a\n')

    const { app } = createTestApi(makeDeps({
      repoRoot,
      getWorkspace: () => workspace,
    }))

    const res = await fetchApi(app, '/workspaces/run-sort-test/files')
    const data = await res.json() as any[]
    // README.md from initial commit + alpha.txt + zebra/
    const dirIdx = data.findIndex((f: any) => f.name === 'zebra')
    const fileIdx = data.findIndex((f: any) => f.name === 'alpha.txt')
    expect(dirIdx).toBeLessThan(fileIdx)

    await workspace.release({ runId: 'run-sort-test', removeBranch: true })
  })
})

// ─── Response schema conformance ───────────────────────────────────────────

describe('Response schema conformance', () => {
  test('GET /health conforms to HealthResponseSchema', async () => {
    const { app } = createTestApi(makeDeps())
    const res = await fetchApi(app, '/health')
    const data = await res.json()
    expect(() => HealthResponseSchema.parse(data)).not.toThrow()
  })

  test('GET /status conforms to WorkerStatusSchema', async () => {
    const repoRoot = await createTempGitRepo()
    const { app } = createTestApi(makeDeps({ repoRoot }))
    const res = await fetchApi(app, '/status')
    const data = await res.json()
    expect(() => WorkerStatusSchema.parse(data)).not.toThrow()
  })

  test('GET /workspaces conforms to WorkspaceEntrySchema[]', async () => {
    const repoRoot = await createTempGitRepo()
    const workspace = new WorkspaceManager({ repoRoot })
    await workspace.acquire({ runId: 'run-schema-ws' })

    const { app } = createTestApi(makeDeps({
      repoRoot,
      getWorkspace: () => workspace,
      getActiveRunIds: () => new Set(['run-schema-ws']),
    }))

    const res = await fetchApi(app, '/workspaces')
    const data = await res.json()
    expect(() => z.array(WorkspaceEntrySchema).parse(data)).not.toThrow()

    await workspace.release({ runId: 'run-schema-ws', removeBranch: true })
  })

  test('GET /workspaces/:runId conforms to WorkspaceDetailSchema', async () => {
    const repoRoot = await createTempGitRepo()
    const workspace = new WorkspaceManager({ repoRoot })
    await workspace.acquire({ runId: 'run-schema-detail' })

    const { app } = createTestApi(makeDeps({
      repoRoot,
      getWorkspace: () => workspace,
    }))

    const res = await fetchApi(app, '/workspaces/run-schema-detail')
    const data = await res.json()
    expect(() => WorkspaceDetailSchema.parse(data)).not.toThrow()

    await workspace.release({ runId: 'run-schema-detail', removeBranch: true })
  })

  test('GET /workspaces/:runId/diff conforms to DiffResultSchema', async () => {
    const repoRoot = await createTempGitRepo()
    const workspace = new WorkspaceManager({ repoRoot })
    await workspace.acquire({ runId: 'run-schema-diff' })
    const wtPath = workspace.worktreePath('run-schema-diff')
    await writeFile(join(wtPath, 'file.ts'), 'export {}\n')
    Bun.spawnSync(['git', 'add', '.'], { cwd: wtPath, stdout: 'pipe', stderr: 'pipe' })
    Bun.spawnSync(['git', 'commit', '-m', 'change'], { cwd: wtPath, stdout: 'pipe', stderr: 'pipe' })

    const { app } = createTestApi(makeDeps({
      repoRoot,
      getWorkspace: () => workspace,
    }))

    const res = await fetchApi(app, '/workspaces/run-schema-diff/diff')
    const data = await res.json()
    expect(() => DiffResultSchema.parse(data)).not.toThrow()

    await workspace.release({ runId: 'run-schema-diff', removeBranch: true })
  })

  test('GET /workspaces/:runId/files conforms to FileEntrySchema[]', async () => {
    const repoRoot = await createTempGitRepo()
    const workspace = new WorkspaceManager({ repoRoot })
    await workspace.acquire({ runId: 'run-schema-files' })

    const { app } = createTestApi(makeDeps({
      repoRoot,
      getWorkspace: () => workspace,
    }))

    const res = await fetchApi(app, '/workspaces/run-schema-files/files')
    const data = await res.json()
    expect(() => z.array(FileEntrySchema).parse(data)).not.toThrow()

    await workspace.release({ runId: 'run-schema-files', removeBranch: true })
  })

  test('404 errors conform to ErrorResponseSchema', async () => {
    const repoRoot = await createTempGitRepo()
    const workspace = new WorkspaceManager({ repoRoot })

    const { app } = createTestApi(makeDeps({
      repoRoot,
      getWorkspace: () => workspace,
    }))

    const res = await fetchApi(app, '/workspaces/nonexistent')
    expect(res.status).toBe(404)
    const data = await res.json()
    expect(() => ErrorResponseSchema.parse(data)).not.toThrow()
  })
})

// ─── Typed client ──────────────────────────────────────────────────────────

describe('Typed worker API client', () => {
  test('WorkerApiAppType is usable with hc<>', () => {
    // Compile-time check: this must type-check without errors
    const _client = hc<WorkerApiAppType>('http://localhost:7779', {
      headers: { Authorization: 'Bearer test' },
    })
    // Verify the typed routes exist on the client
    expect(_client.health).toBeDefined()
    expect(_client.status).toBeDefined()
    expect(_client.workspaces).toBeDefined()
  })

  test('createWorkerApiClient returns typed client', () => {
    const client = createWorkerApiClient('http://localhost:7779', 'test-token')
    expect(client.health).toBeDefined()
    expect(client.status).toBeDefined()
    expect(client.workspaces).toBeDefined()
  })

  test('typed client can hit health endpoint via app.request', async () => {
    const { app } = createTestApi(makeDeps())
    // Use app.request directly (no real server needed)
    const res = await fetchApi(app, '/health')
    const data = await res.json()
    expect(() => HealthResponseSchema.parse(data)).not.toThrow()
  })
})
