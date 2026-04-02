/**
 * Continuation flow tests.
 *
 * Exercises: run complete with session ref → continue → preferred worker claim → lineage.
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
	id: 'test-user',
	type: 'human',
	name: 'Test',
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

describe('Continuation flow', () => {
	const companyRoot = join(tmpdir(), `qp-cont-${Date.now()}`)
	let dbResult: CompanyDbResult
	let auth: Auth
	let services: Services
	let app: ReturnType<typeof buildTestApp>

	beforeAll(async () => {
		await mkdir(companyRoot, { recursive: true })
		await writeFile(
			join(companyRoot, 'company.yaml'),
			'name: cont-test\nowner:\n  name: Test\n  email: t@t.com\n',
		)

		dbResult = await createCompanyDb(companyRoot)

		// Create tables with new session columns
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
		await dbResult.raw.execute(`DROP TABLE IF EXISTS runs`)
		await dbResult.raw.execute(`
			CREATE TABLE runs (
				id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, task_id TEXT, worker_id TEXT,
				runtime TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
				initiated_by TEXT, instructions TEXT, summary TEXT,
				tokens_input INTEGER DEFAULT 0, tokens_output INTEGER DEFAULT 0,
				error TEXT, started_at TEXT, ended_at TEXT, created_at TEXT NOT NULL,
				runtime_session_ref TEXT, resumed_from_run_id TEXT,
				preferred_worker_id TEXT, resumable INTEGER DEFAULT 0,
				targeting TEXT
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

	test('full continuation lifecycle: create -> complete with session -> continue -> preferred claim', async () => {
		// 1. Create initial run
		const createRes = await app.request(
			'/api/runs',
			post({ agent_id: 'developer', runtime: 'claude-code' }),
		)
		expect(createRes.status).toBe(201)
		const run = (await createRes.json()) as { id: string; status: string }

		// 2. Register two workers
		await app.request(
			'/api/workers/register',
			post({ id: 'worker-A', name: 'Worker A' }),
		)
		await app.request(
			'/api/workers/register',
			post({ id: 'worker-B', name: 'Worker B' }),
		)

		// 3. Worker A claims the run
		const claimRes = await app.request(
			'/api/workers/claim',
			post({ worker_id: 'worker-A' }),
		)
		expect(claimRes.status).toBe(200)
		const claim = (await claimRes.json()) as { run: { id: string } | null }
		expect(claim.run).not.toBeNull()
		expect(claim.run!.id).toBe(run.id)

		// 4. Complete with session ref and resumable=true
		const completeRes = await app.request(
			`/api/runs/${run.id}/complete`,
			post({
				status: 'completed',
				summary: 'Initial work done',
				tokens: { input: 100, output: 50 },
				runtime_session_ref: 'claude-sess-xyz',
				resumable: true,
			}),
		)
		expect(completeRes.status).toBe(200)
		const completed = (await completeRes.json()) as {
			id: string
			status: string
			runtime_session_ref: string | null
			resumable: boolean | null
		}
		expect(completed.runtime_session_ref).toBe('claude-sess-xyz')
		expect(completed.resumable).toBe(true)

		// 5. Continue the run
		const contRes = await app.request(
			`/api/runs/${run.id}/continue`,
			post({ message: 'Now add tests for the feature' }),
		)
		expect(contRes.status).toBe(201)
		const continuation = (await contRes.json()) as {
			id: string
			status: string
			resumed_from_run_id: string | null
			runtime_session_ref: string | null
			preferred_worker_id: string | null
			instructions: string | null
		}
		expect(continuation.resumed_from_run_id).toBe(run.id)
		expect(continuation.runtime_session_ref).toBe('claude-sess-xyz')
		expect(continuation.preferred_worker_id).toBe('worker-A')
		expect(continuation.instructions).toBe('Now add tests for the feature')
		expect(continuation.status).toBe('pending')

		// 6. Worker B tries to claim — should NOT get the continuation (preferred_worker_id = worker-A)
		const claimB = await app.request(
			'/api/workers/claim',
			post({ worker_id: 'worker-B' }),
		)
		const claimBResult = (await claimB.json()) as { run: null | { id: string } }
		expect(claimBResult.run).toBeNull()

		// 7. Worker A claims — should get the continuation
		const claimA = await app.request(
			'/api/workers/claim',
			post({ worker_id: 'worker-A' }),
		)
		const claimAResult = (await claimA.json()) as {
			run: {
				id: string
				runtime_session_ref: string | null
				resumed_from_run_id: string | null
			} | null
		}
		expect(claimAResult.run).not.toBeNull()
		expect(claimAResult.run!.id).toBe(continuation.id)
		expect(claimAResult.run!.runtime_session_ref).toBe('claude-sess-xyz')
		expect(claimAResult.run!.resumed_from_run_id).toBe(run.id)
	})

	test('cannot continue a non-resumable run', async () => {
		// Create and complete without resumable flag
		const createRes = await app.request(
			'/api/runs',
			post({ agent_id: 'developer', runtime: 'claude-code' }),
		)
		const run = (await createRes.json()) as { id: string }

		// Claim + complete without session ref
		await app.request('/api/workers/claim', post({ worker_id: 'worker-A' }))
		await app.request(
			`/api/runs/${run.id}/complete`,
			post({ status: 'completed', summary: 'Done' }),
		)

		const contRes = await app.request(
			`/api/runs/${run.id}/continue`,
			post({ message: 'try to continue' }),
		)
		expect(contRes.status).toBe(400)
		const body = (await contRes.json()) as { error: string }
		expect(body.error).toContain('not resumable')
	})

	test('cannot continue a still-running run', async () => {
		const createRes = await app.request(
			'/api/runs',
			post({ agent_id: 'developer', runtime: 'claude-code' }),
		)
		const run = (await createRes.json()) as { id: string }

		// Claim but don't complete
		await app.request('/api/workers/claim', post({ worker_id: 'worker-A' }))
		await app.request(
			`/api/runs/${run.id}/events`,
			post({ type: 'started', summary: 'running' }),
		)

		const contRes = await app.request(
			`/api/runs/${run.id}/continue`,
			post({ message: 'impatient' }),
		)
		expect(contRes.status).toBe(400)
		const body = (await contRes.json()) as { error: string }
		expect(body.error).toContain('only continue completed or failed')
	})

	test('continuation fails when original worker is offline', async () => {
		// Create, claim by worker-A, complete with resumable
		const createRes = await app.request(
			'/api/runs',
			post({ agent_id: 'developer', runtime: 'claude-code' }),
		)
		const run = (await createRes.json()) as { id: string }

		// Complete directly (simulate)
		await services.runService.complete(run.id, {
			status: 'completed',
			summary: 'done',
			runtime_session_ref: 'sess-offline-test',
			resumable: true,
		})
		// Set worker_id directly since we skipped claim
		await dbResult.raw.execute(
			`UPDATE runs SET worker_id = 'worker-offline' WHERE id = '${run.id}'`,
		)

		// Register then deregister (offline)
		await app.request(
			'/api/workers/register',
			post({ id: 'worker-offline', name: 'Offline Worker' }),
		)
		await app.request(
			'/api/workers/deregister',
			post({ worker_id: 'worker-offline' }),
		)

		const contRes = await app.request(
			`/api/runs/${run.id}/continue`,
			post({ message: 'resume plz' }),
		)
		expect(contRes.status).toBe(409)
		const body = (await contRes.json()) as { error: string }
		expect(body.error).toContain('offline')
	})

	test('run show includes session/lineage fields', async () => {
		// Create a run with continuation metadata
		const createRes = await app.request(
			'/api/runs',
			post({
				agent_id: 'developer',
				runtime: 'claude-code',
				resumed_from_run_id: 'run-parent-999',
				runtime_session_ref: 'sess-show-test',
				preferred_worker_id: 'worker-show',
			}),
		)
		expect(createRes.status).toBe(201)
		const run = (await createRes.json()) as {
			id: string
			resumed_from_run_id: string | null
			runtime_session_ref: string | null
			preferred_worker_id: string | null
		}

		// GET the run
		const getRes = await app.request(`/api/runs/${run.id}`)
		expect(getRes.status).toBe(200)
		const detail = (await getRes.json()) as {
			resumed_from_run_id: string | null
			runtime_session_ref: string | null
			preferred_worker_id: string | null
		}
		expect(detail.resumed_from_run_id).toBe('run-parent-999')
		expect(detail.runtime_session_ref).toBe('sess-show-test')
		expect(detail.preferred_worker_id).toBe('worker-show')
	})
})
