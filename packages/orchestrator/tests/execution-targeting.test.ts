/**
 * Tests for execution targeting / routing foundation.
 *
 * Covers:
 * - Runs without targeting are claimable by any worker
 * - required_runtime blocks ineligible workers (allow_fallback=false)
 * - required_runtime with fallback allows any worker
 * - required_worker_tags blocks ineligible workers
 * - required_worker_id in targeting pins to specific worker
 * - WorkflowEngine resolves targeting from step hints
 * - Continuation runs inherit targeting
 * - Task assignment is NOT used as worker routing
 */
import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createCompanyDb, type CompanyDbResult } from '../src/db'
import { TaskService, RunService, WorkerService, WorkflowEngine } from '../src/services'
import type { AuthoredConfig } from '../src/services'
import type { Agent, Workflow, Company } from '@questpie/autopilot-spec'

// ─── Fixtures ──────────────────────────────────────────────────────────────

const TEST_AGENTS: Agent[] = [
	{ id: 'ceo', name: 'CEO', role: 'meta', description: 'Intake agent', triggers: [] },
	{ id: 'dev', name: 'Developer', role: 'developer', description: 'Dev agent', triggers: [] },
]

const TARGETED_WORKFLOW: Workflow = {
	id: 'targeted',
	name: 'Targeted Workflow',
	description: '',
	steps: [
		{
			id: 'codex-step',
			type: 'agent',
			agent_id: 'dev',
			instructions: 'Run on codex',
			targeting: {
				required_runtime: 'codex',
				required_worker_tags: [],
				allow_fallback: false,
			},
		},
		{ id: 'finish', type: 'done' },
	],
}

const FALLBACK_WORKFLOW: Workflow = {
	id: 'fallback',
	name: 'Fallback Workflow',
	description: '',
	steps: [
		{
			id: 'gpu-step',
			type: 'agent',
			agent_id: 'dev',
			instructions: 'Needs GPU',
			targeting: {
				required_worker_tags: ['gpu'],
				allow_fallback: true,
			},
		},
		{ id: 'finish', type: 'done' },
	],
}

const DEFAULT_WORKFLOW: Workflow = {
	id: 'default',
	name: 'Default',
	description: '',
	steps: [
		{ id: 'develop', type: 'agent', agent_id: 'dev', instructions: 'Do the work' },
		{ id: 'finish', type: 'done' },
	],
}

const TEST_COMPANY: Company = {
	name: 'Test Co',
	slug: 'test-co',
	description: '',
	timezone: 'UTC',
	language: 'en',
	owner: { name: 'Test', email: 'test@test.com' },
	settings: {
		auto_assign: true,
		require_approval: ['merge', 'deploy'],
		max_concurrent_agents: 4,
		budget: { daily_token_limit: 5_000_000, alert_at: 80 },
		auth: {},
		inference: {
			gateway_base_url: 'https://ai-gateway.vercel.sh/v1',
			text_model: 'google/gemini-2.5-flash',
			embedding_model: 'google/gemini-embedding-2',
			embedding_dimensions: 768,
		},
		default_task_assignee: 'ceo',
		default_workflow: 'default',
		default_runtime: 'claude-code',
	},
	setup_completed: false,
}

