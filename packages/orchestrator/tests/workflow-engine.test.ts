/**
 * Tests for workflow-driven intake and linear progression.
 *
 * Covers:
 * - Default assignee resolution from authored config
 * - Workflow attachment on task creation
 * - Agent step creates a pending run
 * - Run completion advances workflow to next step
 * - Human approval step blocks progression
 * - Approval advances past human_approval step
 * - Done step closes the task
 * - Explicit assignment override
 * - No workflow = no intake side-effects
 */
import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createCompanyDb, type CompanyDbResult } from '../src/db'
import { TaskService, RunService, WorkflowEngine } from '../src/services'
import type { AuthoredConfig } from '../src/services'
import type { Agent, Workflow, Company } from '@questpie/autopilot-spec'

// ─── Test Fixtures ──────────────────────────────────────────────────────────

const TEST_AGENTS: Agent[] = [
	{ id: 'ceo', name: 'CEO', role: 'meta', description: 'Intake agent', triggers: [] },
	{ id: 'dev', name: 'Developer', role: 'developer', description: 'Dev agent', triggers: [] },
	{ id: 'reviewer', name: 'Reviewer', role: 'reviewer', description: 'Review agent', triggers: [] },
]

const TEST_WORKFLOW: Workflow = {
	id: 'default',
	name: 'Default Workflow',
	description: 'Standard intake → dev → review → approve → done',
	steps: [
		{ id: 'intake', type: 'agent', agent_id: 'ceo', instructions: 'Analyze and plan' },
		{ id: 'develop', type: 'agent', agent_id: 'dev', instructions: 'Implement the plan' },
		{ id: 'review', type: 'agent', agent_id: 'reviewer', instructions: 'Review the implementation' },
		{ id: 'approve', type: 'human_approval' },
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

function makeConfig(overrides?: Partial<AuthoredConfig>): AuthoredConfig {
	return {
		company: overrides?.company ?? TEST_COMPANY,
		agents: overrides?.agents ?? new Map(TEST_AGENTS.map((a) => [a.id, a])),
		workflows: overrides?.workflows ?? new Map([[TEST_WORKFLOW.id, TEST_WORKFLOW]]),
	}
}

// ─── Test DDL ───────────────────────────────────────────────────────────────

// Drop and recreate tables to match current Drizzle schema
// (migrations may have drifted column names)
const DDL = [
	`DROP TABLE IF EXISTS tasks`,
	`DROP TABLE IF EXISTS runs`,
	`DROP TABLE IF EXISTS run_events`,
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
]

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('WorkflowEngine', () => {
	const companyRoot = join(tmpdir(), `qp-wf-test-${Date.now()}`)
	let dbResult: CompanyDbResult
	let taskService: TaskService
	let runService: RunService

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
	})

	afterAll(async () => {
		dbResult.raw.close()
		await rm(companyRoot, { recursive: true, force: true })
	})

	test('validate() detects missing agent references', () => {
		const engine = new WorkflowEngine(
			makeConfig({
				company: {
					...TEST_COMPANY,
					settings: {
						...TEST_COMPANY.settings,
						default_task_assignee: 'nonexistent',
					},
				},
			}),
			taskService,
			runService,
		)
		const issues = engine.validate()
		expect(issues.length).toBeGreaterThan(0)
		expect(issues[0]).toContain('nonexistent')
	})

	test('validate() passes with valid config', () => {
		const engine = new WorkflowEngine(makeConfig(), taskService, runService)
		const issues = engine.validate()
		expect(issues).toEqual([])
	})

	test('intake resolves default assignee from config', async () => {
		const engine = new WorkflowEngine(makeConfig(), taskService, runService)
		const task = await taskService.create({
			id: `task-assign-${Date.now()}`,
			title: 'Test assignment',
			type: 'feature',
			created_by: 'test',
		})

		const result = await engine.intake(task!.id)
		expect(result).not.toBeNull()
		expect(result!.task.assigned_to).toBe('ceo')
		expect(result!.actions).toContain('assigned')
	})

	test('intake attaches workflow and sets initial step', async () => {
		const engine = new WorkflowEngine(makeConfig(), taskService, runService)
		const task = await taskService.create({
			id: `task-wf-${Date.now()}`,
			title: 'Test workflow',
			type: 'feature',
			created_by: 'test',
		})

		const result = await engine.intake(task!.id)
		expect(result).not.toBeNull()
		expect(result!.task.workflow_id).toBe('default')
		expect(result!.task.workflow_step).toBe('intake')
		expect(result!.actions).toContain('workflow_attached')
	})

	test('intake creates run for first agent step', async () => {
		const engine = new WorkflowEngine(makeConfig(), taskService, runService)
		const task = await taskService.create({
			id: `task-run-${Date.now()}`,
			title: 'Test run creation',
			type: 'feature',
			created_by: 'test',
		})

		const result = await engine.intake(task!.id)
		expect(result).not.toBeNull()
		expect(result!.runId).not.toBeNull()
		expect(result!.actions).toContain('run_created')
		expect(result!.task.status).toBe('active')

		// Verify the run exists and is configured correctly
		const run = await runService.get(result!.runId!)
		expect(run).toBeDefined()
		expect(run!.agent_id).toBe('ceo')
		expect(run!.task_id).toBe(task!.id)
		expect(run!.runtime).toBe('claude-code')
		expect(run!.status).toBe('pending')
		expect(run!.instructions).toBe('Analyze and plan')
	})

	test('run completion advances to next workflow step', async () => {
		const engine = new WorkflowEngine(makeConfig(), taskService, runService)
		const taskId = `task-adv-${Date.now()}`
		await taskService.create({
			id: taskId,
			title: 'Test advance',
			type: 'feature',
			created_by: 'test',
		})

		// Intake → first step (intake/ceo)
		const intake = await engine.intake(taskId)
		expect(intake!.runId).not.toBeNull()

		// Complete the run
		await runService.complete(intake!.runId!, { status: 'completed', summary: 'Done' })

		// Advance → next step (develop/dev)
		const advanced = await engine.advance(taskId)
		expect(advanced).not.toBeNull()
		expect(advanced!.task.workflow_step).toBe('develop')
		expect(advanced!.task.assigned_to).toBe('dev')
		expect(advanced!.runId).not.toBeNull()
		expect(advanced!.actions).toContain('advanced')
		expect(advanced!.actions).toContain('reassigned')
		expect(advanced!.actions).toContain('run_created')

		// Verify new run targets the dev agent
		const run = await runService.get(advanced!.runId!)
		expect(run!.agent_id).toBe('dev')
		expect(run!.instructions).toBe('Implement the plan')
	})

	test('human_approval step blocks progression', async () => {
		const engine = new WorkflowEngine(makeConfig(), taskService, runService)
		const taskId = `task-block-${Date.now()}`
		await taskService.create({
			id: taskId,
			title: 'Test blocking',
			type: 'feature',
			created_by: 'test',
		})

		// Intake → first step
		const intake = await engine.intake(taskId)
		await runService.complete(intake!.runId!, { status: 'completed' })

		// Advance through develop
		const step2 = await engine.advance(taskId)
		await runService.complete(step2!.runId!, { status: 'completed' })

		// Advance through review
		const step3 = await engine.advance(taskId)
		await runService.complete(step3!.runId!, { status: 'completed' })

		// Advance → should hit human_approval step
		const step4 = await engine.advance(taskId)
		expect(step4).not.toBeNull()
		expect(step4!.task.workflow_step).toBe('approve')
		expect(step4!.task.status).toBe('blocked')
		expect(step4!.runId).toBeNull() // No run created
		expect(step4!.actions).toContain('approval_needed')
	})

	test('approve advances past human_approval step to done', async () => {
		const engine = new WorkflowEngine(makeConfig(), taskService, runService)
		const taskId = `task-approve-${Date.now()}`
		await taskService.create({
			id: taskId,
			title: 'Test approval',
			type: 'feature',
			created_by: 'test',
		})

		// Fast-forward: set task directly to the approve step
		await taskService.update(taskId, {
			workflow_id: 'default',
			workflow_step: 'approve',
			status: 'blocked',
		})

		const result = await engine.approve(taskId)
		expect(result).not.toBeNull()
		expect(result!.task.status).toBe('done')
		expect(result!.task.workflow_step).toBe('finish')
		expect(result!.actions).toContain('done')
	})

	test('done step marks task done', async () => {
		// Workflow with only a done step
		const doneOnlyWorkflow: Workflow = {
			id: 'done-only',
			name: 'Instant Done',
			description: '',
			steps: [{ id: 'finish', type: 'done' }],
		}
		const config = makeConfig({
			workflows: new Map([['done-only', doneOnlyWorkflow]]),
			company: {
				...TEST_COMPANY,
				settings: { ...TEST_COMPANY.settings, default_workflow: 'done-only' },
			},
		})
		const engine = new WorkflowEngine(config, taskService, runService)

		const task = await taskService.create({
			id: `task-done-${Date.now()}`,
			title: 'Test done',
			type: 'feature',
			created_by: 'test',
		})

		const result = await engine.intake(task!.id)
		expect(result).not.toBeNull()
		expect(result!.task.status).toBe('done')
		expect(result!.actions).toContain('done')
		expect(result!.runId).toBeNull()
	})

	test('explicit assignment overrides default', async () => {
		const engine = new WorkflowEngine(makeConfig(), taskService, runService)
		const task = await taskService.create({
			id: `task-override-${Date.now()}`,
			title: 'Test override',
			type: 'feature',
			assigned_to: 'dev', // Explicit assignment
			created_by: 'test',
		})

		const result = await engine.intake(task!.id)
		expect(result).not.toBeNull()
		// Should keep the explicit assignment, not override to 'ceo'
		expect(result!.task.assigned_to).toBe('dev')
		expect(result!.actions).not.toContain('assigned')
	})

	test('no config = no side effects', async () => {
		const emptyConfig = makeConfig({
			company: {
				...TEST_COMPANY,
				settings: {
					...TEST_COMPANY.settings,
					default_task_assignee: undefined,
					default_workflow: undefined,
				},
			},
			workflows: new Map(),
		})
		const engine = new WorkflowEngine(emptyConfig, taskService, runService)

		const task = await taskService.create({
			id: `task-noop-${Date.now()}`,
			title: 'Test no-op',
			type: 'feature',
			created_by: 'test',
		})

		const result = await engine.intake(task!.id)
		expect(result).not.toBeNull()
		expect(result!.task.assigned_to).toBeNull()
		expect(result!.task.workflow_id).toBeNull()
		expect(result!.task.workflow_step).toBeNull()
		expect(result!.actions).toEqual([])
		expect(result!.runId).toBeNull()
	})

	test('full linear progression: intake → dev → review → approval → done', async () => {
		const engine = new WorkflowEngine(makeConfig(), taskService, runService)
		const taskId = `task-full-${Date.now()}`
		await taskService.create({
			id: taskId,
			title: 'Full flow test',
			type: 'feature',
			created_by: 'test',
		})

		// Step 1: Intake (ceo agent)
		const s1 = await engine.intake(taskId)
		expect(s1!.task.workflow_step).toBe('intake')
		expect(s1!.task.assigned_to).toBe('ceo')
		expect(s1!.runId).not.toBeNull()
		await runService.complete(s1!.runId!, { status: 'completed' })

		// Step 2: Develop (dev agent)
		const s2 = await engine.advance(taskId)
		expect(s2!.task.workflow_step).toBe('develop')
		expect(s2!.task.assigned_to).toBe('dev')
		expect(s2!.runId).not.toBeNull()
		await runService.complete(s2!.runId!, { status: 'completed' })

		// Step 3: Review (reviewer agent)
		const s3 = await engine.advance(taskId)
		expect(s3!.task.workflow_step).toBe('review')
		expect(s3!.task.assigned_to).toBe('reviewer')
		expect(s3!.runId).not.toBeNull()
		await runService.complete(s3!.runId!, { status: 'completed' })

		// Step 4: Human approval (blocks)
		const s4 = await engine.advance(taskId)
		expect(s4!.task.workflow_step).toBe('approve')
		expect(s4!.task.status).toBe('blocked')
		expect(s4!.runId).toBeNull()

		// Step 5: Approve → done
		const s5 = await engine.approve(taskId)
		expect(s5!.task.workflow_step).toBe('finish')
		expect(s5!.task.status).toBe('done')

		// Verify final task state
		const final = await taskService.get(taskId)
		expect(final!.status).toBe('done')
	})

	test('advance returns null when no workflow is attached', async () => {
		const engine = new WorkflowEngine(makeConfig(), taskService, runService)
		const task = await taskService.create({
			id: `task-nowf-${Date.now()}`,
			title: 'No workflow',
			type: 'feature',
			created_by: 'test',
		})

		const result = await engine.advance(task!.id)
		expect(result).toBeNull()
	})

	test('approve returns null when not on human_approval step', async () => {
		const engine = new WorkflowEngine(makeConfig(), taskService, runService)
		const taskId = `task-noapprove-${Date.now()}`
		await taskService.create({
			id: taskId,
			title: 'Not approvable',
			type: 'feature',
			created_by: 'test',
		})

		// Set to an agent step
		await taskService.update(taskId, {
			workflow_id: 'default',
			workflow_step: 'intake',
		})

		const result = await engine.approve(taskId)
		expect(result).toBeNull()
	})

	test('workflow end without done step marks task done', async () => {
		// Workflow that ends on agent step (no explicit done)
		const shortWorkflow: Workflow = {
			id: 'short',
			name: 'Short Workflow',
			description: '',
			steps: [
				{ id: 'work', type: 'agent', agent_id: 'dev', instructions: 'Do it' },
			],
		}
		const config = makeConfig({
			workflows: new Map([['short', shortWorkflow]]),
			company: {
				...TEST_COMPANY,
				settings: { ...TEST_COMPANY.settings, default_workflow: 'short' },
			},
		})
		const engine = new WorkflowEngine(config, taskService, runService)
		const taskId = `task-short-${Date.now()}`
		await taskService.create({
			id: taskId,
			title: 'Short flow',
			type: 'feature',
			created_by: 'test',
		})

		const intake = await engine.intake(taskId)
		await runService.complete(intake!.runId!, { status: 'completed' })

		// Advance past the only step → no more steps → task done
		const result = await engine.advance(taskId)
		expect(result).not.toBeNull()
		expect(result!.task.status).toBe('done')
	})
})
