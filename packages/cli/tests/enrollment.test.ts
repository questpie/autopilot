/**
 * Worker enrollment tests.
 *
 * Tests the join token → enroll → machine auth → worker API flow.
 */
import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Hono } from 'hono'
import type { AppEnv, Services } from '@questpie/autopilot-orchestrator'
import { tasks } from '../../orchestrator/src/api/routes/tasks'
import { runs } from '../../orchestrator/src/api/routes/runs'
import { workers } from '../../orchestrator/src/api/routes/workers'
import { enrollment } from '../../orchestrator/src/api/routes/enrollment'
import { events } from '../../orchestrator/src/api/routes/events'
import { workerAuthMiddleware } from '../../orchestrator/src/api/middleware/worker-auth'
import { createCompanyDb, type CompanyDb, type CompanyDbResult } from '../../orchestrator/src/db'
import { createAuth, type Auth } from '../../orchestrator/src/auth'
import type { Actor } from '../../orchestrator/src/auth/types'
import { TaskService, RunService, WorkerService, EnrollmentService, WorkflowEngine, ActivityService } from '../../orchestrator/src/services'

const FAKE_ACTOR: Actor = {
	id: 'admin',
	type: 'human',
	name: 'Admin',
	role: 'owner',
	source: 'api',
}

function buildTestApp(config: {
	companyRoot: string
	db: CompanyDb
	auth: Auth
	services: Services
}) {
	const app = new Hono<AppEnv>()
	app.use('*', async (c, next) => {
		c.set('companyRoot', config.companyRoot)
		c.set('db', config.db)
		c.set('auth', config.auth)
		c.set('services', config.services)
		c.set('authoredConfig', { company: {} as any, agents: new Map(), workflows: new Map(), environments: new Map() })
		c.set('actor', FAKE_ACTOR)
		c.set('workerId', null)
		await next()
	})

	// Worker routes require worker auth — local dev bypass allowed for testing
	const workerAuth = workerAuthMiddleware({ allowLocalDevBypass: true })
	app.use('/api/workers/*', workerAuth)
	app.use('/api/workers', workerAuth)

	app.route('/api/enrollment', enrollment)
	app.route('/api/workers', workers)
	app.route('/api/runs', runs)
	app.route('/api/tasks', tasks)
	app.route('/api/events', events)
	return app
}

function post(body: unknown, headers?: Record<string, string>): RequestInit {
	return {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', ...headers },
		body: JSON.stringify(body),
	}
}

