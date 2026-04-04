/**
 * Tests for Epic / Task Graph V1 + hardening pass.
 *
 * Covers:
 * - Task relation creation (TaskRelationService)
 * - Child lookup by parent
 * - Parent lookup by child
 * - Duplicate relation prevention (unique constraint)
 * - DB-enforced dedupe_key uniqueness
 * - spawnChildren creates tasks + relations correctly
 * - spawnChildren idempotency via deterministic IDs + dedupe_key
 * - spawnChildren without dedupe_key creates new tasks each time
 * - Child rollup helper with failed child detection
 * - Run failure propagates to task status
 * - Normal task/workflow creation still works after graph additions
 */
import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createCompanyDb, type CompanyDbResult } from '../src/db'
import { TaskService, RunService, WorkerService, WorkflowEngine, TaskRelationService, TaskGraphService, ActivityService } from '../src/services'
import type { AuthoredConfig } from '../src/services'
import type { Agent, Workflow, CompanyScope } from '@questpie/autopilot-spec'

// ─── Test Fixtures ──────────────────────────────────────────────────────────

const TEST_AGENTS: Agent[] = [
	{ id: 'ceo', name: 'CEO', role: 'meta', description: 'Intake agent', triggers: [] },
	{ id: 'dev', name: 'Developer', role: 'developer', description: 'Dev agent', triggers: [] },
]

const TEST_WORKFLOW: Workflow = {
	id: 'default',
	name: 'Default Workflow',
	description: 'Simple intake → dev → done',
	steps: [
		{ id: 'intake', type: 'agent', agent_id: 'ceo', instructions: 'Plan the work' },
		{ id: 'develop', type: 'agent', agent_id: 'dev', instructions: 'Do the work' },
		{ id: 'finish', type: 'done' },
	],
}

const TEST_COMPANY: CompanyScope = {
	name: 'Test Co',
	slug: 'test-co',
	description: '',
	timezone: 'UTC',
	language: 'en',
	owner: { name: 'Test', email: 'test@test.com' },
	defaults: { runtime: 'claude-code', workflow: 'default', task_assignee: 'ceo' },
}

function makeConfig(overrides?: Partial<AuthoredConfig>): AuthoredConfig {
	return {
		company: overrides?.company ?? TEST_COMPANY,
		agents: overrides?.agents ?? new Map(TEST_AGENTS.map((a) => [a.id, a])),
		workflows: overrides?.workflows ?? new Map([[TEST_WORKFLOW.id, TEST_WORKFLOW]]),
		environments: overrides?.environments ?? new Map(),
		providers: overrides?.providers ?? new Map(),
		defaults: overrides?.defaults ?? { runtime: 'claude-code', workflow: 'default', task_assignee: 'ceo' },
	}
}

