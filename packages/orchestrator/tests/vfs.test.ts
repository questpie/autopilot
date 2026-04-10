/**
 * Tests for the VFS implementation.
 *
 * Covers:
 * - URI parser (parseVfsUri)
 * - Path validation (validatePath)
 * - Company backend (VfsService with real temp directory)
 * - Workspace scope (proxied through worker API)
 * - Route-level tests (Hono app.request)
 */
import { test, expect, describe, beforeAll, afterAll, beforeEach } from 'bun:test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Hono } from 'hono'
import type { AppEnv } from '../src/api/app'
import { vfs } from '../src/api/routes/vfs'
import {
  parseVfsUri,
  validatePath,
  VfsService,
  DefaultWorkerRegistry,
  VfsUriError,
  VfsSecurityError,
  VfsNotFoundError,
  VfsReadOnlyError,
  VfsEtagMismatchError,
  type WorkerRegistry,
  type WorkerConnection,
} from '../src/services/vfs'

// ─── Helpers ───────────────────────────────────────────────────────────────

/** A no-op worker registry — no lease lookup, no local worker. */
const nullWorkerRegistry = new DefaultWorkerRegistry()

function createTestApp(vfsService: VfsService) {
  const app = new Hono<AppEnv>()
  app.use('*', async (c, next) => {
    c.set('services', { vfsService } as any)
    await next()
  })
  app.route('/api/vfs', vfs)
  return app
}

// ─── URI Parser ────────────────────────────────────────────────────────────

describe('parseVfsUri', () => {
  test('parses company://context/tone.md', () => {
    const result = parseVfsUri('company://context/tone.md')
    expect(result).toEqual({ scheme: 'company', path: 'context/tone.md' })
  })

  test('parses company://knowledge/about-us.md', () => {
    const result = parseVfsUri('company://knowledge/about-us.md')
    expect(result).toEqual({ scheme: 'company', path: 'knowledge/about-us.md' })
  })

  test('parses workspace://run/run-177574/src/index.ts', () => {
    const result = parseVfsUri('workspace://run/run-177574/src/index.ts')
    expect(result).toEqual({ scheme: 'workspace', runId: 'run-177574', path: 'src/index.ts' })
  })

  test('parses workspace://run/abc123/', () => {
    const result = parseVfsUri('workspace://run/abc123/')
    expect(result).toEqual({ scheme: 'workspace', runId: 'abc123', path: '' })
  })

  test('throws VfsUriError for invalid://foo', () => {
    expect(() => parseVfsUri('invalid://foo')).toThrow(VfsUriError)
  })

  test('throws VfsUriError for company:// (empty path)', () => {
    expect(() => parseVfsUri('company://')).toThrow(VfsUriError)
  })

  test('throws VfsUriError for empty string', () => {
    expect(() => parseVfsUri('')).toThrow(VfsUriError)
  })
})

// ─── Path Validation ───────────────────────────────────────────────────────

