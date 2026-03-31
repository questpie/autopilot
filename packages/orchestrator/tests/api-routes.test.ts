import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Hono } from 'hono'
import { stringify as stringifyYaml } from 'yaml'
import type { AppEnv } from '../src/api/app'
import { configureContainer, container } from '../src/container'
import type { AutopilotDb } from '../src/db'
import * as authSchema from '../src/db/auth-schema'
import type { StorageBackend } from '../src/fs/storage'
import { readYamlUnsafe } from '../src/fs/yaml'
import { readSecretRecord } from '../src/secrets/store'
import { compileWorkflow, workflowRuntimeStoreFactory } from '../src/workflow'
import { setupTestApiKey, withApiKey } from './auth-helpers'

let app: ReturnType<typeof import('../src/api/app').createApp>
let companyRoot: string
let storage: StorageBackend
let apiKey: string
let db: AutopilotDb
let workflowRuntimeStore: Awaited<
	ReturnType<typeof container.resolveAsync<[typeof workflowRuntimeStoreFactory]>>
>['workflowRuntimeStore']

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
	const { dbFactory } = await import('../src/db')
	const resolved = await container.resolveAsync([
		storageFactory,
		workflowRuntimeStoreFactory,
		dbFactory,
	])
	storage = resolved.storage
	workflowRuntimeStore = resolved.workflowRuntimeStore
	db = resolved.db.db
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
		created_by: overrides.created_by ?? 'test-agent',
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

describe('GET /api/setup/verification-status', () => {
	it('should return email verification status without auth', async () => {
		const pendingEmail = 'pending@example.com'
		const verifiedEmail = 'verified@example.com'
		const now = new Date()

		await db.insert(authSchema.user).values([
			{
				id: 'user-pending',
				name: 'Pending User',
				email: pendingEmail,
				emailVerified: false,
				createdAt: now,
				updatedAt: now,
			},
			{
				id: 'user-verified',
				name: 'Verified User',
				email: verifiedEmail,
				emailVerified: true,
				createdAt: now,
				updatedAt: now,
			},
		])

		const pendingRes = await app.request(`/api/setup/verification-status?email=${pendingEmail}`)
		expect(pendingRes.status).toBe(200)
		expect(await pendingRes.json()).toEqual({ exists: true, verified: false })

		const verifiedRes = await app.request(`/api/setup/verification-status?email=${verifiedEmail}`)
		expect(verifiedRes.status).toBe(200)
		expect(await verifiedRes.json()).toEqual({ exists: true, verified: true })

		const missingRes = await app.request('/api/setup/verification-status?email=missing@example.com')
		expect(missingRes.status).toBe(200)
		expect(await missingRes.json()).toEqual({ exists: false, verified: false })
	})
})

describe('GET /api/setup/invite', () => {
	it('should validate active invite tokens without auth', async () => {
		const now = new Date()
		const expiresAt = new Date(now.getTime() + 1000 * 60 * 60)
		await db.insert(authSchema.invite).values({
			id: 'invite-1',
			email: 'invitee@example.com',
			role: 'member',
			token: 'invite-token-1',
			invitedBy: 'owner-1',
			createdAt: now,
			updatedAt: now,
			expiresAt,
			acceptedAt: null,
		})

		const validRes = await app.request('/api/setup/invite?token=invite-token-1')
		expect(validRes.status).toBe(200)
		const valid = (await validRes.json()) as {
			valid: boolean
			email: string | null
			role: string | null
			expiresAt: string | null
		}
		expect(valid.valid).toBe(true)
		expect(valid.email).toBe('invitee@example.com')
		expect(valid.role).toBe('member')
		expect(valid.expiresAt).toBeTruthy()

		const mismatchedRes = await app.request(
			'/api/setup/invite?token=invite-token-1&email=wrong@example.com',
		)
		expect(mismatchedRes.status).toBe(200)
		expect(await mismatchedRes.json()).toEqual({
			valid: false,
			email: null,
			role: null,
			expiresAt: null,
		})
	})
})

