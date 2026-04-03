/**
 * CLI smoke test.
 *
 * Boots a real orchestrator (same pattern as bootstrap.test.ts),
 * then exercises the Hono client path that the CLI commands use.
 * Validates: task create -> run create -> worker claims -> events -> completion.
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
import { events } from '../../orchestrator/src/api/routes/events'
import { createCompanyDb, type CompanyDb, type CompanyDbResult } from '../../orchestrator/src/db'
import { createAuth, type Auth } from '../../orchestrator/src/auth'
import type { Actor } from '../../orchestrator/src/auth/types'
import { TaskService, RunService, WorkerService, EnrollmentService, WorkflowEngine, ActivityService } from '../../orchestrator/src/services'

const FAKE_ACTOR: Actor = {
	id: 'test-cli-user',
	type: 'human',
	name: 'CLI Test',
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
		c.set('authoredConfig', { company: {} as any, agents: new Map(), workflows: new Map(), environments: new Map(), providers: new Map() })
		c.set('actor', FAKE_ACTOR)
		c.set('workerId', null)
		await next()
	})

	app.route('/api/tasks', tasks)
	app.route('/api/runs', runs)
	app.route('/api/workers', workers)
	app.route('/api/events', events)

	return app
}

function post(body: unknown): RequestInit {
	return {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	}
}

describe('CLI smoke: full lifecycle via API', () => {
	const companyRoot = join(tmpdir(), `qp-cli-smoke-${Date.now()}`)
	let dbResult: CompanyDbResult
	let auth: Auth
	let services: Services
	let app: ReturnType<typeof buildTestApp>

	beforeAll(async () => {
		await mkdir(join(companyRoot, '.autopilot'), { recursive: true })
		await writeFile(
			join(companyRoot, '.autopilot', 'company.yaml'),
			'name: cli-smoke-test\nowner:\n  name: Test\n  email: test@test.com\n',
		)

		dbResult = await createCompanyDb(companyRoot)

		// Drop and recreate tables whose migrations lag behind the schema
		await dbResult.raw.execute(`DROP TABLE IF EXISTS tasks`)
		await dbResult.raw.execute(`
			CREATE TABLE tasks (
				id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT DEFAULT '',
				type TEXT NOT NULL, status TEXT NOT NULL, priority TEXT DEFAULT 'medium',
				assigned_to TEXT, workflow_id TEXT, workflow_step TEXT,
				context TEXT DEFAULT '{}', metadata TEXT DEFAULT '{}',
				created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
			)
		`)
		await dbResult.raw.execute(`
			CREATE TABLE IF NOT EXISTS runs (
				id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, task_id TEXT, worker_id TEXT,
				runtime TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
				initiated_by TEXT, instructions TEXT, summary TEXT,
				tokens_input INTEGER DEFAULT 0, tokens_output INTEGER DEFAULT 0,
				error TEXT, started_at TEXT, ended_at TEXT, created_at TEXT NOT NULL,
				runtime_session_ref TEXT, resumed_from_run_id TEXT,
				preferred_worker_id TEXT, resumable INTEGER DEFAULT 0
			)
		`)
		await dbResult.raw.execute(`
			CREATE TABLE IF NOT EXISTS run_events (
				id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL,
				type TEXT NOT NULL, summary TEXT, metadata TEXT DEFAULT '{}',
				created_at TEXT NOT NULL
			)
		`)
		await dbResult.raw.execute(`
			CREATE TABLE IF NOT EXISTS join_tokens (
				id TEXT PRIMARY KEY, secret_hash TEXT NOT NULL, description TEXT,
				created_by TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL,
				used_at TEXT, used_by_worker_id TEXT
			)
		`)
		await dbResult.raw.execute(`
			CREATE TABLE IF NOT EXISTS workers (
				id TEXT PRIMARY KEY, device_id TEXT, name TEXT,
				status TEXT NOT NULL DEFAULT 'offline', capabilities TEXT DEFAULT '[]',
				registered_at TEXT NOT NULL, last_heartbeat TEXT,
				machine_secret_hash TEXT
			)
		`)
		await dbResult.raw.execute(`
			CREATE TABLE IF NOT EXISTS worker_leases (
				id TEXT PRIMARY KEY, worker_id TEXT NOT NULL, run_id TEXT NOT NULL,
				claimed_at TEXT NOT NULL, expires_at TEXT NOT NULL,
				status TEXT NOT NULL DEFAULT 'active'
			)
		`)

		auth = await createAuth(dbResult.db, companyRoot)

		const taskService = new TaskService(dbResult.db)
		const runService = new RunService(dbResult.db)
		const workerService = new WorkerService(dbResult.db)
		const enrollmentService = new EnrollmentService(dbResult.db)
		const activityService = new ActivityService(dbResult.db)
		const workflowEngine = new WorkflowEngine(
			{
				company: { name: 'test', slug: 'test', description: '', timezone: 'UTC', language: 'en', owner: { name: 'Test', email: 'test@test.com' }, defaults: {} },
				agents: new Map(),
				workflows: new Map(),
				environments: new Map(),
				defaults: { runtime: 'claude-code' },
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

	test('task CRUD via direct API requests', async () => {
		// Create
		const createRes = await app.request(
			'/api/tasks',
			post({ title: 'CLI smoke task', type: 'chore' }),
		)
		expect(createRes.status).toBe(201)
		const created = (await createRes.json()) as { id: string; title: string; status: string }
		expect(created.title).toBe('CLI smoke task')

		// Get
		const getRes = await app.request(`/api/tasks/${created.id}`)
		expect(getRes.status).toBe(200)
		const fetched = (await getRes.json()) as { id: string; title: string }
		expect(fetched.id).toBe(created.id)

		// List
		const listRes = await app.request('/api/tasks')
		expect(listRes.status).toBe(200)
		const list = (await listRes.json()) as Array<{ id: string }>
		expect(list.length).toBeGreaterThanOrEqual(1)

		// Update
		const patchRes = await app.request(`/api/tasks/${created.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ status: 'active' }),
		})
		expect(patchRes.status).toBe(200)
		const updated = (await patchRes.json()) as { status: string }
		expect(updated.status).toBe('active')
	})

	test('run lifecycle: create -> claim -> events -> complete', async () => {
		// Create run
		const createRes = await app.request(
			'/api/runs',
			post({ agent_id: 'agent-smoke', runtime: 'claude-code' }),
		)
		expect(createRes.status).toBe(201)
		const run = (await createRes.json()) as { id: string; status: string }
		expect(run.status).toBe('pending')

		// Register worker
		const regRes = await app.request(
			'/api/workers/register',
			post({ id: 'worker-smoke-1', name: 'Smoke Worker' }),
		)
		expect(regRes.status).toBe(201)

		// Claim
		const claimRes = await app.request(
			'/api/workers/claim',
			post({ worker_id: 'worker-smoke-1' }),
		)
		expect(claimRes.status).toBe(200)
		const claim = (await claimRes.json()) as { run: { id: string } | null }
		expect(claim.run).not.toBeNull()
		expect(claim.run!.id).toBe(run.id)

		// Post event
		const evtRes = await app.request(
			`/api/runs/${run.id}/events`,
			post({ type: 'started', summary: 'Worker started' }),
		)
		expect(evtRes.status).toBe(200)

		// Verify running
		const runningRes = await app.request(`/api/runs/${run.id}`)
		expect(runningRes.status).toBe(200)
		const running = (await runningRes.json()) as { status: string }
		expect(running.status).toBe('running')

		// Complete
		const completeRes = await app.request(
			`/api/runs/${run.id}/complete`,
			post({ status: 'completed', summary: 'Smoke done', tokens: { input: 5, output: 10 } }),
		)
		expect(completeRes.status).toBe(200)

		// Verify completed
		const finalRes = await app.request(`/api/runs/${run.id}`)
		const final = (await finalRes.json()) as { status: string; summary: string }
		expect(final.status).toBe('completed')
		expect(final.summary).toBe('Smoke done')

		// Fetch events
		const eventsRes = await app.request(`/api/runs/${run.id}/events`)
		expect(eventsRes.status).toBe(200)
		const evts = (await eventsRes.json()) as Array<{ type: string }>
		expect(evts.length).toBeGreaterThanOrEqual(1)
	})

	test('list runs with status filter', async () => {
		const res = await app.request('/api/runs?status=completed')
		expect(res.status).toBe(200)
		const runs = (await res.json()) as Array<{ status: string }>
		for (const r of runs) {
			expect(r.status).toBe('completed')
		}
	})
})