/** Create a fresh test environment with all services wired up. */
async function createTestEnv(label: string) {
	const companyRoot = join(tmpdir(), `qp-${label}-${Date.now()}`)
	await mkdir(join(companyRoot, '.autopilot'), { recursive: true })
	await writeFile(
		join(companyRoot, '.autopilot', 'company.yaml'),
		'name: test\nslug: test\nowner:\n  name: Test\n  email: test@test.com\n',
	)
	const dbResult = await createCompanyDb(companyRoot)
	const taskService = new TaskService(dbResult.db)
	const runService = new RunService(dbResult.db)
	const workerService = new WorkerService(dbResult.db)
	const activityService = new ActivityService(dbResult.db)
	const relationService = new TaskRelationService(dbResult.db)
	return { companyRoot, dbResult, taskService, runService, workerService, activityService, relationService }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('TaskRelationService', () => {
	let env: Awaited<ReturnType<typeof createTestEnv>>
	let taskService: TaskService
	let relationService: TaskRelationService

	beforeAll(async () => {
		env = await createTestEnv('rel-test')
		taskService = env.taskService
		relationService = env.relationService
	})

	afterAll(async () => {
		env.dbResult.raw.close()
		await rm(env.companyRoot, { recursive: true, force: true })
	})

	test('creates a relation between two tasks', async () => {
		const parent = await taskService.create({ id: 'rel-parent-1', title: 'Parent', type: 'epic', created_by: 'test' })
		const child = await taskService.create({ id: 'rel-child-1', title: 'Child', type: 'feature', created_by: 'test' })

		const rel = await relationService.create({
			id: 'rel-1',
			source_task_id: parent!.id,
			target_task_id: child!.id,
			relation_type: 'decomposes_to',
			created_by: 'test',
		})

		expect(rel).not.toBeUndefined()
		expect(rel!.source_task_id).toBe('rel-parent-1')
		expect(rel!.target_task_id).toBe('rel-child-1')
		expect(rel!.relation_type).toBe('decomposes_to')
	})

	test('lists relations by source (parent)', async () => {
		const relations = await relationService.listBySource('rel-parent-1', 'decomposes_to')
		expect(relations.length).toBe(1)
		expect(relations[0]!.target_task_id).toBe('rel-child-1')
	})

	test('lists relations by target (child)', async () => {
		const relations = await relationService.listByTarget('rel-child-1', 'decomposes_to')
		expect(relations.length).toBe(1)
		expect(relations[0]!.source_task_id).toBe('rel-parent-1')
	})

	test('exists check works', async () => {
		const yes = await relationService.exists('rel-parent-1', 'rel-child-1', 'decomposes_to')
		expect(yes).toBe(true)

		const no = await relationService.exists('rel-parent-1', 'rel-child-1', 'depends_on')
		expect(no).toBe(false)
	})

	test('duplicate relation is silently deduplicated', async () => {
		const rel = await relationService.create({
			id: 'rel-dup',
			source_task_id: 'rel-parent-1',
			target_task_id: 'rel-child-1',
			relation_type: 'decomposes_to',
			created_by: 'test',
		})

		// Should return existing relation, not create duplicate
		expect(rel).not.toBeUndefined()
		expect(rel!.id).toBe('rel-1') // original id, not 'rel-dup'
	})

	test('findByDedupeKey returns matching relation', async () => {
		await taskService.create({ id: 'rel-dk-child', title: 'Deduped child', type: 'feature', created_by: 'test' })
		await relationService.create({
			id: 'rel-dk-1',
			source_task_id: 'rel-parent-1',
			target_task_id: 'rel-dk-child',
			relation_type: 'decomposes_to',
			dedupe_key: 'my-key',
			created_by: 'test',
		})

		const found = await relationService.findByDedupeKey('rel-parent-1', 'decomposes_to', 'my-key')
		expect(found).not.toBeUndefined()
		expect(found!.target_task_id).toBe('rel-dk-child')

		const notFound = await relationService.findByDedupeKey('rel-parent-1', 'decomposes_to', 'other-key')
		expect(notFound).toBeUndefined()
	})

	test('DB-enforced dedupe_key uniqueness prevents duplicate relations', async () => {
		await taskService.create({ id: 'rel-dk-child-2', title: 'Another deduped child', type: 'feature', created_by: 'test' })
		const rel = await relationService.create({
			id: 'rel-dk-2',
			source_task_id: 'rel-parent-1',
			target_task_id: 'rel-dk-child-2',
			relation_type: 'decomposes_to',
			dedupe_key: 'my-key', // same key as rel-dk-1
			created_by: 'test',
		})

		// Should return the existing relation with dedupe_key='my-key', not create new
		// The uq_task_relation_dedupe index enforces this
		expect(rel).not.toBeUndefined()
		expect(rel!.target_task_id).toBe('rel-dk-child') // original target, not 'rel-dk-child-2'
	})

	test('delete removes a relation', async () => {
		await taskService.create({ id: 'rel-del-child', title: 'To delete', type: 'feature', created_by: 'test' })
		await relationService.create({
			id: 'rel-to-delete',
			source_task_id: 'rel-parent-1',
			target_task_id: 'rel-del-child',
			relation_type: 'decomposes_to',
			created_by: 'test',
		})

		await relationService.delete('rel-to-delete')
		const exists = await relationService.exists('rel-parent-1', 'rel-del-child', 'decomposes_to')
		expect(exists).toBe(false)
	})
})

describe('TaskGraphService', () => {
	let env: Awaited<ReturnType<typeof createTestEnv>>
	let taskService: TaskService
	let runService: RunService
	let relationService: TaskRelationService
	let graphService: TaskGraphService
	let engine: WorkflowEngine

	beforeAll(async () => {
		env = await createTestEnv('graph-test')
		taskService = env.taskService
		runService = env.runService
		relationService = env.relationService
		engine = new WorkflowEngine(makeConfig(), taskService, runService, env.activityService)
		graphService = new TaskGraphService(taskService, relationService, engine)
	})

	afterAll(async () => {
		env.dbResult.raw.close()
		await rm(env.companyRoot, { recursive: true, force: true })
	})

	test('spawnChildren creates child tasks with relations', async () => {
		const parent = await taskService.create({
			id: `parent-${Date.now()}`,
			title: 'Epic: Build feature X',
			type: 'epic',
			created_by: 'test',
		})

		const result = await graphService.spawnChildren({
			parent_task_id: parent!.id,
			children: [
				{ title: 'Sub 1: Design API', type: 'feature', dedupe_key: 'design-api' },
				{ title: 'Sub 2: Implement backend', type: 'feature', dedupe_key: 'impl-backend' },
				{ title: 'Sub 3: Write tests', type: 'feature', dedupe_key: 'write-tests' },
			],
			created_by: 'planner',
		})

		expect(result.parent_task_id).toBe(parent!.id)
		expect(result.children.length).toBe(3)
		expect(result.created_count).toBe(3)
		expect(result.matched_count).toBe(0)

		for (const child of result.children) {
			expect(child.created).toBe(true)
			expect(child.task.type).toBe('feature')
			expect(child.relation.relation_type).toBe('decomposes_to')
			expect(child.relation.source_task_id).toBe(parent!.id)
			expect(child.relation.dedupe_key).not.toBeNull()
		}

		const children = await graphService.listChildren(parent!.id)
		expect(children.length).toBe(3)
	})

	test('spawnChildren produces deterministic task IDs from dedupe_key', async () => {
		const parent = await taskService.create({
			id: `parent-det-${Date.now()}`,
			title: 'Epic: Deterministic IDs',
			type: 'epic',
			created_by: 'test',
		})

		const first = await graphService.spawnChildren({
			parent_task_id: parent!.id,
			children: [{ title: 'Det child', type: 'feature', dedupe_key: 'stable-key' }],
			created_by: 'planner',
		})

		// Task ID should start with 'task-' and be a SHA-256 derivative
		const childId = first.children[0]!.task.id
		expect(childId).toStartWith('task-')
		expect(childId.length).toBe(21) // 'task-' + 16 hex chars
	})

	test('spawnChildren is idempotent with dedupe_key', async () => {
		const parent = await taskService.create({
			id: `parent-idem-${Date.now()}`,
			title: 'Epic: Idempotent test',
			type: 'epic',
			created_by: 'test',
		})

		const firstRun = await graphService.spawnChildren({
			parent_task_id: parent!.id,
			children: [
				{ title: 'Child A', type: 'feature', dedupe_key: 'child-a' },
				{ title: 'Child B', type: 'feature', dedupe_key: 'child-b' },
			],
			created_by: 'planner',
		})

		expect(firstRun.created_count).toBe(2)
		expect(firstRun.matched_count).toBe(0)

		// Second run with same dedupe_keys — should NOT create new tasks
		const secondRun = await graphService.spawnChildren({
			parent_task_id: parent!.id,
			children: [
				{ title: 'Child A (retry)', type: 'feature', dedupe_key: 'child-a' },
				{ title: 'Child B (retry)', type: 'feature', dedupe_key: 'child-b' },
				{ title: 'Child C (new)', type: 'feature', dedupe_key: 'child-c' },
			],
			created_by: 'planner',
		})

		expect(secondRun.created_count).toBe(1) // Only child-c
		expect(secondRun.matched_count).toBe(2) // child-a and child-b matched

		// Matched children have the same task IDs as first run
		const firstIds = new Set(firstRun.children.map((c) => c.task.id))
		for (const child of secondRun.children) {
			if (!child.created) {
				expect(firstIds.has(child.task.id)).toBe(true)
			}
		}

		const children = await graphService.listChildren(parent!.id)
		expect(children.length).toBe(3)
	})

	test('triple rerun is fully idempotent', async () => {
		const parent = await taskService.create({
			id: `parent-triple-${Date.now()}`,
			title: 'Epic: Triple rerun',
			type: 'epic',
			created_by: 'test',
		})

		const candidates = [
			{ title: 'Task X', type: 'feature', dedupe_key: 'x' },
			{ title: 'Task Y', type: 'feature', dedupe_key: 'y' },
		]

		const run1 = await graphService.spawnChildren({ parent_task_id: parent!.id, children: candidates, created_by: 'p' })
		const run2 = await graphService.spawnChildren({ parent_task_id: parent!.id, children: candidates, created_by: 'p' })
		const run3 = await graphService.spawnChildren({ parent_task_id: parent!.id, children: candidates, created_by: 'p' })

		expect(run1.created_count).toBe(2)
		expect(run2.created_count).toBe(0)
		expect(run3.created_count).toBe(0)
		expect(run2.matched_count).toBe(2)
		expect(run3.matched_count).toBe(2)

		const children = await graphService.listChildren(parent!.id)
		expect(children.length).toBe(2)
	})

	test('spawnChildren without dedupe_key creates new tasks each time', async () => {
		const parent = await taskService.create({
			id: `parent-nodup-${Date.now()}`,
			title: 'Epic: No dedupe',
			type: 'epic',
			created_by: 'test',
		})

		const first = await graphService.spawnChildren({
			parent_task_id: parent!.id,
			children: [{ title: 'Loose child', type: 'feature' }],
			created_by: 'planner',
		})

		const second = await graphService.spawnChildren({
			parent_task_id: parent!.id,
			children: [{ title: 'Loose child 2', type: 'feature' }],
			created_by: 'planner',
		})

		expect(first.created_count).toBe(1)
		expect(second.created_count).toBe(1)

		const children = await graphService.listChildren(parent!.id)
		expect(children.length).toBe(2)
	})

	test('spawnChildren fails for non-existent parent', async () => {
		await expect(
			graphService.spawnChildren({
				parent_task_id: 'nonexistent',
				children: [{ title: 'Orphan', type: 'feature' }],
				created_by: 'test',
			}),
		).rejects.toThrow('not found')
	})

	test('listParents returns parent tasks for a child', async () => {
		const parent = await taskService.create({
			id: `parent-lookup-${Date.now()}`,
			title: 'Parent for lookup',
			type: 'epic',
			created_by: 'test',
		})

		const result = await graphService.spawnChildren({
			parent_task_id: parent!.id,
			children: [{ title: 'Child for parent lookup', type: 'feature', dedupe_key: 'parent-lookup-child' }],
			created_by: 'test',
		})

		const childId = result.children[0]!.task.id
		const parents = await graphService.listParents(childId)
		expect(parents.length).toBe(1)
		expect(parents[0]!.id).toBe(parent!.id)
	})

	test('childRollup derives correct status counts', async () => {
		const parent = await taskService.create({
			id: `parent-rollup-${Date.now()}`,
			title: 'Parent for rollup',
			type: 'epic',
			created_by: 'test',
		})

		const result = await graphService.spawnChildren({
			parent_task_id: parent!.id,
			children: [
				{ title: 'Rollup child 1', type: 'feature', dedupe_key: 'r1' },
				{ title: 'Rollup child 2', type: 'feature', dedupe_key: 'r2' },
				{ title: 'Rollup child 3', type: 'feature', dedupe_key: 'r3' },
			],
			created_by: 'test',
		})

		await taskService.update(result.children[0]!.task.id, { status: 'done' })
		await taskService.update(result.children[1]!.task.id, { status: 'blocked' })
		// child 3 stays active (from workflow intake)

		const rollup = await graphService.childRollup(parent!.id)
		expect(rollup.total).toBe(3)
		expect(rollup.done).toBe(1)
		expect(rollup.blocked).toBe(1)
		expect(rollup.active).toBe(1)
	})

	test('childRollup detects failed children', async () => {
		const parent = await taskService.create({
			id: `parent-fail-rollup-${Date.now()}`,
			title: 'Parent with failed child',
			type: 'epic',
			created_by: 'test',
		})

		const result = await graphService.spawnChildren({
			parent_task_id: parent!.id,
			children: [
				{ title: 'Will succeed', type: 'feature', dedupe_key: 'ok' },
				{ title: 'Will fail', type: 'feature', dedupe_key: 'fail' },
			],
			created_by: 'test',
		})

		await taskService.update(result.children[0]!.task.id, { status: 'done' })
		await taskService.update(result.children[1]!.task.id, { status: 'failed' })

		const rollup = await graphService.childRollup(parent!.id)
		expect(rollup.total).toBe(2)
		expect(rollup.done).toBe(1)
		expect(rollup.failed).toBe(1)
	})

	test('child tasks go through normal workflow intake', async () => {
		const parent = await taskService.create({
			id: `parent-wf-${Date.now()}`,
			title: 'Parent with workflow children',
			type: 'epic',
			created_by: 'test',
		})

		const result = await graphService.spawnChildren({
			parent_task_id: parent!.id,
			children: [{ title: 'Child with workflow', type: 'feature', dedupe_key: 'wf-child' }],
			created_by: 'test',
		})

		const child = result.children[0]!.task
		expect(child.assigned_to).toBe('ceo')
		expect(child.workflow_id).toBe('default')
		expect(child.workflow_step).toBe('intake')
		expect(child.status).toBe('active')
	})
})

describe('Run failure → task failure signal', () => {
	let env: Awaited<ReturnType<typeof createTestEnv>>
	let taskService: TaskService
	let runService: RunService
	let engine: WorkflowEngine

	beforeAll(async () => {
		env = await createTestEnv('fail-test')
		taskService = env.taskService
		runService = env.runService
		engine = new WorkflowEngine(makeConfig(), taskService, runService, env.activityService)
	})

	afterAll(async () => {
		env.dbResult.raw.close()
		await rm(env.companyRoot, { recursive: true, force: true })
	})

	test('handleRunFailure marks task as failed', async () => {
		const result = await engine.materializeTask({
			title: 'Task that will fail',
			type: 'feature',
			created_by: 'test',
		})
		expect(result).not.toBeNull()
		expect(result!.task.status).toBe('active')

		const updated = await engine.handleRunFailure(result!.task.id, result!.runId!)
		expect(updated).not.toBeNull()
		expect(updated!.status).toBe('failed')
	})

	test('failed child detected in parent rollup via handleRunFailure', async () => {
		const relationService = env.relationService
		const graphService = new TaskGraphService(taskService, relationService, engine)

		const parent = await taskService.create({
			id: `parent-run-fail-${Date.now()}`,
			title: 'Parent with run-failed child',
			type: 'epic',
			created_by: 'test',
		})

		const spawned = await graphService.spawnChildren({
			parent_task_id: parent!.id,
			children: [
				{ title: 'Good child', type: 'feature', dedupe_key: 'good' },
				{ title: 'Bad child', type: 'feature', dedupe_key: 'bad' },
			],
			created_by: 'test',
		})

		// Simulate run failure for the second child
		const badChild = spawned.children[1]!.task
		const badRuns = await runService.list({ task_id: badChild.id })
		expect(badRuns.length).toBeGreaterThan(0)

		await engine.handleRunFailure(badChild.id, badRuns[0]!.id)

		// Mark good child as done
		await taskService.update(spawned.children[0]!.task.id, { status: 'done' })

		const rollup = await graphService.childRollup(parent!.id)
		expect(rollup.total).toBe(2)
		expect(rollup.done).toBe(1)
		expect(rollup.failed).toBe(1)
	})

	test('handleRunFailure logs activity', async () => {
		const result = await engine.materializeTask({
			title: 'Task for activity log',
			type: 'feature',
			created_by: 'test',
		})

		await engine.handleRunFailure(result!.task.id, result!.runId!)

		const activities = await env.activityService.listForTask(result!.task.id)
		const failEntry = activities.find((a) => a.type === 'run_failed')
		expect(failEntry).not.toBeUndefined()
		expect(failEntry!.summary).toContain('failed')
	})
})

describe('Failure normalization: cancel and lease expiry', () => {
	let env: Awaited<ReturnType<typeof createTestEnv>>
	let taskService: TaskService
	let runService: RunService
	let workerService: WorkerService
	let relationService: TaskRelationService
	let engine: WorkflowEngine
	let graphService: TaskGraphService

	beforeAll(async () => {
		env = await createTestEnv('fail-norm-test')
		taskService = env.taskService
		runService = env.runService
		workerService = env.workerService
		relationService = env.relationService
		engine = new WorkflowEngine(makeConfig(), taskService, runService, env.activityService)
		graphService = new TaskGraphService(taskService, relationService, engine)
	})

	afterAll(async () => {
		env.dbResult.raw.close()
		await rm(env.companyRoot, { recursive: true, force: true })
	})

	test('canceled child run marks child task as failed in parent rollup', async () => {
		const parent = await taskService.create({
			id: `parent-cancel-${Date.now()}`,
			title: 'Parent with canceled child',
			type: 'epic',
			created_by: 'test',
		})

		const spawned = await graphService.spawnChildren({
			parent_task_id: parent!.id,
			children: [
				{ title: 'Good child', type: 'feature', dedupe_key: 'cancel-ok' },
				{ title: 'Canceled child', type: 'feature', dedupe_key: 'cancel-bad' },
			],
			created_by: 'test',
		})

		// Cancel the second child's run (simulating what POST /runs/:id/cancel does)
		const badChild = spawned.children[1]!.task
		const badRuns = await runService.list({ task_id: badChild.id })
		expect(badRuns.length).toBeGreaterThan(0)

		await runService.cancel(badRuns[0]!.id, 'operator canceled')
		// Normalize failure — same as route does
		await engine.handleRunFailure(badChild.id, badRuns[0]!.id)

		await taskService.update(spawned.children[0]!.task.id, { status: 'done' })

		const rollup = await graphService.childRollup(parent!.id)
		expect(rollup.total).toBe(2)
		expect(rollup.done).toBe(1)
		expect(rollup.failed).toBe(1)
	})

	test('lease-expired child run marks child task as failed in parent rollup', async () => {
		const parent = await taskService.create({
			id: `parent-lease-${Date.now()}`,
			title: 'Parent with lease-expired child',
			type: 'epic',
			created_by: 'test',
		})

		const spawned = await graphService.spawnChildren({
			parent_task_id: parent!.id,
			children: [
				{ title: 'Healthy child', type: 'feature', dedupe_key: 'lease-ok' },
				{ title: 'Stale child', type: 'feature', dedupe_key: 'lease-stale' },
			],
			created_by: 'test',
		})

		const staleChild = spawned.children[1]!.task
		const staleRuns = await runService.list({ task_id: staleChild.id })
		expect(staleRuns.length).toBeGreaterThan(0)
		const staleRunId = staleRuns[0]!.id

		// Register a worker and claim the run
		await workerService.register({ id: 'w-lease-test' })
		await runService.claim('w-lease-test', 'claude-code')

		// Create a lease that is already expired
		await workerService.createLease({
			id: `lease-expired-${Date.now()}`,
			worker_id: 'w-lease-test',
			run_id: staleRunId,
			expires_at: new Date(Date.now() - 1000).toISOString(), // already expired
		})

		// Simulate the claim-time recovery: expireStaleAndRecover + handleRunFailure
		await workerService.expireStaleAndRecover(async (runId) => {
			const run = await runService.get(runId)
			await runService.complete(runId, { status: 'failed', error: 'lease expired' })
			if (run?.task_id) {
				await engine.handleRunFailure(run.task_id, runId)
			}
		})

		await taskService.update(spawned.children[0]!.task.id, { status: 'done' })

		const rollup = await graphService.childRollup(parent!.id)
		expect(rollup.total).toBe(2)
		expect(rollup.done).toBe(1)
		expect(rollup.failed).toBe(1)
	})
})

describe('Normal task creation still works', () => {
	let env: Awaited<ReturnType<typeof createTestEnv>>
	let taskService: TaskService
	let runService: RunService
	let engine: WorkflowEngine

	beforeAll(async () => {
		env = await createTestEnv('compat-test')
		taskService = env.taskService
		runService = env.runService
		engine = new WorkflowEngine(makeConfig(), taskService, runService)
	})

	afterAll(async () => {
		env.dbResult.raw.close()
		await rm(env.companyRoot, { recursive: true, force: true })
	})

	test('materializeTask still works normally', async () => {
		const result = await engine.materializeTask({
			title: 'Normal task',
			type: 'feature',
			created_by: 'test',
		})

		expect(result).not.toBeNull()
		expect(result!.task.title).toBe('Normal task')
		expect(result!.task.assigned_to).toBe('ceo')
		expect(result!.task.workflow_id).toBe('default')
		expect(result!.runId).not.toBeNull()
	})

	test('approve/reject/reply still works', async () => {
		const approvalWorkflow: Workflow = {
			id: 'approval-test',
			name: 'Approval Test',
			description: 'Straight to approval',
			steps: [
				{ id: 'approve', type: 'human_approval' },
				{ id: 'finish', type: 'done' },
			],
		}

		const config = makeConfig({
			workflows: new Map([
				['default', TEST_WORKFLOW],
				['approval-test', approvalWorkflow],
			]),
		})
		const localEngine = new WorkflowEngine(config, taskService, runService)

		const task = await taskService.create({
			id: `compat-approval-${Date.now()}`,
			title: 'Approval test',
			type: 'feature',
			workflow_id: 'approval-test',
			workflow_step: 'approve',
			created_by: 'test',
		})

		await localEngine.intake(task!.id)
		const updated = await taskService.get(task!.id)
		expect(updated!.status).toBe('blocked')

		const result = await localEngine.approve(task!.id, 'test-user')
		expect(result).not.toBeNull()
		expect(result!.task.status).toBe('done')
	})
})