describe('settings providers and secrets', () => {
	it('stores provider keys in company secrets and updates company config', async () => {
		const saveRes = await request('/api/settings/providers/openrouter', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ apiKey: 'sk-or-test-provider-key' }),
		})
		expect(saveRes.status).toBe(200)

		const company = (await readYamlUnsafe(join(companyRoot, 'company.yaml'))) as {
			settings?: { ai_provider?: { provider?: string; secret_ref?: string } }
		}
		expect(company.settings?.ai_provider?.provider).toBe('openrouter')
		expect(company.settings?.ai_provider?.secret_ref).toBe('provider-openrouter')

		const secret = await readSecretRecord(companyRoot, 'provider-openrouter')
		expect(secret?.encrypted).toBe(true)
		expect(secret?.value).toBe('sk-or-test-provider-key')

		const statusRes = await request('/api/settings/providers')
		expect(statusRes.status).toBe(200)
		const status = (await statusRes.json()) as Record<string, { configured: boolean }>
		expect(status.openrouter?.configured).toBe(true)

		const deleteRes = await request('/api/settings/providers/openrouter', { method: 'DELETE' })
		expect(deleteRes.status).toBe(200)

		const removed = await readSecretRecord(companyRoot, 'provider-openrouter')
		expect(removed).toBeNull()
	})

	it('creates and lists encrypted secrets without exposing values', async () => {
		const createRes = await request('/api/settings/secrets', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name: 'stripe-api',
				value: 'sk_test_secret_123',
				type: 'api_token',
				allowed_agents: ['ops'],
				usage: 'billing.stripe',
			}),
		})
		expect(createRes.status).toBe(200)

		const listRes = await request('/api/settings/secrets')
		expect(listRes.status).toBe(200)
		const secrets = (await listRes.json()) as Array<{
			name: string
			encrypted: boolean
			hasValue: boolean
		}>
		expect(secrets.some((secret) => secret.name === 'stripe-api')).toBe(true)
		expect(secrets.find((secret) => secret.name === 'stripe-api')?.encrypted).toBe(true)
		expect(secrets.find((secret) => secret.name === 'stripe-api')?.hasValue).toBe(true)

		const stored = await readSecretRecord(companyRoot, 'stripe-api')
		expect(stored?.value).toBe('sk_test_secret_123')
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

// ─── GET /api/workflow-runs ─────────────────────────────────────────────────

