/** Tests for the v2 VFS workspace proxy. */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { Hono } from 'hono'
import type { AppEnv } from '../src/api/app'
import { vfs } from '../src/api/routes/vfs'
import {
	DefaultWorkerRegistry,
	VfsReadOnlyError,
	VfsService,
	VfsUriError,
	parseVfsUri,
} from '../src/services/vfs'

function createTestApp(vfsService: VfsService) {
	const app = new Hono<AppEnv>()
	app.use('*', async (c, next) => {
		c.set('services', { vfsService } as any)
		await next()
	})
	app.route('/api/vfs', vfs)
	return app
}

describe('parseVfsUri', () => {
	test('parses workspace://run/run-177574/src/index.ts', () => {
		const result = parseVfsUri('workspace://run/run-177574/src/index.ts')
		expect(result).toEqual({ scheme: 'workspace', runId: 'run-177574', path: 'src/index.ts' })
	})

	test('parses workspace://run/abc123/', () => {
		const result = parseVfsUri('workspace://run/abc123/')
		expect(result).toEqual({ scheme: 'workspace', runId: 'abc123', path: '' })
	})

	test('rejects removed company:// scope', () => {
		expect(() => parseVfsUri('company://context/tone.md')).toThrow(VfsUriError)
	})

	test('throws VfsUriError for invalid://foo', () => {
		expect(() => parseVfsUri('invalid://foo')).toThrow(VfsUriError)
	})
})

describe('Workspace scope', () => {
	let svc: VfsService
	let mockServer: ReturnType<typeof Bun.serve>

	beforeAll(async () => {
		const mockApp = new Hono()

		mockApp.get('/workspaces/run-ws-mock/files', (c) => {
			const path = c.req.query('path') ?? ''
			if (path === 'src') {
				return c.json([
					{ name: 'index.ts', type: 'file', size: 28, path: 'src/index.ts' },
					{ name: 'binary.png', type: 'file', size: 8, path: 'src/binary.png' },
				])
			}
			return c.json([
				{ name: 'src', type: 'directory', path: 'src' },
				{ name: 'README.md', type: 'file', size: 8, path: 'README.md' },
			])
		})

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

		mockApp.get('/workspaces/run-ws-mock/diff', () => {
			return Response.json({
				base: 'main',
				head: 'abc123',
				files: [{ path: 'src/index.ts', status: 'added', diff: '+export const hello = "world"' }],
				stats: { files_changed: 1, insertions: 1, deletions: 0 },
			})
		})

		mockServer = Bun.serve({ port: 0, fetch: mockApp.fetch })
		const registry = new DefaultWorkerRegistry()
		registry.setLeaseLookup(async (runId) =>
			runId === 'run-ws-mock' ? { worker_id: 'mock-worker' } : undefined,
		)
		registry.setLocalWorker('mock-worker', {
			baseUrl: `http://localhost:${mockServer.port}`,
			token: 'mock-token',
		})
		svc = new VfsService(registry)
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
		expect(result.entries.some((entry) => entry.name === 'index.ts')).toBe(true)
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
		expect(result.files.length).toBe(1)
	})

	test('write to workspace scope throws VfsReadOnlyError', async () => {
		await expect(
			svc.write('workspace://run/run-ws-mock/src/index.ts', Buffer.from('nope')),
		).rejects.toThrow(VfsReadOnlyError)
	})
})

describe('VFS routes', () => {
	test('GET /api/vfs/stat rejects removed company:// scope', async () => {
		const app = createTestApp(new VfsService(new DefaultWorkerRegistry()))
		const res = await app.request('/api/vfs/stat?uri=company://context/tone.md')
		expect(res.status).toBe(400)
	})
})
