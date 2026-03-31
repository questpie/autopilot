import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Hono } from 'hono'
import { stringify as stringifyYaml } from 'yaml'
import type { AppEnv } from '../src/api/app'
import { configureContainer, container } from '../src/container'
import type { StorageBackend } from '../src/fs/storage'
import { setupTestApiKey, withApiKey } from './auth-helpers'

let app: ReturnType<typeof import('../src/api/app').createApp>
let companyRoot: string
let storage: StorageBackend
let apiKey: string

beforeAll(async () => {
	companyRoot = await mkdtemp(join(tmpdir(), 'api-routes-test-'))

	// Create required directory structure
	const dirs = [
		'tasks/backlog',
		'tasks/active',
		'tasks/review',
		'tasks/blocked',
		'tasks/done',
		'comms/channels/general',
		'comms/direct',
		'dashboard/pins',
		'logs/activity',
		'logs/sessions',
		'team',
		'team/workflows',
		'context/memory',
		'context/indexes',
	]
	for (const dir of dirs) {
		await mkdir(join(companyRoot, dir), { recursive: true })
	}

	// Write company.yaml
	const companyData = {
		name: 'Test Company',
		slug: 'test-company',
		description: 'A test company for API route tests',
		timezone: 'UTC',
		language: 'en',
		languages: ['en'],
		owner: {
			name: 'Test Owner',
			email: 'owner@test.com',
			notification_channels: [],
		},
		settings: {},
	}
	await writeFile(join(companyRoot, 'company.yaml'), stringifyYaml(companyData))

	// Create agents directory (empty — no agents)
	await mkdir(join(companyRoot, 'team', 'agents'), { recursive: true })

	// Configure DI container — must happen before any factory resolution.
	// Clear cached instances first to ensure clean state.
	container.clearAllInstances()
	configureContainer(companyRoot)

	// The storageFactory/dbFactory capture companyRootFactory by reference (the original
	// factory object that throws). configureContainer() creates a new factory in the map
	// but does not update the old reference. We pre-seed the instance cache so that
	// resolveFactory finds 'companyRoot' in the cache and never calls the old factory.
	// This mirrors what the container does internally: instances.set(name, value).
	;(container as any).instances.set('companyRoot', companyRoot)

	// Now we can safely import and resolve factories that depend on companyRoot
	const { storageFactory } = await import('../src/fs/sqlite-backend')
	const resolved = await container.resolveAsync([storageFactory])
	storage = resolved.storage
	apiKey = await setupTestApiKey(companyRoot)

	// Create the Hono app
	const { createApp } = await import('../src/api/app')
	app = createApp({ corsOrigin: '*' })
})

afterAll(async () => {
	if (storage) await storage.close()
	container.clearAllInstances()
	if (companyRoot) await rm(companyRoot, { recursive: true, force: true })
})

// ─── Helper ─────────────────────────────────────────────────────────────────

function makeTaskPayload(overrides: Record<string, unknown> = {}) {
	const ts = new Date().toISOString()
	return {
		id: overrides.id ?? `task-${Date.now().toString(36)}`,
		title: overrides.title ?? 'Test task',
		description: overrides.description ?? 'A test task description',
		type: overrides.type ?? 'implementation',
		status: overrides.status ?? 'backlog',
		priority: overrides.priority ?? 'medium',
		created_by: overrides.created_by ?? 'planner',
		created_at: ts,
		updated_at: ts,
		history: [{ at: ts, by: 'planner', action: 'created' }],
		...overrides,
	}
}

function request(path: string, init?: RequestInit) {
	return app.request(path, withApiKey(init, apiKey))
}

// ─── GET /api/status ────────────────────────────────────────────────────────

describe('GET /api/status', () => {
	it('should return full status for authenticated requests', async () => {
		const res = await request('/api/status')
		expect(res.status).toBe(200)

		const data = (await res.json()) as Record<string, unknown>
		expect(data.company).toBe('Test Company')
		expect(typeof data.userCount).toBe('number')
		expect(data.agentCount).toBe(0)
		expect(typeof data.activeTasks).toBe('number')
		expect(typeof data.runningSessions).toBe('number')
		expect(typeof data.pendingApprovals).toBe('number')
	})

	it('should return status payload even when unauthenticated (auth enabled)', async () => {
		// Create a separate app with auth enabled and no credentials supplied.
		// /api/status remains public for health checks and setup bootstrap.
		const { createApp } = await import('../src/api/app')
		const authApp = createApp({ corsOrigin: '*' })

		const res = await authApp.request('/api/status')
		expect(res.status).toBe(200)

		const data = (await res.json()) as Record<string, unknown>
		expect(data.company).toBe('Test Company')
		expect(typeof data.userCount).toBe('number')
		expect(typeof data.agentCount).toBe('number')
		expect(typeof data.activeTasks).toBe('number')
	})
})

