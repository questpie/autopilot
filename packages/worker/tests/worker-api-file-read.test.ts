/**
 * Tests for the /workspaces/:runId/file endpoint on the worker API.
 *
 * Covers:
 * - Text file read with correct headers
 * - Binary file read with correct headers
 * - Path traversal blocking
 * - Blocked paths (.git, node_modules, .env)
 * - Nonexistent file/workspace handling
 * - Directory vs file distinction
 * - Missing query params
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createWorkerApi, type WorkerApiDeps } from '../src/api'
import { WorkspaceManager } from '../src/workspace'
import type { ResolvedRuntime } from '../src/runtime-config'
import type { WorkerCapability } from '../src/worker'

// ─── Test helpers ───────────────────────────────────────────────────────────

async function createTempGitRepo(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'worker-file-read-test-'))
  Bun.spawnSync(['git', 'init', '-b', 'main'], { cwd: dir, stdout: 'pipe', stderr: 'pipe' })
  Bun.spawnSync(['git', 'config', 'user.email', 'test@test.com'], { cwd: dir, stdout: 'pipe', stderr: 'pipe' })
  Bun.spawnSync(['git', 'config', 'user.name', 'Test'], { cwd: dir, stdout: 'pipe', stderr: 'pipe' })
  await writeFile(join(dir, 'README.md'), '# Test repo\n')
  Bun.spawnSync(['git', 'add', '.'], { cwd: dir, stdout: 'pipe', stderr: 'pipe' })
  Bun.spawnSync(['git', 'commit', '-m', 'initial'], { cwd: dir, stdout: 'pipe', stderr: 'pipe' })
  return dir
}

function makeFakeRuntime(): ResolvedRuntime {
  return {
    config: { runtime: 'claude-code', models: ['claude-opus-4-6'], tags: ['test'] },
    resolvedBinaryPath: '/usr/bin/true',
    adapter: { start: async () => undefined, onEvent: () => {}, stop: async () => {} },
    capability: {
      runtime: 'claude-code',
      models: ['claude-opus-4-6'],
      maxConcurrent: 1,
      tags: ['test'],
    } as WorkerCapability,
  }
}

function makeDeps(overrides: Partial<WorkerApiDeps> = {}): WorkerApiDeps {
  return {
    workerId: 'worker-file-test',
    deviceId: 'device-file-test',
    name: 'File Read Test Worker',
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

const TEST_TOKEN = 'test-file-read-token'

function createTestApi(deps: WorkerApiDeps) {
  return createWorkerApi(deps, { token: TEST_TOKEN, port: 0 })
}

async function fetchApi(
  app: ReturnType<typeof createWorkerApi>['app'],
  path: string,
  opts?: { token?: string | null },
): Promise<Response> {
  const headers: Record<string, string> = {}
  const token = opts?.token === undefined ? TEST_TOKEN : opts.token
  if (token !== null) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return app.request(path, { headers })
}

// ─── File read endpoint tests ──────────────────────────────────────────────

describe('GET /workspaces/:runId/file', () => {
  let repoRoot: string
  let workspace: WorkspaceManager
  let app: ReturnType<typeof createWorkerApi>['app']

  beforeAll(async () => {
    repoRoot = await createTempGitRepo()
    workspace = new WorkspaceManager({ repoRoot })
    await workspace.acquire({ runId: 'run-file-test' })

    const wtPath = workspace.worktreePath('run-file-test')

    // Write text file
    await mkdir(join(wtPath, 'src'), { recursive: true })
    await writeFile(join(wtPath, 'src', 'index.ts'), 'export const hello = "world"\n')

    // Write binary file (PNG magic bytes)
    await writeFile(join(wtPath, 'src', 'logo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))

    // Write a directory for "not a file" test
    await mkdir(join(wtPath, 'src', 'subdir'), { recursive: true })
    await writeFile(join(wtPath, 'src', 'subdir', 'nested.ts'), 'export {}')

    // Commit so workspace is clean
    Bun.spawnSync(['git', 'add', '.'], { cwd: wtPath, stdout: 'pipe', stderr: 'pipe' })
    Bun.spawnSync(['git', 'commit', '-m', 'add test files'], { cwd: wtPath, stdout: 'pipe', stderr: 'pipe' })

    const result = createTestApi(makeDeps({
      repoRoot,
      getWorkspace: () => workspace,
      getActiveRunIds: () => new Set(['run-file-test']),
    }))
    app = result.app
  })

  afterAll(async () => {
    await workspace.release({ runId: 'run-file-test', removeBranch: true })
  })

  test('read text file returns 200 with correct Content-Type and X-Vfs-Text=true', async () => {
    const res = await fetchApi(app, '/workspaces/run-file-test/file?path=src/index.ts')
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/typescript')
    expect(res.headers.get('X-Vfs-Text')).toBe('true')
    expect(res.headers.get('X-Vfs-Type')).toBe('file')
    const body = await res.text()
    expect(body).toContain('export const hello')
  })

  test('read binary file returns 200 with correct Content-Type and X-Vfs-Text=false', async () => {
    const res = await fetchApi(app, '/workspaces/run-file-test/file?path=src/logo.png')
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/png')
    expect(res.headers.get('X-Vfs-Text')).toBe('false')
    const buf = Buffer.from(await res.arrayBuffer())
    expect(buf[0]).toBe(0x89)
    expect(buf[1]).toBe(0x50)
  })

  test('path traversal is blocked with 400', async () => {
    const res = await fetchApi(app, '/workspaces/run-file-test/file?path=../../etc/passwd')
    expect(res.status).toBe(400)
    const data = (await res.json()) as any
    expect(data.error).toContain('traversal')
  })

  test('blocked path .git/config returns 403', async () => {
    const res = await fetchApi(app, '/workspaces/run-file-test/file?path=.git/config')
    expect(res.status).toBe(403)
    const data = (await res.json()) as any
    expect(data.error).toContain('blocked')
  })

  test('blocked path node_modules/foo returns 403', async () => {
    const res = await fetchApi(app, '/workspaces/run-file-test/file?path=node_modules/foo')
    expect(res.status).toBe(403)
    const data = (await res.json()) as any
    expect(data.error).toContain('blocked')
  })

  test('blocked path .env.local returns 403', async () => {
    const res = await fetchApi(app, '/workspaces/run-file-test/file?path=.env.local')
    expect(res.status).toBe(403)
    const data = (await res.json()) as any
    expect(data.error).toContain('blocked')
  })

  test('nonexistent file returns 404', async () => {
    const res = await fetchApi(app, '/workspaces/run-file-test/file?path=src/doesnotexist.ts')
    expect(res.status).toBe(404)
    const data = (await res.json()) as any
    expect(data.error).toContain('not found')
  })

  test('directory path returns 400 (not a file)', async () => {
    const res = await fetchApi(app, '/workspaces/run-file-test/file?path=src/subdir')
    expect(res.status).toBe(400)
    const data = (await res.json()) as any
    expect(data.error).toContain('not a file')
  })

  test('missing path query param returns 400', async () => {
    const res = await fetchApi(app, '/workspaces/run-file-test/file')
    expect(res.status).toBe(400)
  })

  test('nonexistent workspace returns 404', async () => {
    const res = await fetchApi(app, '/workspaces/run-does-not-exist/file?path=src/index.ts')
    expect(res.status).toBe(404)
    const data = (await res.json()) as any
    expect(data.error).toContain('not found')
  })
})