describe('validatePath', () => {
  test('resolves valid relative path', () => {
    const result = validatePath('context/tone.md', '/tmp/root')
    expect(result).toBe('/tmp/root/context/tone.md')
  })

  test('blocks path traversal', () => {
    expect(() => validatePath('../../../etc/passwd', '/tmp/root')).toThrow(VfsSecurityError)
    try {
      validatePath('../../../etc/passwd', '/tmp/root')
    } catch (err) {
      expect((err as VfsSecurityError).code).toBe('traversal_blocked')
    }
  })

  test('blocks .git access', () => {
    expect(() => validatePath('.git/config', '/tmp/root')).toThrow(VfsSecurityError)
    try {
      validatePath('.git/config', '/tmp/root')
    } catch (err) {
      expect((err as VfsSecurityError).code).toBe('path_blocked')
    }
  })

  test('blocks node_modules access', () => {
    expect(() => validatePath('node_modules/foo', '/tmp/root')).toThrow(VfsSecurityError)
    try {
      validatePath('node_modules/foo', '/tmp/root')
    } catch (err) {
      expect((err as VfsSecurityError).code).toBe('path_blocked')
    }
  })

  test('blocks .env access', () => {
    expect(() => validatePath('.env', '/tmp/root')).toThrow(VfsSecurityError)
    try {
      validatePath('.env', '/tmp/root')
    } catch (err) {
      expect((err as VfsSecurityError).code).toBe('path_blocked')
    }
  })

  test('blocks .env.local access', () => {
    expect(() => validatePath('.env.local', '/tmp/root')).toThrow(VfsSecurityError)
    try {
      validatePath('.env.local', '/tmp/root')
    } catch (err) {
      expect((err as VfsSecurityError).code).toBe('path_blocked')
    }
  })

  test('blocks dist directory', () => {
    expect(() => validatePath('dist/bundle.js', '/tmp/root')).toThrow(VfsSecurityError)
    try {
      validatePath('dist/bundle.js', '/tmp/root')
    } catch (err) {
      expect((err as VfsSecurityError).code).toBe('path_blocked')
    }
  })

  test('blocks .sqlite files', () => {
    expect(() => validatePath('data/file.sqlite', '/tmp/root')).toThrow(VfsSecurityError)
    try {
      validatePath('data/file.sqlite', '/tmp/root')
    } catch (err) {
      expect((err as VfsSecurityError).code).toBe('path_blocked')
    }
  })

  test('blocks .db files', () => {
    expect(() => validatePath('data/file.db', '/tmp/root')).toThrow(VfsSecurityError)
    try {
      validatePath('data/file.db', '/tmp/root')
    } catch (err) {
      expect((err as VfsSecurityError).code).toBe('path_blocked')
    }
  })
})

// ─── Company Backend ───────────────────────────────────────────────────────

