/**
 * Tests for the wait / approval / wake-up foundation.
 *
 * Covers:
 * - human_approval step blocks cleanly (no run created)
 * - approve resumes workflow progression
 * - reject records outcome and marks task done
 * - reply advances workflow and injects message as instructions
 * - activity audit trail is persisted
 * - next agent step creates a run after wake-up
 * - approve/reject/reply return null when not on human_approval step
 */
import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createCompanyDb, type CompanyDbResult } from '../src/db'
import { TaskService, RunService, WorkflowEngine, ActivityService } from '../src/services'
import type { AuthoredConfig } from '../src/services'
import type { Agent, Workflow, Company } from '@questpie/autopilot-spec'

// ─── Fixtures ──────────────────────────────────────────────────────────────

const AGENTS: Agent[] = [
	{ id: 'ceo', name: 'CEO', role: 'meta', description: '', triggers: [] },
	{ id: 'dev', name: 'Dev', role: 'developer', description: '', triggers: [] },
]

const WORKFLOW: Workflow = {
	id: 'review-flow',
	name: 'Review Flow',
	description: '',
	steps: [
		{ id: 'develop', type: 'agent', agent_id: 'dev', instructions: 'Build it' },
		{ id: 'review', type: 'human_approval' },
		{ id: 'deploy', type: 'agent', agent_id: 'dev', instructions: 'Deploy it' },
		{ id: 'finish', type: 'done' },
	],
}

const COMPANY: Company = {
	name: 'Test', slug: 'test', description: '', timezone: 'UTC', language: 'en',
	owner: { name: 'Test', email: 'test@test.com' },
	settings: {
		auto_assign: true, require_approval: [], max_concurrent_agents: 4,
		budget: { daily_token_limit: 0, alert_at: 0 }, auth: {},
		inference: { gateway_base_url: '', text_model: '', embedding_model: '', embedding_dimensions: 768 },
		default_task_assignee: 'ceo', default_workflow: 'review-flow', default_runtime: 'claude-code',
	},
	setup_completed: false,
}

function makeConfig(): AuthoredConfig {
	return {
		company: COMPANY,
		agents: new Map(AGENTS.map((a) => [a.id, a])),
		workflows: new Map([[WORKFLOW.id, WORKFLOW]]),
	}
}

