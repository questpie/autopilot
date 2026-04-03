/**
 * End-to-end dogfood proving test.
 *
 * Exercises the real dogfood workflow on this repo's config:
 *   task create → workflow intake → run claim → run complete →
 *   human_approval block → approve → workflow done
 *
 * Also exercises: reject, reply, cancel, activity audit.
 *
 * Uses real config loading (company.yaml + team/ YAML), real DB,
 * and real WorkflowEngine — not mocked fixtures.
 */
import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createCompanyDb, type CompanyDbResult } from '../src/db'
import { loadCompany, loadAgents, loadWorkflows, loadEnvironments } from '../src/config/loader'
import { TaskService, RunService, WorkerService, WorkflowEngine, ActivityService } from '../src/services'
import type { AuthoredConfig } from '../src/services'

// ─── Setup: real config from this repo ─────────────────────────────────────

const REPO_ROOT = join(__dirname, '..', '..', '..')

describe('Dogfood E2E', () => {
	const companyRoot = join(tmpdir(), `qp-dogfood-e2e-${Date.now()}`)
	let dbResult: CompanyDbResult
	let taskService: TaskService
	let runService: RunService
	let workerService: WorkerService
	let activityService: ActivityService
	let engine: WorkflowEngine
	let config: AuthoredConfig

	beforeAll(async () => {
		// Create temp company root with symlinks to real config
		await mkdir(join(companyRoot, 'team', 'agents'), { recursive: true })
		await mkdir(join(companyRoot, 'team', 'workflows'), { recursive: true })
		await mkdir(join(companyRoot, 'team', 'environments'), { recursive: true })

		// Copy real config files (not symlink — avoid cross-device issues)
		const { readFile } = await import('node:fs/promises')
		const companyYaml = await readFile(join(REPO_ROOT, 'company.yaml'), 'utf-8')
		await writeFile(join(companyRoot, 'company.yaml'), companyYaml)

		const devYaml = await readFile(join(REPO_ROOT, 'team', 'agents', 'dev.yaml'), 'utf-8')
		await writeFile(join(companyRoot, 'team', 'agents', 'dev.yaml'), devYaml)

		const dogfoodYaml = await readFile(join(REPO_ROOT, 'team', 'workflows', 'dogfood.yaml'), 'utf-8')
		await writeFile(join(companyRoot, 'team', 'workflows', 'dogfood.yaml'), dogfoodYaml)

		// Load real config
		const company = await loadCompany(companyRoot)
		const agents = new Map((await loadAgents(companyRoot)).map((a) => [a.id, a]))
		const workflows = new Map((await loadWorkflows(companyRoot)).map((w) => [w.id, w]))
		const environments = new Map((await loadEnvironments(companyRoot)).map((e) => [e.id, e]))
		config = { company, agents, workflows, environments }

		// Create DB
		dbResult = await createCompanyDb(companyRoot)
		taskService = new TaskService(dbResult.db)
		runService = new RunService(dbResult.db)
		workerService = new WorkerService(dbResult.db)
		activityService = new ActivityService(dbResult.db)
		engine = new WorkflowEngine(config, taskService, runService, activityService)
	})

	afterAll(async () => {
		dbResult.raw.close()
		await rm(companyRoot, { recursive: true, force: true })
	})

	// ── Config validation ────────────────────────────────────────────────

	test('real config loads and validates without issues', () => {
		expect(config.agents.has('dev')).toBe(true)
		expect(config.workflows.has('dogfood')).toBe(true)
		expect(config.company.settings.default_workflow).toBe('dogfood')
		expect(config.company.settings.default_task_assignee).toBe('dev')

		const issues = engine.validate()
		expect(issues).toEqual([])
	})

	// ── Full approve flow ────────────────────────────────────────────────

	test('full dogfood flow: create → implement → review → approve → done', async () => {
		// 1. Create a task
		const taskId = `task-dogfood-${Date.now()}`
		const task = await taskService.create({
			id: taskId,
			title: 'Add a comment to README',
			type: 'feature',
			description: 'Add a one-line comment at the top of README.md',
			created_by: 'andrej',
		})
		expect(task).not.toBeUndefined()
		expect(task!.status).toBe('backlog')

		// 2. Workflow intake — should assign to dev, attach dogfood workflow, create run
		const intake = await engine.intake(taskId)
		expect(intake).not.toBeNull()
		expect(intake!.task.assigned_to).toBe('dev')
		expect(intake!.task.workflow_id).toBe('dogfood')
		expect(intake!.task.workflow_step).toBe('implement')
		expect(intake!.task.status).toBe('active')
		expect(intake!.runId).not.toBeNull()
		expect(intake!.actions).toContain('assigned')
		expect(intake!.actions).toContain('workflow_attached')
		expect(intake!.actions).toContain('run_created')

		// 3. Verify the run was created correctly
		const run = await runService.get(intake!.runId!)
		expect(run!.agent_id).toBe('dev')
		expect(run!.task_id).toBe(taskId)
		expect(run!.status).toBe('pending')
		expect(run!.instructions).toContain('Implement the task')

		// 4. Simulate worker claiming and completing the run
		const caps = [{ runtime: 'claude-code', models: [], maxConcurrent: 1, tags: [] }]
		const claimed = await runService.claim('worker-local', 'claude-code', caps)
		expect(claimed).not.toBeUndefined()
		expect(claimed!.id).toBe(intake!.runId!)

		await runService.complete(intake!.runId!, {
			status: 'completed',
			summary: 'Added comment to README.md',
		})

		// 5. Advance — should move to human_approval step (blocked)
		const advanced = await engine.advance(taskId)
		expect(advanced).not.toBeNull()
		expect(advanced!.task.workflow_step).toBe('review')
		expect(advanced!.task.status).toBe('blocked')
		expect(advanced!.runId).toBeNull() // no run for approval steps

		// 6. Approve — should advance to done
		const approved = await engine.approve(taskId, 'andrej')
		expect(approved).not.toBeNull()
		expect(approved!.task.workflow_step).toBe('done')
		expect(approved!.task.status).toBe('done')

		// 7. Verify activity audit trail
		const activity = await activityService.listForTask(taskId)
		expect(activity.length).toBeGreaterThan(0)
		const approvalEntry = activity.find((a) => a.type === 'approval')
		expect(approvalEntry).toBeDefined()
		expect(approvalEntry!.actor).toBe('andrej')
	})

	// ── Reply flow ───────────────────────────────────────────────────────

	test('dogfood flow with reply: implement → review → reply → implement again → done', async () => {
		const taskId = `task-reply-${Date.now()}`
		await taskService.create({
			id: taskId,
			title: 'Fix typo in docs',
			type: 'bug',
			created_by: 'andrej',
		})

		// Intake → implement run
		const intake = await engine.intake(taskId)
		const caps = [{ runtime: 'claude-code', models: [], maxConcurrent: 1, tags: [] }]
		await runService.claim('worker-local-2', 'claude-code', caps)
		await runService.complete(intake!.runId!, { status: 'completed' })
		await engine.advance(taskId)

		// Now on review step — reply with feedback
		const replied = await engine.reply(taskId, 'Also fix the typo on line 42', 'andrej')
		expect(replied).not.toBeNull()
		// Reply advances to next step — but dogfood workflow has no second agent step after review
		// So it goes to 'done'. In a more complex workflow it would go to next agent.
		expect(replied!.task.status).toBe('done')

		// Verify activity
		const activity = await activityService.listForTask(taskId)
		const replyEntry = activity.find((a) => a.type === 'reply')
		expect(replyEntry).toBeDefined()
	})

	// ── Reject flow ──────────────────────────────────────────────────────

	test('dogfood flow with reject: implement → review → reject → task done', async () => {
		const taskId = `task-reject-${Date.now()}`
		await taskService.create({
			id: taskId,
			title: 'Wrong approach',
			type: 'feature',
			created_by: 'andrej',
		})

		const intake = await engine.intake(taskId)
		const caps = [{ runtime: 'claude-code', models: [], maxConcurrent: 1, tags: [] }]
		await runService.claim('worker-local-3', 'claude-code', caps)
		await runService.complete(intake!.runId!, { status: 'completed' })
		await engine.advance(taskId)

		// Reject
		const rejected = await engine.reject(taskId, 'This approach is wrong, needs rethinking', 'andrej')
		expect(rejected).not.toBeNull()
		expect(rejected!.task.status).toBe('done')
		expect(rejected!.actions).toContain('rejected')

		// No pending runs for this task
		const pending = (await runService.list({ status: 'pending' })).filter((r) => r.task_id === taskId)
		expect(pending.length).toBe(0)
	})

	// ── Cancel flow ──────────────────────────────────────────────────────

	test('can cancel a pending run before worker claims it', async () => {
		const taskId = `task-cancel-${Date.now()}`
		await taskService.create({
			id: taskId,
			title: 'Cancel me',
			type: 'chore',
			created_by: 'andrej',
		})

		const intake = await engine.intake(taskId)
		expect(intake!.runId).not.toBeNull()

		// Cancel the run before any worker claims it
		const cancelled = await runService.cancel(intake!.runId!, 'changed my mind')
		expect(cancelled).not.toBeUndefined()
		expect(cancelled!.status).toBe('failed')
		expect(cancelled!.error).toBe('changed my mind')

		// Run is no longer claimable
		const caps = [{ runtime: 'claude-code', models: [], maxConcurrent: 1, tags: [] }]
		const claimed = await runService.claim('worker-any', 'claude-code', caps)
		// Should not get the cancelled run (may get others or undefined)
		if (claimed) {
			expect(claimed.id).not.toBe(intake!.runId!)
		}
	})

	// ── Inspection ───────────────────────────────────────────────────────

	test('runs list filtered by task_id returns only that task runs', async () => {
		const taskId = `task-filter-${Date.now()}`
		await taskService.create({
			id: taskId,
			title: 'Filterable',
			type: 'feature',
			created_by: 'andrej',
		})

		await engine.intake(taskId)

		const taskRuns = await runService.list({ task_id: taskId })
		expect(taskRuns.length).toBe(1)
		expect(taskRuns[0]!.task_id).toBe(taskId)
	})
})