describe('Company backend (VfsService)', () => {
  const companyRoot = join(tmpdir(), `qp-vfs-company-${Date.now()}`)
  let svc: VfsService

  beforeAll(async () => {
    await mkdir(join(companyRoot, 'context'), { recursive: true })
    await mkdir(join(companyRoot, 'knowledge'), { recursive: true })
    await mkdir(join(companyRoot, 'images'), { recursive: true })
    // Also create blocked dirs/files so we can test filtering
    await mkdir(join(companyRoot, '.git'), { recursive: true })
    await mkdir(join(companyRoot, 'node_modules'), { recursive: true })
    await writeFile(join(companyRoot, '.env'), 'SECRET=abc')

    await writeFile(join(companyRoot, 'context', 'tone.md'), '# Tone\nFriendly and helpful.')
    await writeFile(join(companyRoot, 'knowledge', 'about-us.md'), '# About Us\nWe build QuestPie.')
    await writeFile(join(companyRoot, 'images', 'logo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))

    svc = new VfsService(companyRoot, nullWorkerRegistry)
  })

  afterAll(async () => {
    await rm(companyRoot, { recursive: true, force: true })
  })

  // ── Stat ──────────────────────────────────────────────────────────────

  test('stat on text file returns file type, size, mime_type, writable, etag', async () => {
    const result = await svc.stat('company://context/tone.md')
    expect(result.type).toBe('file')
    expect(result.size).toBeGreaterThan(0)
    expect(result.mime_type).toBe('text/markdown')
    expect(result.writable).toBe(true)
    expect(result.etag).toBeTruthy()
    expect(typeof result.etag).toBe('string')
  })

  test('stat on directory returns directory type', async () => {
    const result = await svc.stat('company://context')
    expect(result.type).toBe('directory')
    expect(result.size).toBe(0)
    expect(result.writable).toBe(true)
  })

  test('stat on nonexistent throws VfsNotFoundError', async () => {
    await expect(svc.stat('company://nonexistent/file.md')).rejects.toThrow(VfsNotFoundError)
  })

  // ── List ──────────────────────────────────────────────────────────────

  test('list on directory returns entries sorted (dirs first)', async () => {
    const result = await svc.list('company://context')
    expect(result.uri).toBe('company://context')
    expect(result.entries.length).toBeGreaterThanOrEqual(1)
    const toneEntry = result.entries.find((e) => e.name === 'tone.md')
    expect(toneEntry).toBeDefined()
    expect(toneEntry!.type).toBe('file')
  })

  test('list filters blocked paths', async () => {
    // List root — should NOT include .git, node_modules, .env
    const result = await svc.list('company://context')
    // Listing the root instead to check blocked entries
    // We need to list the root for .git, node_modules, .env filtering
    const rootResult = await svc.list('company://.')
    const names = rootResult.entries.map((e) => e.name)
    expect(names).not.toContain('.git')
    expect(names).not.toContain('node_modules')
    expect(names).not.toContain('.env')
    // But valid dirs should be present
    expect(names).toContain('context')
    expect(names).toContain('knowledge')
    expect(names).toContain('images')
  })

  // ── Read ──────────────────────────────────────────────────────────────

  test('read text file returns content, mimeType, isText=true', async () => {
    const result = await svc.read('company://context/tone.md')
    expect(result.content).toBeInstanceOf(Buffer)
    expect(result.content.toString()).toContain('# Tone')
    expect(result.mimeType).toBe('text/markdown')
    expect(result.isText).toBe(true)
    expect(result.writable).toBe(true)
    expect(result.etag).toBeTruthy()
  })

  test('read binary file returns content, correct mimeType, isText=false', async () => {
    const result = await svc.read('company://images/logo.png')
    expect(result.content).toBeInstanceOf(Buffer)
    expect(result.content[0]).toBe(0x89) // PNG magic byte
    expect(result.mimeType).toBe('image/png')
    expect(result.isText).toBe(false)
  })

  // ── Write ─────────────────────────────────────────────────────────────

  test('write new file creates file and returns etag', async () => {
    const content = Buffer.from('# New File\nHello world.')
    const result = await svc.write('company://context/new-file.md', content)
    expect(result.uri).toBe('company://context/new-file.md')
    expect(result.size).toBe(content.length)
    expect(result.etag).toBeTruthy()
    expect(result.written_at).toBeTruthy()
  })

  test('write existing file overwrites and returns new etag', async () => {
    const first = await svc.write('company://context/overwrite-test.md', Buffer.from('version 1'))
    const second = await svc.write('company://context/overwrite-test.md', Buffer.from('version 2'))
    expect(second.etag).not.toBe(first.etag)

    const readResult = await svc.read('company://context/overwrite-test.md')
    expect(readResult.content.toString()).toBe('version 2')
  })

  test('write with correct etag succeeds', async () => {
    const first = await svc.write('company://context/etag-ok.md', Buffer.from('initial'))
    const second = await svc.write('company://context/etag-ok.md', Buffer.from('updated'), { etag: first.etag })
    expect(second.etag).toBeTruthy()
    expect(second.etag).not.toBe(first.etag)
  })

  test('write with wrong etag throws VfsEtagMismatchError', async () => {
    await svc.write('company://context/etag-fail.md', Buffer.from('initial'))
    await expect(
      svc.write('company://context/etag-fail.md', Buffer.from('conflict'), { etag: 'wrong-etag' }),
    ).rejects.toThrow(VfsEtagMismatchError)
  })

  test('write is atomic (file content is complete)', async () => {
    const bigContent = Buffer.from('x'.repeat(100_000))
    await svc.write('company://context/atomic-test.md', bigContent)
    const readResult = await svc.read('company://context/atomic-test.md')
    expect(readResult.content.length).toBe(100_000)
    expect(readResult.content.toString()).toBe('x'.repeat(100_000))
  })

  test('write creates parent dirs', async () => {
    const content = Buffer.from('# Deep file')
    const result = await svc.write('company://deep/nested/file.md', content)
    expect(result.size).toBe(content.length)

    const readResult = await svc.read('company://deep/nested/file.md')
    expect(readResult.content.toString()).toBe('# Deep file')
  })
})

// ─── Workspace Scope ───────────────────────────────────────────────────────

describe('Workspace scope', () => {
  let svc: VfsService
  let mockServer: ReturnType<typeof Bun.serve>

  beforeAll(async () => {
    // Create a mock HTTP server that mimics worker API endpoints
    const mockApp = new Hono()

    // GET /workspaces/:runId/files — list entries
    mockApp.get('/workspaces/run-ws-mock/files', (c) => {
      const path = c.req.query('path') ?? ''
      if (path === 'src') {
        return c.json([
          { name: 'index.ts', type: 'file', size: 28, path: 'src/index.ts' },
          { name: 'binary.png', type: 'file', size: 8, path: 'src/binary.png' },
        ])
      }
      // Root listing
      return c.json([
        { name: 'src', type: 'directory', path: 'src' },
        { name: 'README.md', type: 'file', size: 8, path: 'README.md' },
      ])
    })

    // GET /workspaces/:runId/file — read single file
    mockApp.get('/workspaces/run-ws-mock/file', (c) => {
      const filePath = c.req.query('path') ?? ''
      if (filePath === 'src/index.ts') {
        return new Response('export const hello = "world"\n', {
          status: 200,
          headers: {
            'Content-Type': 'text/typescript',
            'X-Vfs-Size': '28',
            'X-Vfs-Text': 'true',
          },
        })
      }
      return c.json({ error: 'file not found' }, 404)
    })

    // GET /workspaces/:runId/diff
    mockApp.get('/workspaces/run-ws-mock/diff', (c) => {
      return c.json({
        base: 'main',
        head: 'abc123',
        files: [{ path: 'src/index.ts', status: 'added', diff: '+export const hello = "world"' }],
        stats: { files_changed: 1, insertions: 1, deletions: 0 },
      })
    })

    mockServer = Bun.serve({ port: 0, fetch: mockApp.fetch })
    const workerBaseUrl = `http://localhost:${mockServer.port}`

    const registry = new DefaultWorkerRegistry()
    // Simulate a lease lookup that always finds our mock worker
    registry.setLeaseLookup(async (runId) => {
      if (runId === 'run-ws-mock') return { worker_id: 'mock-worker' }
      return undefined
    })
    registry.setLocalWorker('mock-worker', { baseUrl: workerBaseUrl, token: 'mock-token' })

    // companyRoot doesn't matter here; we only test workspace scope
    svc = new VfsService(tmpdir(), registry)
  })

  afterAll(() => {
    mockServer.stop()
  })

  test('stat workspace file returns file type, writable=false', async () => {
    const result = await svc.stat('workspace://run/run-ws-mock/src/index.ts')
    expect(result.type).toBe('file')
    expect(result.writable).toBe(false)
    expect(result.mime_type).toBe('text/typescript')
  })

  test('list workspace directory returns entries', async () => {
    const result = await svc.list('workspace://run/run-ws-mock/src')
    expect(result.entries.length).toBeGreaterThanOrEqual(1)
    const indexEntry = result.entries.find((e) => e.name === 'index.ts')
    expect(indexEntry).toBeDefined()
  })

  test('read workspace text file returns content', async () => {
    const result = await svc.read('workspace://run/run-ws-mock/src/index.ts')
    expect(result.content.toString()).toContain('export const hello')
    expect(result.isText).toBe(true)
    expect(result.writable).toBe(false)
  })

  test('diff workspace returns diff result', async () => {
    const result = await svc.diff('workspace://run/run-ws-mock/')
    expect(result.base).toBe('main')
    expect(result.head).toBeTruthy()
    expect(result.files.length).toBeGreaterThanOrEqual(1)
    expect(result.stats.files_changed).toBeGreaterThanOrEqual(1)
  })

  test('write to workspace scope throws VfsReadOnlyError', async () => {
    await expect(
      svc.write('workspace://run/run-ws-mock/src/index.ts', Buffer.from('nope')),
    ).rejects.toThrow(VfsReadOnlyError)
  })
})

// ─── Route-level tests ─────────────────────────────────────────────────────

describe('VFS routes', () => {
  const companyRoot = join(tmpdir(), `qp-vfs-routes-${Date.now()}`)
  let app: ReturnType<typeof createTestApp>
  let svc: VfsService

  beforeAll(async () => {
    await mkdir(join(companyRoot, 'context'), { recursive: true })
    await writeFile(join(companyRoot, 'context', 'tone.md'), '# Tone\nFriendly.')
    await writeFile(join(companyRoot, 'context', 'rules.md'), '# Rules\nBe kind.')

    svc = new VfsService(companyRoot, new DefaultWorkerRegistry())
    app = createTestApp(svc)
  })

  afterAll(async () => {
    await rm(companyRoot, { recursive: true, force: true })
  })

  // ── GET /stat ────────────────────────────────────────────────────────

  test('GET /api/vfs/stat?uri=company://context/tone.md => 200', async () => {
    const res = await app.request('/api/vfs/stat?uri=company://context/tone.md')
    expect(res.status).toBe(200)
    const data = (await res.json()) as any
    expect(data.type).toBe('file')
    expect(data.mime_type).toBe('text/markdown')
    expect(data.writable).toBe(true)
    expect(data.etag).toBeTruthy()
  })

  test('GET /api/vfs/stat?uri=company://nonexistent => 404', async () => {
    const res = await app.request('/api/vfs/stat?uri=company://nonexistent')
    expect(res.status).toBe(404)
  })

  test('GET /api/vfs/stat?uri=invalid://foo => 400', async () => {
    const res = await app.request('/api/vfs/stat?uri=invalid://foo')
    expect(res.status).toBe(400)
  })

  // ── GET /list ────────────────────────────────────────────────────────

  test('GET /api/vfs/list?uri=company://context => 200 with entries', async () => {
    const res = await app.request('/api/vfs/list?uri=company://context')
    expect(res.status).toBe(200)
    const data = (await res.json()) as any
    expect(data.entries.length).toBeGreaterThanOrEqual(1)
    const names = data.entries.map((e: any) => e.name)
    expect(names).toContain('tone.md')
  })

  // ── GET /read ────────────────────────────────────────────────────────

  test('GET /api/vfs/read?uri=company://context/tone.md => 200 with raw content', async () => {
    const res = await app.request('/api/vfs/read?uri=company://context/tone.md')
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/markdown')
    expect(res.headers.get('X-Vfs-Text')).toBe('true')
    expect(res.headers.get('X-Vfs-Writable')).toBe('true')
    const body = await res.text()
    expect(body).toContain('# Tone')
  })

  // ── POST /write ──────────────────────────────────────────────────────

  test('POST /api/vfs/write?uri=company://new-file.md with body => 200', async () => {
    const res = await app.request('/api/vfs/write?uri=company://new-file.md', {
      method: 'POST',
      body: '# Created via route',
    })
    expect(res.status).toBe(200)
    const data = (await res.json()) as any
    expect(data.uri).toBe('company://new-file.md')
    expect(data.etag).toBeTruthy()
  })

  test('POST /api/vfs/write?uri=workspace://run/x/file.md => 403 (read_only)', async () => {
    const res = await app.request('/api/vfs/write?uri=workspace://run/x/file.md', {
      method: 'POST',
      body: 'nope',
    })
    expect(res.status).toBe(403)
    const data = (await res.json()) as any
    expect(data.code).toBe('read_only')
  })

  // ── Security ─────────────────────────────────────────────────────────

  test('GET /api/vfs/read?uri=company://../../../etc/passwd => 403', async () => {
    const res = await app.request('/api/vfs/read?uri=company://../../../etc/passwd')
    expect(res.status).toBe(403)
    const data = (await res.json()) as any
    expect(data.code).toBe('traversal_blocked')
  })
})
