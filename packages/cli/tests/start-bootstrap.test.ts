/**
 * Tests that the `autopilot start` bootstrap path works:
 * - MCP is enabled on the Claude adapter
 * - Worker/run routes are accessible without user auth (machine-to-machine)
 * - Task routes require auth
 * - The full demo path is not blocked
 */
import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createCompanyDb, type CompanyDbResult } from '../../orchestrator/src/db'
import { createAuth, type Auth } from '../../orchestrator/src/auth'
import { createApp } from '../../orchestrator/src/api/app'
import { TaskService, RunService, WorkerService } from '../../orchestrator/src/services'

function post(body: unknown): RequestInit {
	return {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	}
}

describe('start bootstrap: auth + MCP', () => {
	const companyRoot = join(tmpdir(), `qp-start-test-${Date.now()}`)
	let dbResult: CompanyDbResult
	let auth: Auth
	let app: ReturnType<typeof createApp>

	beforeAll(async () => {
		await mkdir(companyRoot, { recursive: true })
		await writeFile(
			join(companyRoot, 'company.yaml'),
			'name: start-test\nowner:\n  name: Test\n  email: test@test.com\n',
		)

		dbResult = await createCompanyDb(companyRoot)

		for (const sql of [
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
				error TEXT, started_at TEXT, ended_at TEXT, created_at TEXT NOT NULL
			)`,
			`CREATE TABLE IF NOT EXISTS run_events (
				id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL,
				type TEXT NOT NULL, summary TEXT, metadata TEXT DEFAULT '{}',
				created_at TEXT NOT NULL
			)`,
			`CREATE TABLE IF NOT EXISTS workers (
				id TEXT PRIMARY KEY, device_id TEXT, name TEXT,
				status TEXT NOT NULL DEFAULT 'offline', capabilities TEXT DEFAULT '[]',
				registered_at TEXT NOT NULL, last_heartbeat TEXT
			)`,
			`CREATE TABLE IF NOT EXISTS worker_leases (
				id TEXT PRIMARY KEY, worker_id TEXT NOT NULL, run_id TEXT NOT NULL,
				claimed_at TEXT NOT NULL, expires_at TEXT NOT NULL,
				status TEXT NOT NULL DEFAULT 'active'
			)`,
		]) {
			await dbResult.raw.execute(sql)
		}

		auth = await createAuth(dbResult.db, companyRoot)

		const services = {
			taskService: new TaskService(dbResult.db),
			runService: new RunService(dbResult.db),
			workerService: new WorkerService(dbResult.db),
		}

		// Use the REAL createApp — with real auth middleware
		app = createApp({ companyRoot, db: dbResult.db, auth, services })
	})

	afterAll(async () => {
		dbResult.raw.close()
		await rm(companyRoot, { recursive: true, force: true })
	})

	test('worker routes are accessible without auth', async () => {
		// Register — no auth header
		const regRes = await app.request(
			'/api/workers/register',
			post({ id: 'test-worker-1', name: 'Test Worker' }),
		)
		expect(regRes.status).toBe(201)

		// Heartbeat — no auth header
		const hbRes = await app.request(
			'/api/workers/heartbeat',
			post({ worker_id: 'test-worker-1' }),
		)
		expect(hbRes.status).toBe(200)

		// Claim — no auth header (no pending runs, but should not 401)
		const claimRes = await app.request(
			'/api/workers/claim',
			post({ worker_id: 'test-worker-1' }),
		)
		expect(claimRes.status).toBe(200)
	})

	test('run routes are accessible without auth', async () => {
		// Create run — no auth header
		const createRes = await app.request(
			'/api/runs',
			post({ agent_id: 'test-agent', runtime: 'claude-code' }),
		)
		expect(createRes.status).toBe(201)
		const run = (await createRes.json()) as { id: string }

		// Post event — no auth header
		const evtRes = await app.request(
			`/api/runs/${run.id}/events`,
			post({ type: 'started', summary: 'Testing' }),
		)
		expect(evtRes.status).toBe(200)

		// Complete — no auth header
		const complRes = await app.request(
			`/api/runs/${run.id}/complete`,
			post({ status: 'completed', summary: 'Done' }),
		)
		expect(complRes.status).toBe(200)
	})

	test('task routes require auth (401 without credentials)', async () => {
		const res = await app.request('/api/tasks')
		expect(res.status).toBe(401)
	})

	test('health is public', async () => {
		const res = await app.request('/api/health')
		expect(res.status).toBe(200)
	})

	test('ClaudeCodeAdapter accepts useMcp + workDir config', () => {
		const { ClaudeCodeAdapter } = require('@questpie/autopilot-worker')
		const adapter = new ClaudeCodeAdapter({
			useMcp: true,
			workDir: companyRoot,
		})
		expect(adapter).toBeDefined()
		expect(typeof adapter.start).toBe('function')
	})

	test('full worker flow: register → claim → events → complete (no auth)', async () => {
		// Create a pending run
		const runRes = await app.request(
			'/api/runs',
			post({ agent_id: 'dev', runtime: 'claude-code', instructions: 'Do something' }),
		)
		expect(runRes.status).toBe(201)
		const run = (await runRes.json()) as { id: string }

		// Register worker
		await app.request('/api/workers/register', post({ id: 'w-full-test' }))

		// Claim
		const claimRes = await app.request('/api/workers/claim', post({ worker_id: 'w-full-test' }))
		const claim = (await claimRes.json()) as { run: { id: string } | null }
		expect(claim.run).not.toBeNull()
		expect(claim.run!.id).toBe(run.id)

		// Events
		await app.request(`/api/runs/${run.id}/events`, post({ type: 'started', summary: 'Go' }))
		await app.request(`/api/runs/${run.id}/events`, post({ type: 'progress', summary: 'Working' }))

		// Complete
		const complRes = await app.request(
			`/api/runs/${run.id}/complete`,
			post({ status: 'completed', summary: 'All done' }),
		)
		expect(complRes.status).toBe(200)

		// Verify
		const finalRes = await app.request(`/api/runs/${run.id}`)
		const final = (await finalRes.json()) as { status: string; summary: string }
		expect(final.status).toBe('completed')
		expect(final.summary).toBe('All done')
	})
})
