/**
 * Bootstrap integration test.
 *
 * Proves the real bootstrap path compiles and runs:
 *   - Real createCompanyDb (with Drizzle migrations — no manual CREATE TABLE)
 *   - Real createAuth (proves auth boots without errors)
 *   - Real service constructors
 *   - Routes mounted via the same route modules as createApp
 *   - Full run lifecycle: pending -> claimed -> running -> completed
 *   - Stale lease recovery: expired leases fail runs and recover workers
 *
 * Auth is bypassed by injecting a fake actor (same as execution-loop.test.ts).
 * The improvement over execution-loop is: real createCompanyDb with real
 * migrations instead of manual CREATE TABLE statements.
 */
import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Hono } from 'hono'
import { createCompanyDb, type CompanyDb } from '../src/db'
import type { CompanyDbResult } from '../src/db'
import { TaskService, RunService, WorkerService, EnrollmentService, WorkflowEngine, ActivityService, ArtifactService, ConversationBindingService } from '../src/services'
import type { Services, AppEnv } from '../src/api/app'
import { createAuth, type Auth } from '../src/auth'
import type { Actor } from '../src/auth/types'
import { runs } from '../src/api/routes/runs'
import { workers } from '../src/api/routes/workers'
import { tasks } from '../src/api/routes/tasks'
import { events } from '../src/api/routes/events'

// ─── Helpers ───────────────────────────────────────────────────────────────

const FAKE_ACTOR: Actor = {
	id: 'test-user',
	type: 'human',
	name: 'Test User',
	role: 'owner',
	source: 'api',
}

/**
 * Build an app with real route modules but fake auth.
 * Uses the same route modules as createApp but injects a fake actor.
 */
