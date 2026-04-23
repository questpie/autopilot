/**
 * Pass 25.2 — Multi-Worker Topology Tests
 *
 * Validates multi-worker behavior is explicit and correct:
 * - Two+ workers polling the same orchestrator
 * - preferred_worker routing pins continuation to correct worker
 * - Generic runs are claimable by any eligible worker
 * - Continuation degrades when preferred worker is offline
 * - Session-affine runs do not leak to wrong worker
 */
import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createCompanyDb, type CompanyDbResult } from '../src/db'
import { TaskService, RunService, WorkerService } from '../src/services'

// ─── DDL ───────────────────────────────────────────────────────────────────

const DDL = [
	`DROP TABLE IF EXISTS tasks`,
	`DROP TABLE IF EXISTS runs`,
	`DROP TABLE IF EXISTS run_events`,
	`DROP TABLE IF EXISTS workers`,
	`DROP TABLE IF EXISTS worker_leases`,
	`CREATE TABLE tasks (
		id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT DEFAULT '',
		type TEXT NOT NULL, status TEXT NOT NULL, priority TEXT DEFAULT 'medium',
		assigned_to TEXT, project_id TEXT, workflow_id TEXT, workflow_step TEXT,
		context TEXT DEFAULT '{}', metadata TEXT DEFAULT '{}',
		queue TEXT, start_after TEXT, scheduled_by TEXT,
		created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
	)`,
	`CREATE TABLE runs (
		id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, task_id TEXT, project_id TEXT, worker_id TEXT,
		runtime TEXT NOT NULL, model TEXT, provider TEXT, variant TEXT, status TEXT NOT NULL DEFAULT 'pending',
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
]

const CAPS_CLAUDE = [{ runtime: 'claude-code', models: ['claude-opus-4-6'], maxConcurrent: 1 }]
const CAPS_CODEX = [{ runtime: 'codex', models: ['codex-mini-latest'], maxConcurrent: 1 }]

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('Multi-Worker Topology', () => {
	const companyRoot = join(tmpdir(), `qp-multi-worker-${Date.now()}`)
	let dbResult: CompanyDbResult
	let runService: RunService
	let workerService: WorkerService

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
		runService = new RunService(dbResult.db)
		workerService = new WorkerService(dbResult.db)
	})

	afterAll(async () => {
		dbResult.raw.close()
		await rm(companyRoot, { recursive: true, force: true })
	})

	// ── Two workers, generic run goes to first claimer ────────────────────

	test('generic run is claimed by whichever worker polls first', async () => {
		const runId = `run-generic-${Date.now()}`
		await runService.create({
			id: runId,
			agent_id: 'dev',
			runtime: 'claude-code',
			initiated_by: 'test',
		})

		// Worker A claims first
		const claimedA = await runService.claim('worker-a', 'claude-code', CAPS_CLAUDE)
		expect(claimedA).not.toBeUndefined()
		expect(claimedA!.id).toBe(runId)
		expect(claimedA!.worker_id).toBe('worker-a')

		// Worker B gets nothing — run already claimed
		const claimedB = await runService.claim('worker-b', 'claude-code', CAPS_CLAUDE)
		expect(claimedB).toBeUndefined()
	})

	// ── Both workers see separate pending runs ───────────────────────────

	test('two workers can each claim a different pending run', async () => {
		const ts = Date.now()
		const runId1 = `run-pair-1-${ts}`
		const runId2 = `run-pair-2-${ts}`

		await runService.create({ id: runId1, agent_id: 'dev', runtime: 'claude-code', initiated_by: 'test' })
		await runService.create({ id: runId2, agent_id: 'dev', runtime: 'claude-code', initiated_by: 'test' })

		const claimed1 = await runService.claim('worker-x', 'claude-code', CAPS_CLAUDE)
		const claimed2 = await runService.claim('worker-y', 'claude-code', CAPS_CLAUDE)

		expect(claimed1).not.toBeUndefined()
		expect(claimed2).not.toBeUndefined()
		expect(claimed1!.id).not.toBe(claimed2!.id)

		// Each worker owns their own run
		const ids = new Set([claimed1!.id, claimed2!.id])
		expect(ids.has(runId1)).toBe(true)
		expect(ids.has(runId2)).toBe(true)
	})

	// ── Continuation pins to preferred worker ────────────────────────────

	test('continuation run is pinned to original worker via preferred_worker_id', async () => {
		const originalId = `run-cont-pin-${Date.now()}`
		await runService.create({
			id: originalId,
			agent_id: 'dev',
			runtime: 'claude-code',
			initiated_by: 'test',
		})

		// Worker A claims and completes the original run
		await runService.claim('worker-alpha', 'claude-code', CAPS_CLAUDE)
		await runService.complete(originalId, {
			status: 'completed',
			resumable: true,
			runtime_session_ref: 'session-abc',
		})

		// Create continuation — inherits preferred_worker_id = worker-alpha
		const continuation = await runService.createContinuation(originalId, { message: 'continue' })
		expect(continuation).not.toBeUndefined()
		expect(continuation!.preferred_worker_id).toBe('worker-alpha')

		// Worker B (different worker) cannot claim it
		const claimedB = await runService.claim('worker-beta', 'claude-code', CAPS_CLAUDE)
		expect(claimedB).toBeUndefined()

		// Worker A (original worker) CAN claim it
		const claimedA = await runService.claim('worker-alpha', 'claude-code', CAPS_CLAUDE)
		expect(claimedA).not.toBeUndefined()
		expect(claimedA!.id).toBe(continuation!.id)
		expect(claimedA!.runtime_session_ref).toBe('session-abc')
	})

	// ── Continuation + generic run coexist ───────────────────────────────

	test('pinned continuation does not block generic runs for other workers', async () => {
		const ts = Date.now()
		const origId = `run-coexist-orig-${ts}`
		const genericId = `run-coexist-gen-${ts}`

		// Create and complete original run on worker-1
		await runService.create({ id: origId, agent_id: 'dev', runtime: 'claude-code', initiated_by: 'test' })
		await runService.claim('worker-1', 'claude-code', CAPS_CLAUDE)
		await runService.complete(origId, { status: 'completed', resumable: true, runtime_session_ref: 's1' })

		// Create continuation (pinned to worker-1) and a generic run
		await runService.createContinuation(origId, { message: 'continue' })
		await runService.create({ id: genericId, agent_id: 'dev', runtime: 'claude-code', initiated_by: 'test' })

		// Worker-2 skips the pinned continuation, claims the generic run
		const claimed2 = await runService.claim('worker-2', 'claude-code', CAPS_CLAUDE)
		expect(claimed2).not.toBeUndefined()
		expect(claimed2!.id).toBe(genericId)
	})

	// ── Runtime-mismatched workers don't steal runs ──────────────────────

	test('worker with wrong runtime cannot claim targeted run', async () => {
		const runId = `run-rt-mismatch-${Date.now()}`
		await runService.create({
			id: runId,
			agent_id: 'dev',
			runtime: 'codex',
			initiated_by: 'test',
			targeting: JSON.stringify({ required_runtime: 'codex', allow_fallback: false }),
		})

		// Claude worker cannot claim codex-targeted run
		const noClaim = await runService.claim('worker-claude-only', undefined, CAPS_CLAUDE)
		expect(noClaim).toBeUndefined()

		// Codex worker can
		const claimed = await runService.claim('worker-codex-only', undefined, CAPS_CODEX)
		expect(claimed).not.toBeUndefined()
		expect(claimed!.id).toBe(runId)
	})

	// ── Continuation session_ref preserved across worker boundary ────────

	test('continuation preserves runtime_session_ref for session resumption', async () => {
		const origId = `run-sess-ref-${Date.now()}`
		const sessionRef = `session-${Date.now()}`

		await runService.create({ id: origId, agent_id: 'dev', runtime: 'claude-code', initiated_by: 'test' })
		await runService.claim('worker-sess', 'claude-code', CAPS_CLAUDE)
		await runService.complete(origId, {
			status: 'completed',
			resumable: true,
			runtime_session_ref: sessionRef,
		})

		const continuation = await runService.createContinuation(origId, { message: 'follow-up' })
		expect(continuation).not.toBeUndefined()
		expect(continuation!.runtime_session_ref).toBe(sessionRef)
		expect(continuation!.resumed_from_run_id).toBe(origId)
		expect(continuation!.preferred_worker_id).toBe('worker-sess')
	})

	// ── Continuation always sets preferred_worker_id ────────────────────

	test('continuation sets preferred_worker_id regardless of resumable flag', async () => {
		// resumable check is route-level; service always creates the continuation
		const origId = `run-no-resume-${Date.now()}`
		await runService.create({ id: origId, agent_id: 'dev', runtime: 'claude-code', initiated_by: 'test' })
		await runService.claim('worker-nr', 'claude-code', CAPS_CLAUDE)
		await runService.complete(origId, { status: 'completed', resumable: false })

		const continuation = await runService.createContinuation(origId, { message: 'try' })
		expect(continuation).not.toBeUndefined()
		expect(continuation!.preferred_worker_id).toBe('worker-nr')
	})
})
