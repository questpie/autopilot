/** Tests for project workspace inspection. */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { Hono } from 'hono'
import type { AppEnv } from '../src/api/app'
import { workspaceInspection } from '../src/api/routes/workspace-inspection'
import { buildGitDiffContext } from '../src/services/git-providers'
import {
	DefaultWorkerRegistry,
	WorkspaceInspectionService,
} from '../src/services/workspace-inspection'

function createTestApp(
	workspaceInspectionService: WorkspaceInspectionService,
	extraServices: Partial<AppEnv['Variables']['services']> = {},
) {
	const app = new Hono<AppEnv>()
	app.use('*', async (c, next) => {
		c.set('services', { workspaceInspectionService, ...extraServices } as any)
		await next()
	})
	app.route('/api/workspace-inspection', workspaceInspection)
	return app
}

describe('git provider adapters', () => {
	test('builds GitHub compare and pull request links from ssh remote', () => {
		const context = buildGitDiffContext({
			remoteUrl: 'git@github.com:questpie/autopilot.git',
			defaultBranch: 'main',
			base: 'main',
			head: 'feature/project-surface',
		})

		expect(context?.provider).toBe('github')
		expect(context?.web_url).toBe('https://github.com/questpie/autopilot')
		expect(context?.compare_url).toContain('/compare/main...feature/project-surface')
		expect(context?.change_request_kind).toBe('pull_request')
	})

	test('builds GitLab compare and merge request links from https remote', () => {
		const context = buildGitDiffContext({
			remoteUrl: 'https://gitlab.com/questpie/autopilot.git',
			defaultBranch: 'main',
			base: 'main',
			head: 'feature/project-surface',
		})

		expect(context?.provider).toBe('gitlab')
		expect(context?.web_url).toBe('https://gitlab.com/questpie/autopilot')
		expect(context?.compare_url).toContain('/-/compare/main...feature/project-surface')
		expect(context?.change_request_kind).toBe('merge_request')
		expect(context?.change_request_url).toContain('/-/merge_requests/new?')
	})
})

describe('Workspace inspection', () => {
	let svc: WorkspaceInspectionService
	let mockServer: ReturnType<typeof Bun.serve>

	beforeAll(async () => {
		const mockApp = new Hono()

		mockApp.get('/workspaces/run-ws-mock/tree', (c) => {
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

		mockApp.get('/workspaces/run-ws-mock/read', (c) => {
			const filePath = c.req.query('path') ?? ''
			if (filePath === 'src/index.ts') {
				return new Response('export const hello = "world"\n', {
					status: 200,
					headers: {
						'Content-Type': 'text/typescript',
						'X-Workspace-Inspection-Size': '28',
						'X-Workspace-Inspection-Text': 'true',
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
		svc = new WorkspaceInspectionService(registry)
	})

	afterAll(() => {
		mockServer.stop()
	})

	test('stat run file returns file type, writable=false', async () => {
		const result = await svc.statRun('run-ws-mock', 'src/index.ts')
		expect(result.type).toBe('file')
		expect(result.writable).toBe(false)
		expect(result.mime_type).toBe('text/typescript')
	})

	test('list run directory returns entries', async () => {
		const result = await svc.listRun('run-ws-mock', 'src')
		expect(result.entries.some((entry) => entry.name === 'index.ts')).toBe(true)
	})

	test('read run text file returns content', async () => {
		const result = await svc.readRun('run-ws-mock', 'src/index.ts')
		expect(result.content.toString()).toContain('export const hello')
		expect(result.isText).toBe(true)
		expect(result.writable).toBe(false)
	})

	test('diff run returns diff result', async () => {
		const result = await svc.diffRun('run-ws-mock')
		expect(result.base).toBe('main')
		expect(result.files.length).toBe(1)
	})

	test('workspace inspection list returns project run entries without virtual URI input', async () => {
		const app = createTestApp(svc)
		const res = await app.request('/api/workspace-inspection/list?run_id=run-ws-mock&path=src')
		const body = await res.json()

		expect(res.status).toBe(200)
		expect(body.run_id).toBe('run-ws-mock')
		expect(body.path).toBe('src')
		expect(body.entries.some((entry: { name: string }) => entry.name === 'index.ts')).toBe(true)
		expect(body.uri).toBeUndefined()
	})

	test('workspace inspection read returns text content and read-only headers', async () => {
		const app = createTestApp(svc)
		const res = await app.request(
			'/api/workspace-inspection/read?run_id=run-ws-mock&path=src/index.ts',
		)
		const content = await res.text()

		expect(res.status).toBe(200)
		expect(content).toContain('export const hello')
		expect(res.headers.get('x-workspace-inspection-text')).toBe('true')
		expect(res.headers.get('x-workspace-inspection-writable')).toBe('false')
	})

	test('workspace inspection diff returns git diff result for a run', async () => {
		const app = createTestApp(svc)
		const res = await app.request('/api/workspace-inspection/diff?run_id=run-ws-mock')
		const body = await res.json()

		expect(res.status).toBe(200)
		expect(body.run_id).toBe('run-ws-mock')
		expect(body.files).toHaveLength(1)
		expect(body.files[0].path).toBe('src/index.ts')
	})

	test('workspace inspection diff includes GitHub adapter links for project runs', async () => {
		const app = createTestApp(svc, {
			runService: {
				get: async (runId: string) =>
					runId === 'run-ws-mock' ? ({ id: runId, project_id: 'proj-mock' } as any) : undefined,
			} as any,
			projectService: {
				get: async (projectId: string) =>
					projectId === 'proj-mock'
						? ({
								id: projectId,
								git_remote: 'git@github.com:questpie/autopilot.git',
								default_branch: 'main',
							} as any)
						: undefined,
			} as any,
		})
		const res = await app.request('/api/workspace-inspection/diff?run_id=run-ws-mock')
		const body = await res.json()

		expect(res.status).toBe(200)
		expect(body.git.provider).toBe('github')
		expect(body.git.web_url).toBe('https://github.com/questpie/autopilot')
		expect(body.git.change_request_kind).toBe('pull_request')
		expect(body.git.compare_url).toContain('/compare/main...abc123')
		expect(body.git.change_request_url).toContain('expand=1')
	})
})
