/**
 * Integration test: minimal execution loop.
 *
 * Exercises the full run lifecycle through the HTTP API layer:
 *   pending -> claimed -> running -> completed
 *
 * Auth is bypassed by constructing a test-only Hono app that injects a
 * fake actor instead of running the real auth middleware.
 */
import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Hono } from 'hono'
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { companySchema, type CompanyDb } from '../src/db'
import { TaskService, RunService, WorkerService } from '../src/services'
import type { AppEnv, Services } from '../src/api/app'
import type { Actor } from '../src/auth/types'
import { runs } from '../src/api/routes/runs'
import { workers } from '../src/api/routes/workers'

// ─── Helpers ───────────────────────────────────────────────────────────────

const FAKE_ACTOR: Actor = {
	id: 'test-user',
	type: 'human',
	name: 'Test User',
	role: 'owner',
	source: 'api',
}

/** Build a minimal Hono app with the run + worker routes, no real auth. */
function buildTestApp(companyRoot: string, db: CompanyDb, services: Services) {
	const app = new Hono<AppEnv>()

	// Inject context -- mirrors createApp's step 4, but with a fake auth + actor
	app.use('*', async (c, next) => {
		c.set('companyRoot', companyRoot)
		c.set('db', db)
		c.set('auth', {} as never) // unused in these routes
		c.set('services', services)
		c.set('actor', FAKE_ACTOR)
		await next()
	})

	app.route('/api/runs', runs)
	app.route('/api/workers', workers)

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

describe('execution loop', () => {
	const companyRoot = join(tmpdir(), `qp-test-${Date.now()}`)

	let rawClient: ReturnType<typeof createClient>
	let app: ReturnType<typeof buildTestApp>

	beforeAll(async () => {
		const dataDir = join(companyRoot, '.data')
		await mkdir(dataDir, { recursive: true })

		const dbPath = join(dataDir, 'company.db')
		rawClient = createClient({ url: `file:${dbPath}` })

		await rawClient.execute('PRAGMA journal_mode = WAL')
		await rawClient.execute('PRAGMA foreign_keys = ON')

		const db: CompanyDb = drizzle(rawClient, { schema: companySchema })
		const migrationsFolder = join(import.meta.dir, '..', 'drizzle')
		await migrate(db, { migrationsFolder })

		// Tables added to schema after the last migration -- create manually
		await rawClient.execute(`
			CREATE TABLE IF NOT EXISTS runs (
				id TEXT PRIMARY KEY,
				agent_id TEXT NOT NULL,
				task_id TEXT,
				worker_id TEXT,
				runtime TEXT NOT NULL,
				status TEXT NOT NULL DEFAULT 'pending',
				initiated_by TEXT,
				instructions TEXT,
				summary TEXT,
				tokens_input INTEGER DEFAULT 0,
				tokens_output INTEGER DEFAULT 0,
				error TEXT,
				started_at TEXT,
				ended_at TEXT,
				created_at TEXT NOT NULL
			)
		`)
		await rawClient.execute(`
			CREATE TABLE IF NOT EXISTS run_events (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				run_id TEXT NOT NULL,
				type TEXT NOT NULL,
				summary TEXT,
				metadata TEXT DEFAULT '{}',
				created_at TEXT NOT NULL
			)
		`)
		await rawClient.execute(`
			CREATE TABLE IF NOT EXISTS workers (
				id TEXT PRIMARY KEY,
				device_id TEXT,
				name TEXT,
				status TEXT NOT NULL DEFAULT 'offline',
				capabilities TEXT DEFAULT '[]',
				registered_at TEXT NOT NULL,
				last_heartbeat TEXT
			)
		`)
		await rawClient.execute(`
			CREATE TABLE IF NOT EXISTS worker_leases (
				id TEXT PRIMARY KEY,
				worker_id TEXT NOT NULL,
				run_id TEXT NOT NULL,
				claimed_at TEXT NOT NULL,
				expires_at TEXT NOT NULL,
				status TEXT NOT NULL DEFAULT 'active'
			)
		`)

		const services: Services = {
			taskService: new TaskService(db),
			runService: new RunService(db),
			workerService: new WorkerService(db),
		}

		app = buildTestApp(companyRoot, db, services)
	})

	afterAll(async () => {
		rawClient.close()
		await rm(companyRoot, { recursive: true, force: true })
	})

	test('full lifecycle: pending -> claimed -> running -> completed', async () => {
		// ── a. Create a pending run ────────────────────────────────────────
		const createRes = await app.request(
			'/api/runs',
			post({ agent_id: 'agent-1', runtime: 'bun' }),
		)
		expect(createRes.status).toBe(201)
		const created = (await createRes.json()) as { id: string; status: string }
		const runId = created.id

		// ── b. Verify status is pending ───────────────────────────────────
		expect(created.status).toBe('pending')

		// ── c. Register a worker ──────────────────────────────────────────
		const regRes = await app.request(
			'/api/workers/register',
			post({ id: 'worker-1', name: 'Test Worker' }),
		)
		expect(regRes.status).toBe(201)
		const worker = (await regRes.json()) as { workerId: string; status: string }
		expect(worker.status).toBe('online')

		// ── d. Claim the run ──────────────────────────────────────────────
		const claimRes = await app.request(
			'/api/workers/claim',
			post({ worker_id: 'worker-1' }),
		)
		expect(claimRes.status).toBe(200)
		const claimBody = (await claimRes.json()) as {
			run: { id: string; status: string; agent_id: string } | null
			lease_id: string | null
		}

		// ── e. Verify run status is claimed ───────────────────────────────
		expect(claimBody.run).not.toBeNull()
		expect(claimBody.run!.status).toBe('claimed')
		expect(claimBody.lease_id).not.toBeNull()

		// ── f. Claim response contains correct run details ────────────────
		expect(claimBody.run!.id).toBe(runId)

		// ── g. Post 'started' event -> transitions to running ─────────────
		const startedRes = await app.request(
			`/api/runs/${runId}/events`,
			post({ type: 'started', summary: 'Worker started execution' }),
		)
		expect(startedRes.status).toBe(200)

		// ── h. Verify run is now running ──────────────────────────────────
		const runningRes = await app.request(`/api/runs/${runId}`)
		expect(runningRes.status).toBe(200)
		const running = (await runningRes.json()) as { status: string }
		expect(running.status).toBe('running')

		// ── i. Post a progress event ──────────────────────────────────────
		const progressRes = await app.request(
			`/api/runs/${runId}/events`,
			post({ type: 'progress', summary: 'Processed 50 items' }),
		)
		expect(progressRes.status).toBe(200)

		// ── j. Complete the run ───────────────────────────────────────────
		const completeRes = await app.request(
			`/api/runs/${runId}/complete`,
			post({
				status: 'completed',
				summary: 'All items processed',
				tokens: { input: 100, output: 200 },
			}),
		)
		expect(completeRes.status).toBe(200)

		// ── k. Verify run is completed ────────────────────────────────────
		const finalRes = await app.request(`/api/runs/${runId}`)
		const finalRun = (await finalRes.json()) as {
			status: string
			summary: string
			tokens_input: number
			tokens_output: number
		}
		expect(finalRun.status).toBe('completed')
		expect(finalRun.summary).toBe('All items processed')
		expect(finalRun.tokens_input).toBe(100)
		expect(finalRun.tokens_output).toBe(200)

		// ── l. Verify events ──────────────────────────────────────────────
		const eventsRes = await app.request(`/api/runs/${runId}/events`)
		expect(eventsRes.status).toBe(200)
		const events = (await eventsRes.json()) as Array<{ type: string }>
		expect(events.length).toBe(2) // started + progress

		// ── m. Worker is back online after run completion ─────────────────
		const workerCheck = await app.request(
			'/api/workers/register',
			post({ id: 'worker-1' }),
		)
		const workerAfter = (await workerCheck.json()) as { status: string }
		expect(workerAfter.status).toBe('online')
	})

	test('concurrency guard: second claim returns null run when worker has active lease', async () => {
		// Create two pending runs so one is available even after first claim
		await app.request('/api/runs', post({ agent_id: 'agent-2', runtime: 'bun' }))
		await app.request('/api/runs', post({ agent_id: 'agent-3', runtime: 'bun' }))

		await app.request('/api/workers/register', post({ id: 'worker-2' }))
		const firstClaim = await app.request(
			'/api/workers/claim',
			post({ worker_id: 'worker-2' }),
		)
		expect(firstClaim.status).toBe(200)
		const firstBody = (await firstClaim.json()) as { run: unknown; lease_id: unknown }
		expect(firstBody.run).not.toBeNull()

		// Second claim -- worker already has active lease, returns null run
		const secondClaim = await app.request(
			'/api/workers/claim',
			post({ worker_id: 'worker-2' }),
		)
		expect(secondClaim.status).toBe(200)
		const secondBody = (await secondClaim.json()) as { run: unknown; lease_id: unknown }
		expect(secondBody.run).toBeNull()
		expect(secondBody.lease_id).toBeNull()
	})
})