const DDL = [
	`DROP TABLE IF EXISTS tasks`,
	`DROP TABLE IF EXISTS runs`,
	`DROP TABLE IF EXISTS run_events`,
	`DROP TABLE IF EXISTS activity`,
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
	`CREATE TABLE activity (
		id INTEGER PRIMARY KEY AUTOINCREMENT, actor TEXT NOT NULL,
		type TEXT NOT NULL, summary TEXT NOT NULL, details TEXT,
		created_at TEXT NOT NULL
	)`,
]

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Approval Flow', () => {
	const companyRoot = join(tmpdir(), `qp-approval-${Date.now()}`)
	let dbResult: CompanyDbResult
	let taskService: TaskService
	let runService: RunService
	let activityService: ActivityService
	let engine: WorkflowEngine

	beforeAll(async () => {
		await mkdir(companyRoot, { recursive: true })
		await writeFile(join(companyRoot, 'company.yaml'), 'name: test\nowner:\n  name: Test\n  email: test@test.com\n')
		dbResult = await createCompanyDb(companyRoot)
		for (const sql of DDL) await dbResult.raw.execute(sql)
		taskService = new TaskService(dbResult.db)
		runService = new RunService(dbResult.db)
		activityService = new ActivityService(dbResult.db)
		engine = new WorkflowEngine(makeConfig(), taskService, runService, activityService)
	})

	afterAll(async () => {
		dbResult.raw.close()
		await rm(companyRoot, { recursive: true, force: true })
	})

	/** Helper: create task, intake, advance through develop step to reach review. */
	async function reachApprovalStep(): Promise<string> {
		const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
		await taskService.create({ id: taskId, title: 'Test', type: 'feature', created_by: 'test' })
		const intake = await engine.intake(taskId)
		// Complete the develop run to advance to review step
		await runService.complete(intake!.runId!, { status: 'completed' })
		await engine.advance(taskId)
		return taskId
	}

	test('human_approval step blocks cleanly with no run created', async () => {
		const taskId = await reachApprovalStep()
		const task = await taskService.get(taskId)
		expect(task!.status).toBe('blocked')
		expect(task!.workflow_step).toBe('review')
		// No pending runs for this task beyond the completed one
		const runs = await runService.list({ status: 'pending' })
		const taskRuns = runs.filter((r) => r.task_id === taskId)
		expect(taskRuns.length).toBe(0)
	})

	test('approve resumes workflow and creates next run', async () => {
		const taskId = await reachApprovalStep()

		const result = await engine.approve(taskId, 'andrej')
		expect(result).not.toBeNull()
		expect(result!.task.status).toBe('active')
		expect(result!.task.workflow_step).toBe('deploy')
		expect(result!.runId).not.toBeNull()
		expect(result!.actions).toContain('advanced')
		expect(result!.actions).toContain('run_created')

		// Verify run was created for the deploy step
		const run = await runService.get(result!.runId!)
		expect(run!.agent_id).toBe('dev')
		expect(run!.instructions).toBe('Deploy it')
	})

	test('approve logs activity', async () => {
		const taskId = await reachApprovalStep()
		await engine.approve(taskId, 'andrej')

		const entries = await activityService.listForTask(taskId)
		expect(entries.length).toBeGreaterThan(0)
		const approval = entries.find((e) => e.type === 'approval')
		expect(approval).toBeDefined()
		expect(approval!.actor).toBe('andrej')
		expect(approval!.summary).toContain(taskId)
	})

	test('reject marks task done and logs activity', async () => {
		const taskId = await reachApprovalStep()

		const result = await engine.reject(taskId, 'Not ready yet', 'andrej')
		expect(result).not.toBeNull()
		expect(result!.task.status).toBe('done')
		expect(result!.runId).toBeNull()
		expect(result!.actions).toContain('rejected')

		// Activity logged
		const entries = await activityService.listForTask(taskId)
		const rejection = entries.find((e) => e.type === 'rejection')
		expect(rejection).toBeDefined()
		expect(rejection!.summary).toContain('Not ready yet')
	})

	test('reply advances workflow and injects message as instructions', async () => {
		const taskId = await reachApprovalStep()

		const result = await engine.reply(taskId, 'Please also run integration tests', 'andrej')
		expect(result).not.toBeNull()
		expect(result!.task.status).toBe('active')
		expect(result!.task.workflow_step).toBe('deploy')
		expect(result!.runId).not.toBeNull()

		// Verify run instructions include the reply
		const run = await runService.get(result!.runId!)
		expect(run!.instructions).toContain('Please also run integration tests')
		expect(run!.instructions).toContain('Deploy it') // Original step instructions preserved

		// Activity logged
		const entries = await activityService.listForTask(taskId)
		const reply = entries.find((e) => e.type === 'reply')
		expect(reply).toBeDefined()
	})

	test('approve returns null when not on human_approval step', async () => {
		const taskId = `task-not-blocked-${Date.now()}`
		await taskService.create({ id: taskId, title: 'Active', type: 'feature', created_by: 'test' })
		await engine.intake(taskId)
		// Task is on first agent step, not approval step
		expect(await engine.approve(taskId)).toBeNull()
	})

	test('reject returns null when not on human_approval step', async () => {
		const taskId = `task-not-blocked2-${Date.now()}`
		await taskService.create({ id: taskId, title: 'Active', type: 'feature', created_by: 'test' })
		await engine.intake(taskId)
		expect(await engine.reject(taskId, 'nope')).toBeNull()
	})

	test('reply returns null when not on human_approval step', async () => {
		const taskId = `task-not-blocked3-${Date.now()}`
		await taskService.create({ id: taskId, title: 'Active', type: 'feature', created_by: 'test' })
		await engine.intake(taskId)
		expect(await engine.reply(taskId, 'hello')).toBeNull()
	})

	test('full flow: develop → approve → deploy → done', async () => {
		const taskId = await reachApprovalStep()

		// Approve
		const approved = await engine.approve(taskId, 'andrej')
		expect(approved!.task.workflow_step).toBe('deploy')

		// Complete the deploy run
		await runService.complete(approved!.runId!, { status: 'completed' })

		// Advance to done
		const done = await engine.advance(taskId)
		expect(done!.task.status).toBe('done')
		expect(done!.task.workflow_step).toBe('finish')
	})

	test('full flow: develop → reject → task done', async () => {
		const taskId = await reachApprovalStep()
		const result = await engine.reject(taskId, 'Scope too large', 'andrej')
		expect(result!.task.status).toBe('done')
		// No further runs
		const pending = (await runService.list({ status: 'pending' })).filter((r) => r.task_id === taskId)
		expect(pending.length).toBe(0)
	})

	test('reply-created run has final instructions at creation time (no post-create race)', async () => {
		const taskId = await reachApprovalStep()

		const result = await engine.reply(taskId, 'Focus on edge cases', 'andrej')
		expect(result).not.toBeNull()
		expect(result!.runId).not.toBeNull()

		// The run must already have the combined instructions — no second write needed.
		// A worker claiming this run immediately will see the human reply.
		const run = await runService.get(result!.runId!)
		expect(run!.instructions).toBe('Deploy it\n\nHuman reply: Focus on edge cases')
	})

	test('reply with no step instructions uses reply as sole instructions', async () => {
		// Create a workflow where the post-approval step has no instructions
		const noInstrWorkflow: Workflow = {
			id: 'no-instr',
			name: 'No Instructions',
			description: '',
			steps: [
				{ id: 'dev', type: 'agent', agent_id: 'dev', instructions: 'Build' },
				{ id: 'review', type: 'human_approval' },
				{ id: 'deploy', type: 'agent', agent_id: 'dev' }, // no instructions
				{ id: 'finish', type: 'done' },
			],
		}
		const config: AuthoredConfig = {
			...makeConfig(),
			workflows: new Map([['no-instr', noInstrWorkflow]]),
			company: { ...COMPANY, settings: { ...COMPANY.settings, default_workflow: 'no-instr' } },
		}
		const eng = new WorkflowEngine(config, taskService, runService, activityService)

		const taskId = `task-noinstr-${Date.now()}`
		await taskService.create({ id: taskId, title: 'No instr', type: 'feature', created_by: 'test' })
		const intake = await eng.intake(taskId)
		await runService.complete(intake!.runId!, { status: 'completed' })
		await eng.advance(taskId)

		const result = await eng.reply(taskId, 'Just deploy it', 'andrej')
		const run = await runService.get(result!.runId!)
		expect(run!.instructions).toBe('Just deploy it')
	})

	test('full flow: develop → reply → deploy with instructions → done', async () => {
		const taskId = await reachApprovalStep()

		const replied = await engine.reply(taskId, 'Add error handling too', 'andrej')
		expect(replied!.task.workflow_step).toBe('deploy')

		// Complete deploy
		await runService.complete(replied!.runId!, { status: 'completed' })
		const done = await engine.advance(taskId)
		expect(done!.task.status).toBe('done')
	})
})
