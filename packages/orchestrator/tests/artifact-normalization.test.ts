/**
 * Tests for artifact kind normalization at the agent-output boundary.
 *
 * Covers:
 * - Unknown artifact kind is normalized to "other" with original_kind in metadata
 * - Valid artifact kind is persisted unchanged
 * - Run completion does not fail on unknown artifact kind
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
import {
	TaskService,
	RunService,
	WorkerService,
	EnrollmentService,
	WorkflowEngine,
	ActivityService,
	ArtifactService,
	ConversationBindingService,
} from '../src/services'
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

function buildTestApp(companyRoot: string, db: CompanyDb, services: Services) {
	const app = new Hono<AppEnv>()

	app.use('*', async (c, next) => {
		c.set('companyRoot', companyRoot)
		c.set('db', db)
		c.set('auth', {} as never)
		c.set('services', services)
		c.set('authoredConfig', {
			company: {} as never,
			agents: new Map(),
			workflows: new Map(),
			environments: new Map(),
			providers: new Map(),
			capabilityProfiles: new Map(),
		})
		c.set('actor', FAKE_ACTOR)
		c.set('workerId', null)
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

describe('artifact kind normalization', () => {
	const companyRoot = join(tmpdir(), `qp-art-norm-${Date.now()}`)
	let rawClient: ReturnType<typeof createClient>
	let app: ReturnType<typeof buildTestApp>
	let artifactService: ArtifactService

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

		// Ensure tables exist (some may not be in migrations yet)
		await rawClient.execute(`
			CREATE TABLE IF NOT EXISTS runs (
				id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, task_id TEXT, worker_id TEXT,
				runtime TEXT NOT NULL, model TEXT, provider TEXT, variant TEXT,
				status TEXT NOT NULL DEFAULT 'pending', initiated_by TEXT, instructions TEXT,
				summary TEXT, tokens_input INTEGER DEFAULT 0, tokens_output INTEGER DEFAULT 0,
				error TEXT, started_at TEXT, ended_at TEXT, created_at TEXT NOT NULL,
				runtime_session_ref TEXT, resumed_from_run_id TEXT,
				preferred_worker_id TEXT, resumable INTEGER DEFAULT 0, targeting TEXT
			)
		`)
		await rawClient.execute(`
			CREATE TABLE IF NOT EXISTS run_events (
				id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL,
				type TEXT NOT NULL, summary TEXT, metadata TEXT DEFAULT '{}',
				created_at TEXT NOT NULL
			)
		`)
		await rawClient.execute(`
			CREATE TABLE IF NOT EXISTS artifacts (
				id TEXT PRIMARY KEY, run_id TEXT NOT NULL, task_id TEXT,
				kind TEXT NOT NULL, title TEXT NOT NULL,
				ref_kind TEXT NOT NULL, ref_value TEXT NOT NULL,
				mime_type TEXT, metadata TEXT DEFAULT '{}',
				created_at TEXT NOT NULL
			)
		`)
		await rawClient.execute(`
			CREATE TABLE IF NOT EXISTS workers (
				id TEXT PRIMARY KEY, device_id TEXT, name TEXT,
				status TEXT NOT NULL DEFAULT 'offline', capabilities TEXT DEFAULT '[]',
				registered_at TEXT NOT NULL, last_heartbeat TEXT, machine_secret_hash TEXT
			)
		`)
		await rawClient.execute(`
			CREATE TABLE IF NOT EXISTS worker_leases (
				id TEXT PRIMARY KEY, worker_id TEXT NOT NULL, run_id TEXT NOT NULL,
				claimed_at TEXT NOT NULL, expires_at TEXT NOT NULL,
				status TEXT NOT NULL DEFAULT 'active'
			)
		`)

		const taskService = new TaskService(db)
		const runService = new RunService(db)
		artifactService = new ArtifactService(db)
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
		const services: Services = {
			taskService,
			runService,
			workerService: new WorkerService(db),
			enrollmentService: new EnrollmentService(db),
			activityService: new ActivityService(db),
			artifactService,
			conversationBindingService: new ConversationBindingService(db),
			sessionMessageService: {} as never,
			workflowEngine,
		}

		app = buildTestApp(companyRoot, db, services)
	})

	afterAll(async () => {
		rawClient.close()
		await rm(companyRoot, { recursive: true, force: true })
	})

	/** Create a run, claim it, start it, return the run ID. */
	async function createRunningRun(): Promise<string> {
		const createRes = await app.request('/api/runs', post({ agent_id: 'agent-1', runtime: 'bun' }))
		const created = (await createRes.json()) as { id: string }
		const runId = created.id

		await app.request('/api/workers/register', post({ id: 'worker-norm', name: 'W' }))
		await app.request('/api/workers/claim', post({ worker_id: 'worker-norm' }))
		await app.request(`/api/runs/${runId}/events`, post({ type: 'started', summary: 'go' }))

		return runId
	}

	test('unknown kind normalizes to "other" with original_kind in metadata', async () => {
		const runId = await createRunningRun()

		const completeRes = await app.request(
			`/api/runs/${runId}/complete`,
			post({
				status: 'completed',
				summary: 'Done',
				artifacts: [
					{
						kind: 'poem',
						title: 'A lovely poem',
						ref_kind: 'inline',
						ref_value: 'Roses are red...',
					},
				],
			}),
		)
		expect(completeRes.status).toBe(200)

		const arts = await artifactService.listForRun(runId)
		expect(arts.length).toBe(1)
		expect(arts[0]!.kind).toBe('other')

		const meta = JSON.parse(arts[0]!.metadata ?? '{}')
		expect(meta.original_kind).toBe('poem')
	})

	test('valid kind stays unchanged with no original_kind in metadata', async () => {
		const runId = await createRunningRun()

		const completeRes = await app.request(
			`/api/runs/${runId}/complete`,
			post({
				status: 'completed',
				summary: 'Done',
				artifacts: [
					{
						kind: 'doc',
						title: 'Feature spec',
						ref_kind: 'file',
						ref_value: 'docs/spec.md',
					},
				],
			}),
		)
		expect(completeRes.status).toBe(200)

		const arts = await artifactService.listForRun(runId)
		expect(arts.length).toBe(1)
		expect(arts[0]!.kind).toBe('doc')

		const meta = JSON.parse(arts[0]!.metadata ?? '{}')
		expect(meta.original_kind).toBeUndefined()
	})

	test('run completion does not fail on unknown artifact kind', async () => {
		const runId = await createRunningRun()

		const completeRes = await app.request(
			`/api/runs/${runId}/complete`,
			post({
				status: 'completed',
				summary: 'Done',
				artifacts: [
					{
						kind: 'haiku',
						title: 'A haiku',
						ref_kind: 'inline',
						ref_value: 'Old pond / frog jumps in / splash',
					},
					{
						kind: 'changed_file',
						title: 'src/index.ts',
						ref_kind: 'file',
						ref_value: 'src/index.ts',
					},
				],
			}),
		)
		expect(completeRes.status).toBe(200)

		const arts = await artifactService.listForRun(runId)
		expect(arts.length).toBe(2)

		const haiku = arts.find((a) => a.title === 'A haiku')
		const file = arts.find((a) => a.title === 'src/index.ts')

		expect(haiku!.kind).toBe('other')
		expect(file!.kind).toBe('changed_file')
	})

	test('artifact with metadata preserves existing metadata alongside original_kind', async () => {
		const runId = await createRunningRun()

		const completeRes = await app.request(
			`/api/runs/${runId}/complete`,
			post({
				status: 'completed',
				summary: 'Done',
				artifacts: [
					{
						kind: 'limerick',
						title: 'A limerick',
						ref_kind: 'inline',
						ref_value: 'There once was...',
						metadata: { author: 'agent-1', style: 'humorous' },
					},
				],
			}),
		)
		expect(completeRes.status).toBe(200)

		const arts = await artifactService.listForRun(runId)
		expect(arts.length).toBe(1)
		expect(arts[0]!.kind).toBe('other')

		const meta = JSON.parse(arts[0]!.metadata ?? '{}')
		expect(meta.original_kind).toBe('limerick')
		expect(meta.author).toBe('agent-1')
		expect(meta.style).toBe('humorous')
	})
})