// ─── GET /api/tasks ─────────────────────────────────────────────────────────

describe('GET /api/tasks', () => {
	it('should return an empty task list initially', async () => {
		const res = await request('/api/tasks')
		expect(res.status).toBe(200)

		const data = (await res.json()) as unknown[]
		expect(Array.isArray(data)).toBe(true)
	})

	it('should return tasks after creating some', async () => {
		await storage.createTask(makeTaskPayload({ id: 'list-t1', status: 'backlog' }) as any)
		await storage.createTask(makeTaskPayload({ id: 'list-t2', status: 'backlog' }) as any)

		const res = await request('/api/tasks')
		expect(res.status).toBe(200)

		const data = (await res.json()) as Array<{ id: string }>
		expect(data.length).toBeGreaterThanOrEqual(2)
		const ids = data.map((t) => t.id)
		expect(ids).toContain('list-t1')
		expect(ids).toContain('list-t2')
	})

	it('should filter tasks by status query param', async () => {
		await storage.createTask(makeTaskPayload({ id: 'filter-active', status: 'in_progress' }) as any)
		await storage.createTask(makeTaskPayload({ id: 'filter-backlog', status: 'backlog' }) as any)

		const res = await request('/api/tasks?status=in_progress')
		expect(res.status).toBe(200)

		const data = (await res.json()) as Array<{ id: string; status: string }>
		expect(data.every((t) => t.status === 'in_progress')).toBe(true)
		expect(data.some((t) => t.id === 'filter-active')).toBe(true)
	})
})

// ─── POST /api/tasks ────────────────────────────────────────────────────────

describe('POST /api/tasks', () => {
	it('should create a new task and return 201', async () => {
		const payload = makeTaskPayload({ id: 'create-t1', title: 'Created via API' })

		const res = await request('/api/tasks', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		})
		expect(res.status).toBe(201)

		const data = (await res.json()) as { id: string; title: string }
		expect(data.id).toBe('create-t1')
		expect(data.title).toBe('Created via API')

		// Verify it persists in storage
		const verify = await storage.readTask('create-t1')
		expect(verify).not.toBeNull()
		expect(verify!.title).toBe('Created via API')
	})

	it('should return 400 for invalid task body (missing required fields)', async () => {
		const res = await request('/api/tasks', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ title: 'No id or type' }),
		})
		expect(res.status).toBe(400)
	})
})

// ─── GET /api/tasks/:id ─────────────────────────────────────────────────────

describe('GET /api/tasks/:id', () => {
	it('should return a single task by id', async () => {
		await storage.createTask(makeTaskPayload({ id: 'get-t1', title: 'Single fetch' }) as any)

		const res = await request('/api/tasks/get-t1')
		expect(res.status).toBe(200)

		const data = (await res.json()) as { id: string; title: string }
		expect(data.id).toBe('get-t1')
		expect(data.title).toBe('Single fetch')
	})

	it('should return 404 for non-existent task', async () => {
		const res = await request('/api/tasks/does-not-exist')
		expect(res.status).toBe(404)

		const data = (await res.json()) as { error: string }
		expect(data.error).toBe('task not found')
	})
})

// ─── POST /api/tasks/:id/approve ────────────────────────────────────────────

describe('POST /api/tasks/:id/approve', () => {
	it('should move a task to done status', async () => {
		await storage.createTask(makeTaskPayload({ id: 'approve-t1', status: 'review' }) as any)

		const res = await request('/api/tasks/approve-t1/approve', { method: 'POST' })
		expect(res.status).toBe(200)

		const data = (await res.json()) as { ok: boolean; taskId: string; status: string }
		expect(data.ok).toBe(true)
		expect(data.taskId).toBe('approve-t1')
		expect(data.status).toBe('done')

		// Verify in storage
		const task = await storage.readTask('approve-t1')
		expect(task!.status).toBe('done')
	})

	it('should return 404 when approving non-existent task', async () => {
		const res = await request('/api/tasks/ghost-task/approve', { method: 'POST' })
		expect(res.status).toBe(404)
	})
})