describe('GET /api/workflow-runs', () => {
	it('should list workflow runs and expose run details by task id', async () => {
		const task = await storage.createTask(
			makeTaskPayload({
				id: 'workflow-run-task',
				workflow: 'development',
				workflow_step: 'implement',
				status: 'assigned',
				context: { spec: 'projects/web/spec.md' },
			}) as any,
		)

		const workflow = compileWorkflow({
			id: 'development',
			name: 'Development',
			version: 1,
			description: '',
			change_policy: {
				propose: ['any_agent'],
				evaluate: ['ceo'],
				apply: ['ceo'],
				human_approval_required_for: [],
			},
			changelog: [],
			steps: [
				{
					id: 'implement',
					type: 'agent',
					assigned_role: 'developer',
					description: 'Implement the feature',
					transitions: { done: 'complete' },
					auto_execute: false,
				},
				{
					id: 'complete',
					type: 'terminal',
					description: '',
					transitions: {},
					auto_execute: false,
				},
			],
		})

		const step = workflow.steps[0]
		if (!step) throw new Error('expected workflow step')

		await workflowRuntimeStore.recordEvaluation(task, workflow, step, {
			action: 'assign_agent',
			nextStep: 'implement',
			assignRole: 'developer',
			modelPolicy: 'cheap-execute',
			validationMode: 'auto',
			failureAction: 'block',
		})

		const listRes = await request('/api/workflow-runs?taskId=workflow-run-task')
		expect(listRes.status).toBe(200)
		const runs = (await listRes.json()) as Array<{ task_id: string; workflow_id: string }>
		expect(runs).toHaveLength(1)
		expect(runs[0]?.task_id).toBe('workflow-run-task')
		expect(runs[0]?.workflow_id).toBe('development')

		const detailRes = await request('/api/workflow-runs/task/workflow-run-task')
		expect(detailRes.status).toBe(200)
		const detail = (await detailRes.json()) as {
			run: { task_id: string; current_step_id: string }
			steps: Array<{ step_id: string; status: string; attempt: number }>
		}
		expect(detail.run.task_id).toBe('workflow-run-task')
		expect(detail.run.current_step_id).toBe('implement')
		expect(detail.steps).toHaveLength(1)
		expect(detail.steps[0]?.step_id).toBe('implement')
		expect(detail.steps[0]?.status).toBe('assigned')
		expect(detail.steps[0]?.attempt).toBe(1)
	})

	it('should return 404 when workflow run does not exist', async () => {
		const res = await request('/api/workflow-runs/task/ghost-task')
		expect(res.status).toBe(404)
	})

	it('should exclude archived runs by default and include them on request', async () => {
		const task = await storage.createTask(
			makeTaskPayload({
				id: 'archived-workflow-run-task',
				workflow: 'development',
				workflow_step: 'implement',
				status: 'assigned',
			}) as any,
		)

		const workflow = compileWorkflow({
			id: 'development',
			name: 'Development',
			version: 1,
			description: '',
			change_policy: {
				propose: ['any_agent'],
				evaluate: ['ceo'],
				apply: ['ceo'],
				human_approval_required_for: [],
			},
			changelog: [],
			steps: [
				{
					id: 'implement',
					type: 'agent',
					assigned_role: 'developer',
					description: 'Implement the feature',
					transitions: { done: 'complete' },
					auto_execute: false,
				},
				{
					id: 'complete',
					type: 'terminal',
					description: '',
					transitions: {},
					auto_execute: false,
				},
			],
		})

		const step = workflow.steps[0]
		if (!step) throw new Error('expected workflow step')

		await workflowRuntimeStore.recordEvaluation(task, workflow, step, {
			action: 'assign_agent',
			nextStep: 'implement',
			assignRole: 'developer',
			validationMode: 'auto',
			failureAction: 'block',
		})
		await workflowRuntimeStore.archiveWorkflowRunByTaskId(
			'archived-workflow-run-task',
			'test_archive',
		)

		const activeRes = await request('/api/workflow-runs?taskId=archived-workflow-run-task')
		expect(activeRes.status).toBe(200)
		const activeRuns = (await activeRes.json()) as Array<{ task_id: string }>
		expect(activeRuns).toHaveLength(0)

		const archivedRes = await request(
			'/api/workflow-runs?taskId=archived-workflow-run-task&includeArchived=true',
		)
		expect(archivedRes.status).toBe(200)
		const archivedRuns = (await archivedRes.json()) as Array<{
			task_id: string
			archived_at: string | null
		}>
		expect(archivedRuns).toHaveLength(1)
		expect(archivedRuns[0]?.task_id).toBe('archived-workflow-run-task')
		expect(archivedRuns[0]?.archived_at).toBeTruthy()
	})
})

// ─── POST /api/tasks/:id/approve ────────────────────────────────────────────

describe('POST /api/tasks/:id/approve', () => {
	it('should require admin/owner role', async () => {
		await storage.createTask(makeTaskPayload({ id: 'approve-t1', status: 'review' }) as any)

		const res = await request('/api/tasks/approve-t1/approve', { method: 'POST' })
		expect(res.status).toBe(403)

		// Verify in storage
		const task = await storage.readTask('approve-t1')
		expect(task!.status).toBe('review')
	})

	it('should return 403 for non-privileged actors before existence check', async () => {
		const res = await request('/api/tasks/ghost-task/approve', { method: 'POST' })
		expect(res.status).toBe(403)
	})
})

// ─── POST /api/tasks/:id/reject ─────────────────────────────────────────────

describe('POST /api/tasks/:id/reject', () => {
	it('should require admin/owner role for reject', async () => {
		await storage.createTask(makeTaskPayload({ id: 'reject-t1', status: 'review' }) as any)

		const res = await request('/api/tasks/reject-t1/reject', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ reason: 'Needs rework' }),
		})
		expect(res.status).toBe(403)

		// Verify in storage
		const task = await storage.readTask('reject-t1')
		expect(task!.status).toBe('review')
	})

	it('should return 403 for reject without privileged role', async () => {
		await storage.createTask(makeTaskPayload({ id: 'reject-t2', status: 'review' }) as any)

		const res = await request('/api/tasks/reject-t2/reject', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({}),
		})
		expect(res.status).toBe(403)
	})

	it('should return 403 for non-privileged actors before existence check', async () => {
		const res = await request('/api/tasks/ghost-task/reject', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({}),
		})
		expect(res.status).toBe(403)
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