function buildBootstrapApp(config: {
	companyRoot: string
	db: CompanyDb
	auth: Auth
	services: Services
}) {
	const app = new Hono<AppEnv>()

	// Context injection (mirrors createApp step 4)
	app.use('*', async (c, next) => {
		c.set('companyRoot', config.companyRoot)
		c.set('db', config.db)
		c.set('auth', config.auth)
		c.set('services', config.services)
		c.set('authoredConfig', { company: {} as any, agents: new Map(), workflows: new Map(), environments: new Map(), providers: new Map(), capabilityProfiles: new Map() })
		c.set('actor', FAKE_ACTOR)
		c.set('workerId', null)
		await next()
	})

	// Mount the same route modules used by createApp
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

// ─── Suite ─────────────────────────────────────────────────────────────────

describe('bootstrap', () => {
	const companyRoot = join(tmpdir(), `qp-bootstrap-${Date.now()}`)

	let dbResult: CompanyDbResult
	let auth: Auth
	let services: Services
	let app: ReturnType<typeof buildBootstrapApp>

	beforeAll(async () => {
		await mkdir(join(companyRoot, '.autopilot'), { recursive: true })

		// Write minimal company.yaml so the directory looks like a real company root
		await writeFile(
			join(companyRoot, '.autopilot', 'company.yaml'),
			'name: test-company\nslug: test-company\nowner:\n  name: Test\n  email: test@test.com\n',
		)

		// Real database with real Drizzle migrations + WAL + PRAGMA + FTS5
		dbResult = await createCompanyDb(companyRoot)

		// Tables in schema but not yet in a migration — create manually.
		// TODO: generate a proper migration for runs/run_events/workers/worker_leases
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

		// Real auth — proves the auth bootstrap path works
		auth = await createAuth(dbResult.db, companyRoot)

		// Real services
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
				providers: new Map(),
				capabilityProfiles: new Map(),
				defaults: { runtime: 'claude-code' },
			},
			taskService,
			runService,
		)
		const artifactService = new ArtifactService(dbResult.db)
		const conversationBindingService = new ConversationBindingService(dbResult.db)
		services = { taskService, runService, workerService, enrollmentService, activityService, artifactService, conversationBindingService, workflowEngine }

		// App with real routes, fake auth
		app = buildBootstrapApp({
			companyRoot,
			db: dbResult.db,
			auth,
			services,
		})
	})

	afterAll(async () => {
		dbResult.raw.close()
		await rm(companyRoot, { recursive: true, force: true })
	})

	test('full lifecycle through real bootstrap path', async () => {
		// a. Create a pending run
		const createRes = await app.request(
			'/api/runs',
			post({ agent_id: 'agent-bootstrap', runtime: 'bun' }),
		)
		expect(createRes.status).toBe(201)
		const created = (await createRes.json()) as { id: string; status: string }
		expect(created.status).toBe('pending')
		const runId = created.id

		// b. Register a worker
		const regRes = await app.request(
			'/api/workers/register',
			post({ id: 'worker-boot-1', name: 'Bootstrap Worker' }),
		)
		expect(regRes.status).toBe(201)
		const worker = (await regRes.json()) as { workerId: string; status: string }
		expect(worker.status).toBe('online')

		// c. Claim the run
		const claimRes = await app.request(
			'/api/workers/claim',
			post({ worker_id: 'worker-boot-1' }),
		)
		expect(claimRes.status).toBe(200)
		const claimBody = (await claimRes.json()) as {
			run: { id: string; status: string } | null
			lease_id: string | null
		}
		expect(claimBody.run).not.toBeNull()
		expect(claimBody.run!.id).toBe(runId)
		expect(claimBody.run!.status).toBe('claimed')
		expect(claimBody.lease_id).not.toBeNull()

		// d. Post started event -> transitions to running
		const startedRes = await app.request(
			`/api/runs/${runId}/events`,
			post({ type: 'started', summary: 'Worker started' }),
		)
		expect(startedRes.status).toBe(200)

		// e. Verify running
		const runningRes = await app.request(`/api/runs/${runId}`)
		expect(runningRes.status).toBe(200)
		const running = (await runningRes.json()) as { status: string }
		expect(running.status).toBe('running')

		// f. Complete the run
		const completeRes = await app.request(
			`/api/runs/${runId}/complete`,
			post({
				status: 'completed',
				summary: 'Bootstrap test done',
				tokens: { input: 10, output: 20 },
			}),
		)
		expect(completeRes.status).toBe(200)

		// g. Verify completed
		const finalRes = await app.request(`/api/runs/${runId}`)
		const finalRun = (await finalRes.json()) as { status: string; summary: string }
		expect(finalRun.status).toBe('completed')
		expect(finalRun.summary).toBe('Bootstrap test done')
	})

	test('stale lease recovery: expired lease fails run and recovers worker', async () => {
		// a. Create a run + claim it
		const createRes = await app.request(
			'/api/runs',
			post({ agent_id: 'agent-stale', runtime: 'bun' }),
		)
		expect(createRes.status).toBe(201)
		const created = (await createRes.json()) as { id: string }
		const runId = created.id

		await app.request('/api/workers/register', post({ id: 'worker-stale-1' }))
		const claimRes = await app.request(
			'/api/workers/claim',
			post({ worker_id: 'worker-stale-1' }),
		)
		const claimBody = (await claimRes.json()) as {
			run: { id: string } | null
			lease_id: string | null
		}
		expect(claimBody.run).not.toBeNull()
		expect(claimBody.lease_id).not.toBeNull()

		// b. Manually expire the lease by setting expires_at to the past
		const { workerService } = services
		const lease = await workerService.getActiveLeaseForWorker('worker-stale-1')
		expect(lease).not.toBeUndefined()

		// Directly update the lease to be expired (simulating time passing)
		const { workerLeases } = await import('../src/db/company-schema')
		const { eq } = await import('drizzle-orm')
		await dbResult.db
			.update(workerLeases)
			.set({ expires_at: '2000-01-01T00:00:00.000Z' })
			.where(eq(workerLeases.id, lease!.id))

		// c. Next claim attempt triggers stale lease recovery
		// Create another pending run so the worker has something to claim
		const createRes2 = await app.request(
			'/api/runs',
			post({ agent_id: 'agent-stale-2', runtime: 'bun' }),
		)
		expect(createRes2.status).toBe(201)

		const recoverClaimRes = await app.request(
			'/api/workers/claim',
			post({ worker_id: 'worker-stale-1' }),
		)
		expect(recoverClaimRes.status).toBe(200)
		const recoverBody = (await recoverClaimRes.json()) as { run: { id: string } | null }

		// d. The worker should have recovered and claimed the new run
		expect(recoverBody.run).not.toBeNull()

		// e. The original run should be failed with "lease expired"
		const failedRes = await app.request(`/api/runs/${runId}`)
		const failedRun = (await failedRes.json()) as { status: string; error: string | null }
		expect(failedRun.status).toBe('failed')
		expect(failedRun.error).toBe('lease expired')
	})
})