describe('Worker enrollment', () => {
	const companyRoot = join(tmpdir(), `qp-enroll-${Date.now()}`)
	let dbResult: CompanyDbResult
	let auth: Auth
	let services: Services
	let app: ReturnType<typeof buildTestApp>

	beforeAll(async () => {
		await mkdir(companyRoot, { recursive: true })
		await writeFile(
			join(companyRoot, 'company.yaml'),
			'name: enroll-test\nowner:\n  name: Test\n  email: t@t.com\n',
		)

		dbResult = await createCompanyDb(companyRoot)

		// Create tables
		for (const sql of [
			`CREATE TABLE IF NOT EXISTS join_tokens (
				id TEXT PRIMARY KEY, secret_hash TEXT NOT NULL, description TEXT,
				created_by TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL,
				used_at TEXT, used_by_worker_id TEXT
			)`,
			`CREATE TABLE IF NOT EXISTS workers (
				id TEXT PRIMARY KEY, device_id TEXT, name TEXT,
				status TEXT NOT NULL DEFAULT 'offline', capabilities TEXT DEFAULT '[]',
				registered_at TEXT NOT NULL, last_heartbeat TEXT,
				machine_secret_hash TEXT
			)`,
			`CREATE TABLE IF NOT EXISTS worker_leases (
				id TEXT PRIMARY KEY, worker_id TEXT NOT NULL, run_id TEXT NOT NULL,
				claimed_at TEXT NOT NULL, expires_at TEXT NOT NULL,
				status TEXT NOT NULL DEFAULT 'active'
			)`,
			`CREATE TABLE IF NOT EXISTS tasks (
				id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT DEFAULT '',
				type TEXT NOT NULL, status TEXT NOT NULL, priority TEXT DEFAULT 'medium',
				assigned_to TEXT, workflow_id TEXT, workflow_step TEXT,
				context TEXT DEFAULT '{}', metadata TEXT DEFAULT '{}',
				created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
			)`,
			`CREATE TABLE IF NOT EXISTS runs (
				id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, task_id TEXT, worker_id TEXT,
				runtime TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
				initiated_by TEXT, instructions TEXT, summary TEXT,
				tokens_input INTEGER DEFAULT 0, tokens_output INTEGER DEFAULT 0,
				error TEXT, started_at TEXT, ended_at TEXT, created_at TEXT NOT NULL,
				runtime_session_ref TEXT, resumed_from_run_id TEXT,
				preferred_worker_id TEXT, resumable INTEGER DEFAULT 0
			)`,
			`CREATE TABLE IF NOT EXISTS run_events (
				id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL,
				type TEXT NOT NULL, summary TEXT, metadata TEXT DEFAULT '{}',
				created_at TEXT NOT NULL
			)`,
		]) {
			await dbResult.raw.execute(sql)
		}

		auth = await createAuth(dbResult.db, companyRoot)
		const taskService = new TaskService(dbResult.db)
		const runService = new RunService(dbResult.db)
		const workerService = new WorkerService(dbResult.db)
		const enrollmentService = new EnrollmentService(dbResult.db)
		const activityService = new ActivityService(dbResult.db)
		const workflowEngine = new WorkflowEngine(
			{
				company: { name: 'test', slug: 'test', description: '', timezone: 'UTC', language: 'en', owner: { name: 'Test', email: 'test@test.com' }, settings: { auto_assign: true, require_approval: [], max_concurrent_agents: 1, budget: { daily_token_limit: 0, alert_at: 0 }, auth: {}, inference: { gateway_base_url: '', text_model: '', embedding_model: '', embedding_dimensions: 768 }, default_runtime: 'claude-code' }, setup_completed: false },
				agents: new Map(),
				workflows: new Map(),
			},
			taskService,
			runService,
		)
		services = { taskService, runService, workerService, enrollmentService, activityService, workflowEngine }
		app = buildTestApp({ companyRoot, db: dbResult.db, auth, services })
	})

	afterAll(async () => {
		dbResult.raw.close()
		await rm(companyRoot, { recursive: true, force: true })
	})

	test('create join token returns id, secret, expires_at', async () => {
		const res = await app.request(
			'/api/enrollment/tokens',
			post({ description: 'Test laptop', ttl_seconds: 60 }),
		)
		expect(res.status).toBe(201)
		const body = (await res.json()) as { token_id: string; secret: string; expires_at: string }
		expect(body.token_id).toBeTruthy()
		expect(body.secret).toBeTruthy()
		expect(body.secret.length).toBeGreaterThanOrEqual(32)
		expect(body.expires_at).toBeTruthy()
	})

	test('enroll with valid token returns worker_id + machine_secret', async () => {
		// Create token
		const tokenRes = await app.request(
			'/api/enrollment/tokens',
			post({ ttl_seconds: 60 }),
		)
		const { secret } = (await tokenRes.json()) as { secret: string }

		// Enroll
		const enrollRes = await app.request(
			'/api/enrollment/enroll',
			post({ token: secret, name: 'test-worker', device_id: 'dev-1' }),
		)
		expect(enrollRes.status).toBe(201)
		const body = (await enrollRes.json()) as { worker_id: string; machine_secret: string }
		expect(body.worker_id).toBeTruthy()
		expect(body.machine_secret).toBeTruthy()
		expect(body.machine_secret.length).toBeGreaterThanOrEqual(32)
	})

	test('reused token is rejected', async () => {
		const tokenRes = await app.request(
			'/api/enrollment/tokens',
			post({ ttl_seconds: 60 }),
		)
		const { secret } = (await tokenRes.json()) as { secret: string }

		// First use — success
		const first = await app.request(
			'/api/enrollment/enroll',
			post({ token: secret, name: 'w1', device_id: 'd1' }),
		)
		expect(first.status).toBe(201)

		// Second use — rejected
		const second = await app.request(
			'/api/enrollment/enroll',
			post({ token: secret, name: 'w2', device_id: 'd2' }),
		)
		expect(second.status).toBe(401)
		const body = (await second.json()) as { error: string }
		expect(body.error).toContain('already used')
	})

	test('expired token is rejected', async () => {
		// Create token directly via service with already-expired time
		const { enrollmentService } = services
		const { secret } = await enrollmentService.createToken({
			created_by: 'admin',
			description: 'expired-test',
			ttl_seconds: -1, // service doesn't validate, creates already-expired token
		})

		const res = await app.request(
			'/api/enrollment/enroll',
			post({ token: secret, name: 'w3', device_id: 'd3' }),
		)
		expect(res.status).toBe(401)
		const body = (await res.json()) as { error: string }
		expect(body.error).toContain('expired')
	})

	test('invalid token is rejected', async () => {
		const res = await app.request(
			'/api/enrollment/enroll',
			post({ token: 'totally-bogus-token', name: 'w4', device_id: 'd4' }),
		)
		expect(res.status).toBe(401)
		const body = (await res.json()) as { error: string }
		expect(body.error).toContain('Invalid')
	})

	test('enrolled worker can access worker routes with machine secret', async () => {
		// Create + enroll
		const tokenRes = await app.request(
			'/api/enrollment/tokens',
			post({ ttl_seconds: 60 }),
		)
		const { secret: tokenSecret } = (await tokenRes.json()) as { secret: string }

		const enrollRes = await app.request(
			'/api/enrollment/enroll',
			post({ token: tokenSecret, name: 'auth-test-worker', device_id: 'dev-auth' }),
		)
		const { worker_id, machine_secret } = (await enrollRes.json()) as {
			worker_id: string
			machine_secret: string
		}

		// Use machine secret to call worker route
		const regRes = await app.request(
			'/api/workers/register',
			post(
				{ id: worker_id, name: 'auth-test-worker' },
				{ 'X-Worker-Secret': machine_secret },
			),
		)
		expect(regRes.status).toBe(201)
	})

	test('worker routes reject requests without credential', async () => {
		const res = await app.request(
			'/api/workers/register',
			post({ id: 'no-auth-worker', name: 'no-auth' }),
		)
		expect(res.status).toBe(401)
		const body = (await res.json()) as { error: string }
		expect(body.error).toContain('authentication required')
	})

	test('worker routes reject invalid machine secret', async () => {
		const res = await app.request(
			'/api/workers/register',
			post(
				{ id: 'bad-auth-worker', name: 'bad-auth' },
				{ 'X-Worker-Secret': 'totally-wrong-secret' },
			),
		)
		expect(res.status).toBe(401)
		const body = (await res.json()) as { error: string }
		expect(body.error).toContain('Invalid worker credential')
	})

	test('local dev bypass works with X-Local-Dev header (when enabled)', async () => {
		const res = await app.request(
			'/api/workers/register',
			post(
				{ id: 'local-dev-worker', name: 'local' },
				{ 'X-Local-Dev': 'true' },
			),
		)
		expect(res.status).toBe(201)
	})

	test('authenticated worker cannot spoof another worker_id in register', async () => {
		// Enroll a worker
		const tokenRes = await app.request('/api/enrollment/tokens', post({ ttl_seconds: 60 }))
		const { secret } = (await tokenRes.json()) as { secret: string }
		const enrollRes = await app.request(
			'/api/enrollment/enroll',
			post({ token: secret, name: 'honest-worker', device_id: 'dev-honest' }),
		)
		const { worker_id, machine_secret } = (await enrollRes.json()) as {
			worker_id: string
			machine_secret: string
		}

		// Try to register with a different worker_id in the body
		const res = await app.request(
			'/api/workers/register',
			post(
				{ id: 'impersonated-worker', name: 'evil' },
				{ 'X-Worker-Secret': machine_secret },
			),
		)
		expect(res.status).toBe(403)
		const body = (await res.json()) as { error: string }
		expect(body.error).toContain('Authenticated as')
		expect(body.error).toContain('impersonated-worker')
	})

	test('authenticated worker cannot spoof heartbeat for another worker', async () => {
		const tokenRes = await app.request('/api/enrollment/tokens', post({ ttl_seconds: 60 }))
		const { secret } = (await tokenRes.json()) as { secret: string }
		const enrollRes = await app.request(
			'/api/enrollment/enroll',
			post({ token: secret, name: 'spoof-hb', device_id: 'dev-spoof-hb' }),
		)
		const { worker_id, machine_secret } = (await enrollRes.json()) as {
			worker_id: string
			machine_secret: string
		}

		const res = await app.request(
			'/api/workers/heartbeat',
			post(
				{ worker_id: 'some-other-worker' },
				{ 'X-Worker-Secret': machine_secret },
			),
		)
		expect(res.status).toBe(403)
	})

	test('authenticated worker cannot claim as another worker', async () => {
		const tokenRes = await app.request('/api/enrollment/tokens', post({ ttl_seconds: 60 }))
		const { secret } = (await tokenRes.json()) as { secret: string }
		const enrollRes = await app.request(
			'/api/enrollment/enroll',
			post({ token: secret, name: 'spoof-claim', device_id: 'dev-spoof-claim' }),
		)
		const { worker_id, machine_secret } = (await enrollRes.json()) as {
			worker_id: string
			machine_secret: string
		}

		const res = await app.request(
			'/api/workers/claim',
			post(
				{ worker_id: 'different-worker' },
				{ 'X-Worker-Secret': machine_secret },
			),
		)
		expect(res.status).toBe(403)
	})

	test('token creation requires owner or admin role', async () => {
		// Build a test app with a non-admin actor
		const viewerApp = new Hono<AppEnv>()
		viewerApp.use('*', async (c, next) => {
			c.set('companyRoot', companyRoot)
			c.set('db', dbResult.db)
			c.set('auth', auth)
			c.set('services', services)
			c.set('authoredConfig', { company: {} as any, agents: new Map(), workflows: new Map(), environments: new Map() })
			c.set('actor', { ...FAKE_ACTOR, role: 'viewer' as const })
			c.set('workerId', null)
			await next()
		})
		viewerApp.route('/api/enrollment', enrollment)

		const res = await viewerApp.request(
			'/api/enrollment/tokens',
			post({ ttl_seconds: 60 }),
		)
		expect(res.status).toBe(403)
		const body = (await res.json()) as { error: string }
		expect(body.error).toContain('owner or admin')
	})
})

