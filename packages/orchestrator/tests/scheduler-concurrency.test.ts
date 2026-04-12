/**
 * Tests for scheduler concurrency policies: skip, allow, queue.
 */
import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createCompanyDb, type CompanyDbResult, type CompanyDb } from '../src/db'
import { ScheduleService, SchedulerDaemon, TaskService, RunService, WorkflowEngine, ActivityService, ArtifactService, QueryService } from '../src/services'
import type { AuthoredConfig } from '../src/services'

const DEFAULT_AUTHORED_CONFIG: AuthoredConfig = {
	company: {
		name: 'test',
		slug: 'test',
		description: '',
		timezone: 'UTC',
		language: 'en',
		owner: { name: 'Test', email: 'test@test.com' },
		defaults: {},
	},
	agents: new Map([
		['default-agent', {
			id: 'default-agent',
			name: 'Default Agent',
			role: 'You are a helpful assistant.',
			capability_profiles: [],
			triggers: [],
			fs_scope: { include: [], exclude: [] },
			secret_refs: [],
		}],
	]),
	workflows: new Map(),
	environments: new Map(),
	providers: new Map(),
	capabilityProfiles: new Map(),
	skills: new Map(),
	context: new Map(),
	defaults: { runtime: 'claude-code', task_assignee: 'default-agent' },
}

let testDir: string
let dbResult: CompanyDbResult
let db: CompanyDb
let scheduleService: ScheduleService
let workflowEngine: WorkflowEngine
let queryService: QueryService
let runService: RunService
let activityService: ActivityService

beforeAll(async () => {
	testDir = join(tmpdir(), `qp-scheduler-concurrency-${Date.now()}`)
	await mkdir(testDir, { recursive: true })

	process.env.AUTOPILOT_MASTER_KEY = '0'.repeat(64)
	dbResult = await createCompanyDb(testDir)
	db = dbResult.db

	const taskService = new TaskService(db)
	runService = new RunService(db)
	activityService = new ActivityService(db)
	const artifactService = new ArtifactService(db)
	queryService = new QueryService(db)
	scheduleService = new ScheduleService(db)

	workflowEngine = new WorkflowEngine(
		DEFAULT_AUTHORED_CONFIG,
		taskService,
		runService,
		activityService,
		artifactService,
	)
})

afterAll(async () => {
	dbResult.raw.close()
	await rm(testDir, { recursive: true, force: true })
	delete process.env.AUTOPILOT_MASTER_KEY
})

describe('skip policy', () => {
	test('skips when active execution exists', async () => {
		const schedule = await scheduleService.create({
			name: 'skip-test',
			cron: '* * * * *',
			agent_id: 'default-agent',
			concurrency_policy: 'skip',
		})
		expect(schedule).toBeDefined()

		const daemon = new SchedulerDaemon(
			scheduleService,
			workflowEngine,
			queryService,
			runService,
			activityService,
			DEFAULT_AUTHORED_CONFIG,
		)

		const now = new Date()

		// First execution — should trigger
		await daemon.execute(schedule!, now)
		const executions1 = await scheduleService.listExecutions(schedule!.id)
		expect(executions1.length).toBe(1)
		expect(executions1[0]!.status).toBe('triggered')

		// Second execution while first is active — should skip
		await daemon.execute(schedule!, now)
		const executions2 = await scheduleService.listExecutions(schedule!.id)
		expect(executions2.length).toBe(2)
		const skipped = executions2.find((e) => e.status === 'skipped')
		expect(skipped).toBeDefined()
	})
})

describe('allow policy', () => {
	test('allows concurrent executions', async () => {
		const schedule = await scheduleService.create({
			name: 'allow-test',
			cron: '* * * * *',
			agent_id: 'default-agent',
			concurrency_policy: 'allow',
		})
		expect(schedule).toBeDefined()

		const daemon = new SchedulerDaemon(
			scheduleService,
			workflowEngine,
			queryService,
			runService,
			activityService,
			DEFAULT_AUTHORED_CONFIG,
		)

		const now = new Date()

		// First execution
		await daemon.execute(schedule!, now)
		// Second execution while first is active — should also trigger
		await daemon.execute(schedule!, now)

		const executions = await scheduleService.listExecutions(schedule!.id)
		expect(executions.length).toBe(2)
		// Both should be triggered (no skipping)
		const triggered = executions.filter((e) => e.status === 'triggered')
		expect(triggered.length).toBe(2)
	})
})

describe('queue policy', () => {
	test('queues when active execution exists', async () => {
		const schedule = await scheduleService.create({
			name: 'queue-test',
			cron: '* * * * *',
			agent_id: 'default-agent',
			concurrency_policy: 'queue',
		})
		expect(schedule).toBeDefined()

		const daemon = new SchedulerDaemon(
			scheduleService,
			workflowEngine,
			queryService,
			runService,
			activityService,
			DEFAULT_AUTHORED_CONFIG,
		)

		const now = new Date()

		// First execution — should trigger
		await daemon.execute(schedule!, now)
		const executions1 = await scheduleService.listExecutions(schedule!.id)
		expect(executions1.length).toBe(1)
		expect(executions1[0]!.status).toBe('triggered')

		// Second execution while first is active — should queue
		await daemon.execute(schedule!, now)
		const executions2 = await scheduleService.listExecutions(schedule!.id)
		expect(executions2.length).toBe(2)
		const queued = executions2.find((e) => e.status === 'queued')
		expect(queued).toBeDefined()
	})

	test('promotes queued execution when active completes', async () => {
		const schedule = await scheduleService.create({
			name: 'queue-drain-test',
			cron: '* * * * *',
			agent_id: 'default-agent',
			concurrency_policy: 'queue',
		})
		expect(schedule).toBeDefined()

		const daemon = new SchedulerDaemon(
			scheduleService,
			workflowEngine,
			queryService,
			runService,
			activityService,
			DEFAULT_AUTHORED_CONFIG,
		)

		const now = new Date()

		// Trigger first execution
		await daemon.execute(schedule!, now)
		const executions1 = await scheduleService.listExecutions(schedule!.id)
		const triggered = executions1.find((e) => e.status === 'triggered')
		expect(triggered).toBeDefined()

		// Queue second execution
		await daemon.execute(schedule!, now)
		const executions2 = await scheduleService.listExecutions(schedule!.id)
		const queued = executions2.find((e) => e.status === 'queued')
		expect(queued).toBeDefined()

		// Complete the task created by the first execution — mark it done
		if (triggered!.task_id) {
			const taskService = new TaskService(db)
			await taskService.update(triggered!.task_id, { status: 'done' })
		}

		// Now findActiveExecution should resolve the terminal status and promote queued
		const active = await scheduleService.findActiveExecution(schedule!.id)
		expect(active).toBeUndefined() // terminal resolved, queued promoted

		// Verify the queued execution was promoted to triggered
		const executions3 = await scheduleService.listExecutions(schedule!.id)
		const promotedExec = executions3.find((e) => e.id === queued!.id)
		expect(promotedExec!.status).toBe('triggered')
	})
})