// ─── POST /api/tasks/:id/reject ─────────────────────────────────────────────

describe('POST /api/tasks/:id/reject', () => {
	it('should move a task to blocked status with custom reason', async () => {
		await storage.createTask(makeTaskPayload({ id: 'reject-t1', status: 'review' }) as any)

		const res = await request('/api/tasks/reject-t1/reject', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ reason: 'Needs rework' }),
		})
		expect(res.status).toBe(200)

		const data = (await res.json()) as {
			ok: boolean
			taskId: string
			status: string
			reason: string
		}
		expect(data.ok).toBe(true)
		expect(data.taskId).toBe('reject-t1')
		expect(data.status).toBe('blocked')
		expect(data.reason).toBe('Needs rework')

		// Verify in storage
		const task = await storage.readTask('reject-t1')
		expect(task!.status).toBe('blocked')
	})

	it('should use default reason when none provided', async () => {
		await storage.createTask(makeTaskPayload({ id: 'reject-t2', status: 'review' }) as any)

		const res = await request('/api/tasks/reject-t2/reject', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({}),
		})
		expect(res.status).toBe(200)

		const data = (await res.json()) as { reason: string }
		expect(data.reason).toBe('Rejected by human')
	})

	it('should return 404 when rejecting non-existent task', async () => {
		const res = await request('/api/tasks/ghost-task/reject', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({}),
		})
		expect(res.status).toBe(404)
	})
})

// ─── GET /api/activity ──────────────────────────────────────────────────────

describe('GET /api/activity', () => {
	it('should return an empty activity feed initially', async () => {
		const res = await request('/api/activity')
		expect(res.status).toBe(200)

		const data = (await res.json()) as unknown[]
		expect(Array.isArray(data)).toBe(true)
	})

	it('should return activity entries after appending some', async () => {
		await storage.appendActivity({
			at: new Date().toISOString(),
			agent: 'developer',
			type: 'task_completed',
			summary: 'Finished task X',
			details: { task_id: 'task-1' },
		})
		await storage.appendActivity({
			at: new Date().toISOString(),
			agent: 'reviewer',
			type: 'code_reviewed',
			summary: 'Reviewed PR #42',
		})

		const res = await request('/api/activity')
		expect(res.status).toBe(200)

		const data = (await res.json()) as Array<{ agent: string; summary: string }>
		expect(data.length).toBeGreaterThanOrEqual(2)
	})

	it('should filter activity by agent query param', async () => {
		const res = await request('/api/activity?agent=developer')
		expect(res.status).toBe(200)

		const data = (await res.json()) as Array<{ agent: string }>
		expect(data.every((e) => e.agent === 'developer')).toBe(true)
	})

	it('should respect limit query param', async () => {
		const res = await request('/api/activity?limit=1')
		expect(res.status).toBe(200)

		const data = (await res.json()) as unknown[]
		expect(data.length).toBeLessThanOrEqual(1)
	})
})

// ─── GET /api/search ────────────────────────────────────────────────────────

describe('GET /api/search', () => {
	it('should return 400 when q parameter is missing', async () => {
		const res = await request('/api/search')
		expect(res.status).toBe(400)
	})

	it('should return search results structure for a query', async () => {
		const res = await request('/api/search?q=test')
		expect(res.status).toBe(200)

		const data = (await res.json()) as {
			results: unknown[]
			query: string
			mode: string
			total: number
		}
		expect(data.query).toBe('test')
		expect(Array.isArray(data.results)).toBe(true)
		expect(typeof data.total).toBe('number')
		expect(typeof data.mode).toBe('string')
	})

	it('should accept mode parameter', async () => {
		const res = await request('/api/search?q=hello&mode=fts')
		expect(res.status).toBe(200)

		const data = (await res.json()) as { mode: string }
		expect(data.mode).toBe('fts')
	})

	it('should accept type filter parameter', async () => {
		const res = await request('/api/search?q=hello&type=task')
		expect(res.status).toBe(200)

		const data = (await res.json()) as { results: unknown[]; query: string }
		expect(data.query).toBe('hello')
	})
})