describe('Local dev bypass scope', () => {
	// Build an app WITHOUT allowLocalDevBypass — simulates `autopilot server start`
	const companyRoot2 = join(tmpdir(), `qp-nodev-${Date.now()}`)
	let dbResult2: CompanyDbResult
	let auth2: Auth
	let noDevApp: ReturnType<typeof buildTestApp>

	beforeAll(async () => {
		await mkdir(companyRoot2, { recursive: true })
		await writeFile(
			join(companyRoot2, 'company.yaml'),
			'name: nodev-test\nowner:\n  name: Test\n  email: t@t.com\n',
		)
		dbResult2 = await createCompanyDb(companyRoot2)

		for (const sql of [
			`CREATE TABLE IF NOT EXISTS join_tokens (
				id TEXT PRIMARY KEY, secret_hash TEXT NOT NULL, description TEXT,
				created_by TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL,
				used_at TEXT, used_by_worker_id TEXT
			)`,
			`CREATE TABLE IF NOT EXISTS workers (
				id TEXT PRIMARY KEY, device_id TEXT, name TEXT,
				status TEXT NOT NULL DEFAULT 'offline', capabilities TEXT DEFAULT '[]',
				registered_at TEXT NOT NULL, last_heartbeat TEXT,
				machine_secret_hash TEXT
			)`,
			`CREATE TABLE IF NOT EXISTS worker_leases (
				id TEXT PRIMARY KEY, worker_id TEXT NOT NULL, run_id TEXT NOT NULL,
				claimed_at TEXT NOT NULL, expires_at TEXT NOT NULL,
				status TEXT NOT NULL DEFAULT 'active'
			)`,
		]) {
			await dbResult2.raw.execute(sql)
		}

		auth2 = await createAuth(dbResult2.db, companyRoot2)
		const taskService2 = new TaskService(dbResult2.db)
		const runService2 = new RunService(dbResult2.db)
		const workflowEngine2 = new WorkflowEngine(
			{
				company: { name: 'test', slug: 'test', description: '', timezone: 'UTC', language: 'en', owner: { name: 'Test', email: 'test@test.com' }, settings: { auto_assign: true, require_approval: [], max_concurrent_agents: 1, budget: { daily_token_limit: 0, alert_at: 0 }, auth: {}, inference: { gateway_base_url: '', text_model: '', embedding_model: '', embedding_dimensions: 768 }, default_runtime: 'claude-code' }, setup_completed: false },
				agents: new Map(),
				workflows: new Map(),
			},
			taskService2,
			runService2,
		)
		const svc: Services = {
			taskService: taskService2,
			runService: runService2,
			workerService: new WorkerService(dbResult2.db),
			enrollmentService: new EnrollmentService(dbResult2.db),
			activityService: new ActivityService(dbResult2.db),
			workflowEngine: workflowEngine2,
		}

		// Build app with worker auth but NO local dev bypass
		const strictApp = new Hono<AppEnv>()
		strictApp.use('*', async (c, next) => {
			c.set('companyRoot', companyRoot2)
			c.set('db', dbResult2.db)
			c.set('auth', auth2)
			c.set('services', svc)
			c.set('authoredConfig', { company: {} as any, agents: new Map(), workflows: new Map(), environments: new Map() })
			c.set('actor', FAKE_ACTOR)
			c.set('workerId', null)
			await next()
		})
		const strictAuth = workerAuthMiddleware({ allowLocalDevBypass: false })
		strictApp.use('/api/workers/*', strictAuth)
		strictApp.use('/api/workers', strictAuth)
		strictApp.route('/api/workers', workers)

		noDevApp = strictApp as unknown as ReturnType<typeof buildTestApp>
	})

	afterAll(async () => {
		dbResult2.raw.close()
		await rm(companyRoot2, { recursive: true, force: true })
	})

	test('X-Local-Dev header is rejected when bypass is not enabled', async () => {
		const res = await noDevApp.request(
			'/api/workers/register',
			post(
				{ id: 'sneaky-worker', name: 'sneaky' },
				{ 'X-Local-Dev': 'true' },
			),
		)
		expect(res.status).toBe(401)
		const body = (await res.json()) as { error: string }
		expect(body.error).toContain('authentication required')
	})
})
