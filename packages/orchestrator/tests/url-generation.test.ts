/**
 * Pass 25.2 — URL Generation / Base-Origin Hardening Tests
 *
 * Validates:
 * - Preview URLs use configured orchestratorUrl, not request-derived origin
 * - Notification bridge URLs use configured base
 * - No localhost leakage when ORCHESTRATOR_URL is set to a real domain
 * - Relative fallback when orchestratorUrl is undefined
 */
import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Hono } from 'hono'
import { createCompanyDb, type CompanyDbResult, type CompanyDb } from '../src/db'
import {
	TaskService,
	RunService,
	WorkerService,
	EnrollmentService,
	WorkflowEngine,
	ActivityService,
	ArtifactService,
	ConversationBindingService,
	TaskRelationService,
	TaskGraphService,
	SecretService,
	QueryService,
	SessionService,
} from '../src/services'
import type { AppEnv, Services } from '../src/api/app'
import type { Actor } from '../src/auth/types'
import { runs } from '../src/api/routes/runs'
import { workers } from '../src/api/routes/workers'

// ─── DDL ───────────────────────────────────────────────────────────────────

const DDL = [
	`DROP TABLE IF EXISTS tasks`,
	`DROP TABLE IF EXISTS runs`,
	`DROP TABLE IF EXISTS run_events`,
	`DROP TABLE IF EXISTS workers`,
	`DROP TABLE IF EXISTS worker_leases`,
	`DROP TABLE IF EXISTS artifacts`,
	`DROP TABLE IF EXISTS shared_secrets`,
	`DROP TABLE IF EXISTS queries`,
	`DROP TABLE IF EXISTS sessions`,
	`DROP TABLE IF EXISTS conversation_bindings`,
	`DROP TABLE IF EXISTS task_relations`,
	`CREATE TABLE tasks (
		id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT DEFAULT '',
		type TEXT NOT NULL, status TEXT NOT NULL, priority TEXT DEFAULT 'medium',
		assigned_to TEXT, workflow_id TEXT, workflow_step TEXT,
		context TEXT DEFAULT '{}', metadata TEXT DEFAULT '{}',
		created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
	)`,
	`CREATE TABLE runs (
		id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, task_id TEXT, worker_id TEXT,
		runtime TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
		initiated_by TEXT, instructions TEXT, summary TEXT,
		tokens_input INTEGER DEFAULT 0, tokens_output INTEGER DEFAULT 0,
		error TEXT, started_at TEXT, ended_at TEXT, created_at TEXT NOT NULL,
		runtime_session_ref TEXT, resumed_from_run_id TEXT,
		preferred_worker_id TEXT, resumable INTEGER DEFAULT 0,
		targeting TEXT
	)`,
	`CREATE TABLE run_events (
		id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL,
		type TEXT NOT NULL, summary TEXT, metadata TEXT DEFAULT '{}',
		created_at TEXT NOT NULL
	)`,
	`CREATE TABLE workers (
		id TEXT PRIMARY KEY, device_id TEXT, name TEXT,
		status TEXT NOT NULL DEFAULT 'offline',
		capabilities TEXT DEFAULT '[]',
		registered_at TEXT NOT NULL, last_heartbeat TEXT,
		machine_secret_hash TEXT
	)`,
	`CREATE TABLE worker_leases (
		id TEXT PRIMARY KEY, worker_id TEXT NOT NULL, run_id TEXT NOT NULL,
		claimed_at TEXT NOT NULL, expires_at TEXT NOT NULL,
		status TEXT NOT NULL DEFAULT 'active'
	)`,
	`CREATE TABLE artifacts (
		id TEXT PRIMARY KEY, run_id TEXT NOT NULL, task_id TEXT,
		kind TEXT NOT NULL, title TEXT NOT NULL,
		ref_kind TEXT NOT NULL, ref_value TEXT NOT NULL,
		mime_type TEXT, metadata TEXT DEFAULT '{}',
		created_at TEXT NOT NULL
	)`,
	`CREATE TABLE shared_secrets (
		id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE,
		encrypted_value TEXT NOT NULL, scope TEXT NOT NULL DEFAULT 'worker',
		created_at TEXT NOT NULL, updated_at TEXT NOT NULL
	)`,
	`CREATE TABLE queries (
		id TEXT PRIMARY KEY, prompt TEXT NOT NULL, agent_id TEXT NOT NULL,
		run_id TEXT, status TEXT NOT NULL DEFAULT 'pending',
		allow_repo_mutation INTEGER DEFAULT 0, mutated_repo INTEGER DEFAULT 0,
		summary TEXT, continue_from TEXT, carryover_summary TEXT,
		runtime_session_ref TEXT, created_by TEXT NOT NULL,
		created_at TEXT NOT NULL, ended_at TEXT, metadata TEXT DEFAULT '{}'
	)`,
	`CREATE TABLE sessions (
		id TEXT PRIMARY KEY, provider_id TEXT NOT NULL,
		external_conversation_id TEXT NOT NULL,
		external_thread_id TEXT, mode TEXT NOT NULL,
		task_id TEXT, query_id TEXT,
		created_at TEXT NOT NULL, updated_at TEXT NOT NULL
	)`,
	`CREATE TABLE conversation_bindings (
		id TEXT PRIMARY KEY, task_id TEXT NOT NULL, provider_id TEXT NOT NULL,
		external_conversation_id TEXT NOT NULL, external_thread_id TEXT,
		mode TEXT NOT NULL DEFAULT 'task_thread',
		created_at TEXT NOT NULL
	)`,
	`CREATE TABLE task_relations (
		id TEXT PRIMARY KEY, parent_task_id TEXT NOT NULL, child_task_id TEXT NOT NULL,
		relation_type TEXT NOT NULL DEFAULT 'subtask',
		created_at TEXT NOT NULL
	)`,
]