function makeConfig(
	workflowOverrides?: Map<string, Workflow>,
): AuthoredConfig {
	const workflows = workflowOverrides ?? new Map([
		['default', DEFAULT_WORKFLOW],
		['targeted', TARGETED_WORKFLOW],
		['fallback', FALLBACK_WORKFLOW],
	])
	return {
		company: TEST_COMPANY,
		agents: new Map(TEST_AGENTS.map((a) => [a.id, a])),
		workflows,
	}
}

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
]

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('Execution Targeting', () => {
	const companyRoot = join(tmpdir(), `qp-targeting-${Date.now()}`)
	let dbResult: CompanyDbResult
	let taskService: TaskService
	let runService: RunService
	let workerService: WorkerService

	beforeAll(async () => {
		await mkdir(companyRoot, { recursive: true })
		await writeFile(
			join(companyRoot, 'company.yaml'),
			'name: test\nowner:\n  name: Test\n  email: test@test.com\n',
		)
		dbResult = await createCompanyDb(companyRoot)
		for (const sql of DDL) {
			await dbResult.raw.execute(sql)
		}
		taskService = new TaskService(dbResult.db)
		runService = new RunService(dbResult.db)
		workerService = new WorkerService(dbResult.db)
	})

	afterAll(async () => {
		dbResult.raw.close()
		await rm(companyRoot, { recursive: true, force: true })
	})

	// ── Claim without targeting ───────────────────────────────────────────

	test('run without targeting is claimable by any worker', async () => {
		const runId = `run-no-target-${Date.now()}`
		await runService.create({
			id: runId,
			agent_id: 'dev',
			runtime: 'claude-code',
			initiated_by: 'test',
		})

		const caps = [{ runtime: 'claude-code', models: ['claude-sonnet-4-20250514'], maxConcurrent: 1 }]
		const claimed = await runService.claim('worker-any', 'claude-code', caps)
		expect(claimed).not.toBeUndefined()
		expect(claimed!.id).toBe(runId)
	})

	// ── required_runtime (strict) ─────────────────────────────────────────

	test('required_runtime blocks ineligible worker when allow_fallback=false', async () => {
		const runId = `run-rt-strict-${Date.now()}`
		await runService.create({
			id: runId,
			agent_id: 'dev',
			runtime: 'codex',
			initiated_by: 'test',
			targeting: JSON.stringify({
				required_runtime: 'codex',
				required_worker_tags: [],
				allow_fallback: false,
			}),
		})

		// Worker with only claude-code should NOT get this run
		const claudeCaps = [{ runtime: 'claude-code', models: [], maxConcurrent: 1 }]
		const noClaim = await runService.claim('worker-claude', undefined, claudeCaps)
		expect(noClaim).toBeUndefined()

		// Worker with codex SHOULD get this run
		const codexCaps = [{ runtime: 'codex', models: [], maxConcurrent: 1 }]
		const claimed = await runService.claim('worker-codex', undefined, codexCaps)
		expect(claimed).not.toBeUndefined()
		expect(claimed!.id).toBe(runId)
	})

	// ── required_runtime (fallback) ───────────────────────────────────────

	test('required_runtime with allow_fallback=true allows any worker', async () => {
		const runId = `run-rt-fallback-${Date.now()}`
		await runService.create({
			id: runId,
			agent_id: 'dev',
			runtime: 'codex',
			initiated_by: 'test',
			targeting: JSON.stringify({
				required_runtime: 'codex',
				required_worker_tags: [],
				allow_fallback: true,
			}),
		})

		const claudeCaps = [{ runtime: 'claude-code', models: [], maxConcurrent: 1 }]
		const claimed = await runService.claim('worker-fb', undefined, claudeCaps)
		expect(claimed).not.toBeUndefined()
		expect(claimed!.id).toBe(runId)
	})

	// ── required_worker_tags ─────────────────────────────────────────────

	test('required_worker_tags blocks ineligible worker when allow_fallback=false', async () => {
		const runId = `run-cap-strict-${Date.now()}`
		await runService.create({
			id: runId,
			agent_id: 'dev',
			runtime: 'claude-code',
			initiated_by: 'test',
			targeting: JSON.stringify({
				required_worker_tags: ['gpu', 'large-context'],
				allow_fallback: false,
			}),
		})

		// Worker missing 'gpu' tag
		const smallCaps = [{ runtime: 'claude-code', models: ['large-context'], maxConcurrent: 1 }]
		const noClaim = await runService.claim('worker-small', 'claude-code', smallCaps)
		expect(noClaim).toBeUndefined()

		// Worker with both tags (gpu as runtime tag, large-context as model)
		const gpuCaps = [{ runtime: 'gpu', models: ['large-context'], maxConcurrent: 1 }]
		const claimed = await runService.claim('worker-gpu', undefined, gpuCaps)
		expect(claimed).not.toBeUndefined()
		expect(claimed!.id).toBe(runId)
	})

	test('required_worker_tags with allow_fallback=true allows any worker', async () => {
		const runId = `run-cap-fallback-${Date.now()}`
		await runService.create({
			id: runId,
			agent_id: 'dev',
			runtime: 'claude-code',
			initiated_by: 'test',
			targeting: JSON.stringify({
				required_worker_tags: ['gpu'],
				allow_fallback: true,
			}),
		})

		const noCaps = [{ runtime: 'claude-code', models: [], maxConcurrent: 1 }]
		const claimed = await runService.claim('worker-nocap', 'claude-code', noCaps)
		expect(claimed).not.toBeUndefined()
		expect(claimed!.id).toBe(runId)
	})

	// ── required_worker_id in targeting ──────────────────────────────────

	test('targeting required_worker_id pins to specific worker', async () => {
		const runId = `run-pref-target-${Date.now()}`
		await runService.create({
			id: runId,
			agent_id: 'dev',
			runtime: 'claude-code',
			initiated_by: 'test',
			targeting: JSON.stringify({
				required_worker_id: 'worker-special',
				allow_fallback: false,
			}),
		})

		const caps = [{ runtime: 'claude-code', models: [], maxConcurrent: 1 }]

		// Wrong worker should not get it
		const noClaim = await runService.claim('worker-other', 'claude-code', caps)
		expect(noClaim).toBeUndefined()

		// Right worker should get it
		const claimed = await runService.claim('worker-special', 'claude-code', caps)
		expect(claimed).not.toBeUndefined()
		expect(claimed!.id).toBe(runId)
	})

	// ── WorkflowEngine resolves targeting from step ──────────────────────

	test('WorkflowEngine attaches targeting from step hints', async () => {
		const config = makeConfig()
		config.company = {
			...TEST_COMPANY,
			settings: { ...TEST_COMPANY.settings, default_workflow: 'targeted' },
		}
		const engine = new WorkflowEngine(config, taskService, runService)

		const taskId = `task-targeted-${Date.now()}`
		await taskService.create({
			id: taskId,
			title: 'Needs codex',
			type: 'feature',
			created_by: 'test',
		})

		const result = await engine.intake(taskId)
		expect(result).not.toBeNull()
		expect(result!.runId).not.toBeNull()

		const run = await runService.get(result!.runId!)
		expect(run).not.toBeUndefined()
		expect(run!.runtime).toBe('codex')
		expect(run!.targeting).not.toBeNull()

		const targeting = JSON.parse(run!.targeting!)
		expect(targeting.required_runtime).toBe('codex')
		expect(targeting.allow_fallback).toBe(false)
	})

	test('WorkflowEngine omits targeting when step has no hints', async () => {
		const engine = new WorkflowEngine(makeConfig(), taskService, runService)

		const taskId = `task-no-target-${Date.now()}`
		await taskService.create({
			id: taskId,
			title: 'Default step',
			type: 'feature',
			created_by: 'test',
		})

		const result = await engine.intake(taskId)
		expect(result).not.toBeNull()
		expect(result!.runId).not.toBeNull()

		const run = await runService.get(result!.runId!)
		expect(run).not.toBeUndefined()
		expect(run!.runtime).toBe('claude-code')
		// No targeting stored when there are no constraints beyond defaults
		expect(run!.targeting).toBeNull()
	})

	// ── Continuation inherits targeting ──────────────────────────────────

	test('continuation run inherits targeting from original', async () => {
		const originalId = `run-cont-orig-${Date.now()}`
		const targeting = JSON.stringify({
			required_runtime: 'codex',
			required_worker_tags: ['gpu'],
			allow_fallback: false,
		})

		await runService.create({
			id: originalId,
			agent_id: 'dev',
			runtime: 'codex',
			initiated_by: 'test',
			targeting,
		})

		// Claim and complete the original
		const codexCaps = [{ runtime: 'codex', models: ['gpu'], maxConcurrent: 1 }]
		await runService.claim('worker-codex-cont', undefined, codexCaps)
		await runService.complete(originalId, {
			status: 'completed',
			resumable: true,
			runtime_session_ref: 'session-123',
		})

		const continuation = await runService.createContinuation(originalId, {
			message: 'Continue the work',
		})
		expect(continuation).not.toBeUndefined()
		expect(continuation!.targeting).toBe(targeting)
	})

	// ── Task assignment is NOT worker routing ────────────────────────────

	test('task assigned_to does not affect run claim eligibility', async () => {
		const suffix = Date.now()
		const runId = `run-assign-sep-${suffix}`
		const taskId = `task-assign-sep-${suffix}`
		// Use unique runtime to avoid picking up stale runs from earlier tests
		const runtime = `isolation-rt-${suffix}`

		await taskService.create({
			id: taskId,
			title: 'Assigned task',
			type: 'feature',
			created_by: 'test',
			assigned_to: 'ceo', // Task is assigned to ceo agent
		})

		await runService.create({
			id: runId,
			agent_id: 'ceo',
			task_id: taskId,
			runtime,
			initiated_by: 'workflow-engine',
		})

		// Any worker can claim — agent assignment doesn't filter workers
		const caps = [{ runtime, models: [], maxConcurrent: 1 }]
		const claimed = await runService.claim('worker-random', runtime, caps)
		expect(claimed).not.toBeUndefined()
		expect(claimed!.id).toBe(runId)
		expect(claimed!.agent_id).toBe('ceo') // Agent identity preserved
		expect(claimed!.worker_id).toBe('worker-random') // But any worker executes
	})
})