const FAKE_ACTOR: Actor = {
	id: 'test-user',
	type: 'human',
	name: 'Test User',
	role: 'owner',
	source: 'api',
}

function buildTestApp(companyRoot: string, db: CompanyDb, services: Services, orchestratorUrl?: string) {
	const app = new Hono<AppEnv>()

	app.use('*', async (c, next) => {
		c.set('companyRoot', companyRoot)
		c.set('db', db)
		c.set('auth', {} as never)
		c.set('services', services)
		c.set('authoredConfig', {
			company: {} as any,
			agents: new Map(),
			workflows: new Map(),
			environments: new Map(),
			providers: new Map(),
			capabilityProfiles: new Map(),
		})
		c.set('orchestratorUrl', orchestratorUrl)
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

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('URL Generation — Configured Base URL', () => {
	const companyRoot = join(tmpdir(), `qp-url-gen-${Date.now()}`)
	let dbResult: CompanyDbResult
	let services: Services

	beforeAll(async () => {
		await mkdir(join(companyRoot, '.autopilot'), { recursive: true })
		await writeFile(
			join(companyRoot, '.autopilot', 'company.yaml'),
			'name: test\nslug: test\nowner:\n  name: Test\n  email: test@test.com\n',
		)
		dbResult = await createCompanyDb(companyRoot)
		for (const sql of DDL) {
			await dbResult.raw.execute(sql)
		}

		const taskService = new TaskService(dbResult.db)
		const runService = new RunService(dbResult.db)
		const workerService = new WorkerService(dbResult.db)
		const enrollmentService = new EnrollmentService(dbResult.db)
		const activityService = new ActivityService(dbResult.db)
		const artifactService = new ArtifactService(dbResult.db)
		const conversationBindingService = new ConversationBindingService(dbResult.db)
		const taskRelationService = new TaskRelationService(dbResult.db)
		const secretService = new SecretService(dbResult.db)
		const queryService = new QueryService(dbResult.db)
		const sessionService = new SessionService(dbResult.db)
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
		const taskGraphService = new TaskGraphService(taskService, taskRelationService, workflowEngine)

		services = {
			taskService,
			runService,
			workerService,
			enrollmentService,
			activityService,
			artifactService,
			conversationBindingService,
			taskRelationService,
			taskGraphService,
			workflowEngine,
			secretService,
			queryService,
			sessionService,
		}
	})

	afterAll(async () => {
		dbResult.raw.close()
		await rm(companyRoot, { recursive: true, force: true })
	})

	// ── Preview URL uses configured orchestratorUrl ──────────────────────

	test('preview_url artifact uses configured orchestratorUrl, not request origin', async () => {
		const publicUrl = 'https://autopilot.example.com'
		const app = buildTestApp(companyRoot, dbResult.db, services, publicUrl)

		// Create and claim a run
		const createRes = await app.request('/api/runs', post({ agent_id: 'dev', runtime: 'bun' }))
		const created = (await createRes.json()) as { id: string }
		const runId = created.id

		// Register worker and claim
		await app.request('/api/workers/register', post({ id: 'worker-url-1', name: 'URL Worker' }))
		await app.request('/api/workers/claim', post({ worker_id: 'worker-url-1' }))

		// Complete with preview files
		const completeRes = await app.request(
			`/api/runs/${runId}/complete`,
			post({
				status: 'completed',
				summary: 'done',
				artifacts: [
					{
						kind: 'preview_file',
						title: 'index.html',
						ref_kind: 'inline',
						ref_value: '<html><body>Hello</body></html>',
						mime_type: 'text/html',
					},
				],
			}),
		)
		expect(completeRes.status).toBe(200)

		// Check the auto-created preview_url artifact
		const artifactsRes = await app.request(`/api/runs/${runId}/artifacts`)
		const artifacts = (await artifactsRes.json()) as Array<{ kind: string; ref_value: string }>
		const previewArt = artifacts.find((a) => a.kind === 'preview_url')

		expect(previewArt).not.toBeUndefined()
		// Must use the configured public URL, NOT localhost or request origin
		expect(previewArt!.ref_value).toStartWith('https://autopilot.example.com/')
		expect(previewArt!.ref_value).toBe(`https://autopilot.example.com/api/previews/${runId}/index.html`)
		// Must NOT contain localhost
		expect(previewArt!.ref_value).not.toContain('localhost')
	})

	// ── Preview URL falls back to relative path when no base URL ─────────

	test('preview_url falls back to relative path when orchestratorUrl is undefined', async () => {
		const app = buildTestApp(companyRoot, dbResult.db, services, undefined)

		const createRes = await app.request('/api/runs', post({ agent_id: 'dev', runtime: 'bun' }))
		const created = (await createRes.json()) as { id: string }
		const runId = created.id

		await app.request('/api/workers/register', post({ id: 'worker-url-2', name: 'URL Worker 2' }))
		await app.request('/api/workers/claim', post({ worker_id: 'worker-url-2' }))

		await app.request(
			`/api/runs/${runId}/complete`,
			post({
				status: 'completed',
				summary: 'done',
				artifacts: [
					{
						kind: 'preview_file',
						title: 'index.html',
						ref_kind: 'inline',
						ref_value: '<html><body>Hello</body></html>',
						mime_type: 'text/html',
					},
				],
			}),
		)

		const artifactsRes = await app.request(`/api/runs/${runId}/artifacts`)
		const artifacts = (await artifactsRes.json()) as Array<{ kind: string; ref_value: string }>
		const previewArt = artifacts.find((a) => a.kind === 'preview_url')

		expect(previewArt).not.toBeUndefined()
		// Should be a relative path — no scheme, no host
		expect(previewArt!.ref_value).toStartWith('/api/previews/')
		expect(previewArt!.ref_value).not.toContain('localhost')
		expect(previewArt!.ref_value).not.toContain('http')
	})

	// ── Various topology shapes produce correct URLs ─────────────────────

	test.each([
		['https://autopilot.example.com', 'public DNS'],
		['http://192.168.1.100:7778', 'LAN IP'],
		['https://autopilot.tail1234.ts.net', 'Tailscale private URL'],
		['http://10.0.0.5:7778', 'private overlay'],
	])('preview URL correct for %s (%s)', async (baseUrl, _label) => {
		const app = buildTestApp(companyRoot, dbResult.db, services, baseUrl)

		const createRes = await app.request('/api/runs', post({ agent_id: 'dev', runtime: 'bun' }))
		const created = (await createRes.json()) as { id: string }
		const runId = created.id

		const workerId = `worker-topo-${Date.now()}`
		await app.request('/api/workers/register', post({ id: workerId, name: 'Topo Worker' }))
		await app.request('/api/workers/claim', post({ worker_id: workerId }))

		await app.request(
			`/api/runs/${runId}/complete`,
			post({
				status: 'completed',
				summary: 'done',
				artifacts: [
					{
						kind: 'preview_file',
						title: 'dist/index.html',
						ref_kind: 'inline',
						ref_value: '<html></html>',
						mime_type: 'text/html',
					},
				],
			}),
		)

		const artifactsRes = await app.request(`/api/runs/${runId}/artifacts`)
		const artifacts = (await artifactsRes.json()) as Array<{ kind: string; ref_value: string }>
		const previewArt = artifacts.find((a) => a.kind === 'preview_url')

		expect(previewArt).not.toBeUndefined()
		expect(previewArt!.ref_value).toStartWith(`${baseUrl}/api/previews/${runId}/`)
	})
})

describe('Notification Bridge URL Construction', () => {
	const CAPS = [{ runtime: 'claude-code', models: [], maxConcurrent: 1 }]
	const EMPTY_CONFIG = { company: {} as any, agents: new Map(), workflows: new Map(), environments: new Map(), providers: new Map(), capabilityProfiles: new Map(), defaults: {} }

	async function setupBridgeTest(orchestratorUrl: string | undefined) {
		const { NotificationBridge } = await import('../src/providers/notification-bridge')
		const { EventBus } = await import('../src/events/event-bus')

		const root = join(tmpdir(), `qp-notif-${Date.now()}`)
		await mkdir(join(root, '.autopilot'), { recursive: true })
		await writeFile(join(root, '.autopilot', 'company.yaml'), 'name: test\nslug: test\nowner:\n  name: Test\n  email: test@test.com\n')
		const db = await createCompanyDb(root)
		for (const sql of DDL) { await db.raw.execute(sql) }

		const runService = new RunService(db.db)
		const taskService = new TaskService(db.db)
		const artifactService = new ArtifactService(db.db)
		const conversationBindingService = new ConversationBindingService(db.db)

		const runId = `run-notif-${Date.now()}`
		await runService.create({ id: runId, agent_id: 'dev', task_id: 'task-1', runtime: 'claude-code', initiated_by: 'test' })
		await runService.claim('worker-notif', 'claude-code', CAPS)
		await runService.complete(runId, { status: 'completed', summary: 'done' })

		const bridge = new NotificationBridge(
			new EventBus(), EMPTY_CONFIG,
			runService, taskService, artifactService, conversationBindingService,
			{ companyRoot: root, orchestratorUrl },
		)

		// @ts-expect-error accessing private method for test
		const payload = await bridge.buildPayload({ type: 'run_completed', runId, status: 'completed' })

		const cleanup = async () => { db.raw.close(); await rm(root, { recursive: true, force: true }) }
		return { payload, runId, cleanup }
	}

	test('notification payload uses configured orchestratorUrl for all links', async () => {
		const publicUrl = 'https://my-autopilot.company.com'
		const { payload, runId, cleanup } = await setupBridgeTest(publicUrl)

		expect(payload).not.toBeNull()
		expect(payload!.orchestrator_url).toBe(publicUrl)
		expect(payload!.run_url).toBe(`${publicUrl}/api/runs/${runId}`)
		expect(payload!.task_url).toBe(`${publicUrl}/api/tasks/task-1`)
		expect(payload!.run_url).not.toContain('localhost')
		expect(payload!.task_url).not.toContain('localhost')

		await cleanup()
	})

	test('notification payload omits URLs when orchestratorUrl is undefined', async () => {
		const { payload, cleanup } = await setupBridgeTest(undefined)

		expect(payload).not.toBeNull()
		expect(payload!.orchestrator_url).toBeUndefined()
		expect(payload!.run_url).toBeUndefined()
		expect(payload!.task_url).toBeUndefined()

		await cleanup()
	})
})
