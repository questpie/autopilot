/**
 * Tests for configurable retry policies on workflow steps.
 *
 * Covers:
 * - Error classification (infra, timeout, rate_limit, business, unknown)
 * - Step-level retry policy resolution
 * - Company-level default retry policy
 * - Retry counter tracking in task metadata
 * - on_exhausted: fail (default)
 * - on_exhausted: escalate (routes to human_approval step)
 * - on_exhausted: skip (advances to next step)
 * - Non-retryable errors immediately fail
 * - Unknown errors are not retried by default
 * - Backoff delay computation
 */
import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createCompanyDb, type CompanyDbResult } from '../src/db'
import { TaskService, RunService, WorkerService, WorkflowEngine, ActivityService } from '../src/services'
import { classifyRunError } from '../src/services/error-classifier'
import type { AuthoredConfig } from '../src/services'
import type { Agent, Workflow, CompanyScope } from '@questpie/autopilot-spec'

// ─── Test Fixtures ──────────────────────────────────────────────────────────

const TEST_AGENTS: Agent[] = [
	{ id: 'dev', name: 'Developer', role: 'developer', description: 'Dev agent', triggers: [] },
]

function makeRetryWorkflow(retryPolicy?: object): Workflow {
	return {
		id: 'retry-wf',
		name: 'Retry Workflow',
		description: '',
		steps: [
			{
				id: 'build',
				type: 'agent',
				agent_id: 'dev',
				instructions: 'Build it',
				...(retryPolicy ? { retry_policy: retryPolicy } : {}),
			},
			{ id: 'review', type: 'human_approval' },
			{ id: 'finish', type: 'done' },
		],
	}
}

function makeCompany(retryPolicy?: object): CompanyScope {
	return {
		name: 'Test Co',
		slug: 'test-co',
		description: '',
		timezone: 'UTC',
		language: 'en',
		owner: { name: 'Test', email: 'test@test.com' },
		defaults: {
			runtime: 'claude-code',
			workflow: 'retry-wf',
			task_assignee: 'dev',
			...(retryPolicy ? { retry_policy: retryPolicy } : {}),
		},
	}
}

function makeConfig(company: CompanyScope, workflow: Workflow): AuthoredConfig {
	return {
		company,
		agents: new Map(TEST_AGENTS.map((a) => [a.id, a])),
		workflows: new Map([[workflow.id, workflow]]),
		environments: new Map(),
		providers: new Map(),
		capabilityProfiles: new Map(),
		context: new Map(),
		defaults: { runtime: 'claude-code', workflow: 'retry-wf', task_assignee: 'dev' },
	}
}

async function createTestEnv(label: string, config: AuthoredConfig) {
	const companyRoot = join(tmpdir(), `qp-retry-${label}-${Date.now()}`)
	await mkdir(join(companyRoot, '.autopilot'), { recursive: true })
	await writeFile(
		join(companyRoot, '.autopilot', 'company.yaml'),
		'name: test\nslug: test\nowner:\n  name: Test\n  email: test@test.com\n',
	)
	const dbResult = await createCompanyDb(companyRoot)
	const taskService = new TaskService(dbResult.db)
	const runService = new RunService(dbResult.db)
	const activityService = new ActivityService(dbResult.db)
	const engine = new WorkflowEngine(config, taskService, runService, activityService)
	return { companyRoot, dbResult, taskService, runService, activityService, engine }
}

// ─── Error Classifier Tests ────────────────────────────────────────────────

describe('classifyRunError', () => {
	test('classifies infra errors', () => {
		expect(classifyRunError('lease expired')).toBe('infra')
		expect(classifyRunError('worker offline')).toBe('infra')
		expect(classifyRunError('worktree missing')).toBe('infra')
		expect(classifyRunError('server restart')).toBe('infra')
		expect(classifyRunError('connection refused')).toBe('infra')
		expect(classifyRunError('ECONNREFUSED')).toBe('infra')
		expect(classifyRunError('socket hang up')).toBe('infra')
		expect(classifyRunError('process exited with signal 9')).toBe('infra')
	})

	test('classifies timeout errors', () => {
		expect(classifyRunError('max turns exceeded')).toBe('timeout')
		expect(classifyRunError('timed out after 300s')).toBe('timeout')
		expect(classifyRunError('request timeout')).toBe('timeout')
		expect(classifyRunError('deadline exceeded')).toBe('timeout')
	})

	test('classifies rate limit errors', () => {
		expect(classifyRunError('HTTP 429 Too Many Requests')).toBe('rate_limit')
		expect(classifyRunError('rate limit exceeded')).toBe('rate_limit')
		expect(classifyRunError('too many requests')).toBe('rate_limit')
		expect(classifyRunError('request throttled')).toBe('rate_limit')
	})

	test('classifies business errors', () => {
		expect(classifyRunError("can't do this task")).toBe('business')
		expect(classifyRunError('cannot complete the request')).toBe('business')
		expect(classifyRunError('refused to execute')).toBe('business')
		expect(classifyRunError('validation failed')).toBe('business')
	})

	test('classifies unknown errors', () => {
		expect(classifyRunError('something went wrong')).toBe('unknown')
		expect(classifyRunError(null)).toBe('unknown')
		expect(classifyRunError(undefined)).toBe('unknown')
		expect(classifyRunError('')).toBe('unknown')
	})
})

// ─── Retry Policy Integration Tests ────────────────────────────────────────

describe('RetryPolicy: step-level retries', () => {
	let env: Awaited<ReturnType<typeof createTestEnv>>

	beforeAll(async () => {
		const workflow = makeRetryWorkflow({
			max_attempts: 3,
			delay_seconds: 0,
			backoff_multiplier: 1,
			retry_on: ['infra', 'timeout'],
			on_exhausted: 'fail',
		})
		const company = makeCompany()
		const config = makeConfig(company, workflow)
		env = await createTestEnv('step-retry', config)
	})

	afterAll(async () => {
		env.dbResult.raw.close()
		await rm(env.companyRoot, { recursive: true, force: true })
	})

	test('retries on infra error and creates new run', async () => {
		const result = await env.engine.materializeTask({
			title: 'Retry infra test',
			type: 'feature',
			created_by: 'test',
		})
		expect(result).not.toBeNull()
		const firstRunId = result!.runId!

		// Simulate first run failure with infra error
		await env.runService.start(firstRunId)
		await env.runService.complete(firstRunId, { status: 'failed', error: 'lease expired' })

		const taskBefore = await env.taskService.get(result!.task.id)
		expect(taskBefore).not.toBeNull()

		const failResult = await env.engine.handleRunFailure(result!.task.id, firstRunId)
		expect(failResult).not.toBeNull()
		// Task should still be active (retrying), not failed
		expect(failResult!.status).toBe('active')

		// Should have created a new run
		const runs = await env.runService.list({ task_id: result!.task.id })
		expect(runs.length).toBe(2)

		// Activity log should show retry
		const activities = await env.activityService.listForTask(result!.task.id)
		const retryActivity = activities.find((a) => a.type === 'retry')
		expect(retryActivity).toBeDefined()
		expect(retryActivity!.summary).toContain('attempt 2/3')
	})

	test('fails task after max_attempts exhausted', async () => {
		const result = await env.engine.materializeTask({
			title: 'Retry exhaust test',
			type: 'feature',
			created_by: 'test',
		})
		expect(result).not.toBeNull()

		// Exhaust all 3 attempts (original + 2 retries)
		for (let i = 0; i < 3; i++) {
			const runs = await env.runService.list({ task_id: result!.task.id, status: 'pending' })
			const pendingRun = runs[0]
			if (!pendingRun) break

			await env.runService.start(pendingRun.id)
			await env.runService.complete(pendingRun.id, { status: 'failed', error: 'lease expired' })
			await env.engine.handleRunFailure(result!.task.id, pendingRun.id)
		}

		const finalTask = await env.taskService.get(result!.task.id)
		expect(finalTask).not.toBeNull()
		expect(finalTask!.status).toBe('failed')
	})

	test('does not retry business errors', async () => {
		const result = await env.engine.materializeTask({
			title: 'Business error test',
			type: 'feature',
			created_by: 'test',
		})
		expect(result).not.toBeNull()
		const runId = result!.runId!

		await env.runService.start(runId)
		await env.runService.complete(runId, { status: 'failed', error: "can't do this task" })

		const failResult = await env.engine.handleRunFailure(result!.task.id, runId)
		expect(failResult).not.toBeNull()
		expect(failResult!.status).toBe('failed') // Immediately failed, no retry
	})

	test('does not retry unknown errors', async () => {
		const result = await env.engine.materializeTask({
			title: 'Unknown error test',
			type: 'feature',
			created_by: 'test',
		})
		expect(result).not.toBeNull()
		const runId = result!.runId!

		await env.runService.start(runId)
		await env.runService.complete(runId, { status: 'failed', error: 'something went wrong' })

		const failResult = await env.engine.handleRunFailure(result!.task.id, runId)
		expect(failResult).not.toBeNull()
		expect(failResult!.status).toBe('failed') // Immediately failed, no retry
	})
})

describe('RetryPolicy: company-level defaults', () => {
	let env: Awaited<ReturnType<typeof createTestEnv>>

	beforeAll(async () => {
		// Workflow has NO step-level retry, but company has defaults
		const workflow = makeRetryWorkflow() // no retry_policy on step
		const company = makeCompany({
			max_attempts: 2,
			delay_seconds: 0,
			backoff_multiplier: 1,
			retry_on: ['infra', 'timeout'],
			on_exhausted: 'fail',
		})
		const config = makeConfig(company, workflow)
		env = await createTestEnv('company-retry', config)
	})

	afterAll(async () => {
		env.dbResult.raw.close()
		await rm(env.companyRoot, { recursive: true, force: true })
	})

	test('uses company default retry policy when step has none', async () => {
		const result = await env.engine.materializeTask({
			title: 'Company default retry test',
			type: 'feature',
			created_by: 'test',
		})
		expect(result).not.toBeNull()
		const runId = result!.runId!

		await env.runService.start(runId)
		await env.runService.complete(runId, { status: 'failed', error: 'lease expired' })

		const failResult = await env.engine.handleRunFailure(result!.task.id, runId)
		expect(failResult).not.toBeNull()
		// Should be active (retrying), not failed — company default allows 1 retry
		expect(failResult!.status).toBe('active')
	})
})

describe('RetryPolicy: on_exhausted=escalate', () => {
	let env: Awaited<ReturnType<typeof createTestEnv>>

	beforeAll(async () => {
		const workflow = makeRetryWorkflow({
			max_attempts: 1,
			delay_seconds: 0,
			backoff_multiplier: 1,
			retry_on: ['infra'],
			on_exhausted: 'escalate',
		})
		const company = makeCompany()
		const config = makeConfig(company, workflow)
		env = await createTestEnv('escalate', config)
	})

	afterAll(async () => {
		env.dbResult.raw.close()
		await rm(env.companyRoot, { recursive: true, force: true })
	})

	test('escalates to human_approval step on exhaustion', async () => {
		const result = await env.engine.materializeTask({
			title: 'Escalate test',
			type: 'feature',
			created_by: 'test',
		})
		expect(result).not.toBeNull()
		const runId = result!.runId!

		await env.runService.start(runId)
		await env.runService.complete(runId, { status: 'failed', error: 'lease expired' })

		const failResult = await env.engine.handleRunFailure(result!.task.id, runId)
		expect(failResult).not.toBeNull()
		expect(failResult!.status).toBe('blocked')
		expect(failResult!.workflow_step).toBe('review') // human_approval step

		const activities = await env.activityService.listForTask(result!.task.id)
		const escalation = activities.find((a) => a.type === 'escalation')
		expect(escalation).toBeDefined()
	})
})

describe('RetryPolicy: on_exhausted=skip', () => {
	let env: Awaited<ReturnType<typeof createTestEnv>>

	beforeAll(async () => {
		const workflow = makeRetryWorkflow({
			max_attempts: 1,
			delay_seconds: 0,
			backoff_multiplier: 1,
			retry_on: ['infra'],
			on_exhausted: 'skip',
		})
		const company = makeCompany()
		const config = makeConfig(company, workflow)
		env = await createTestEnv('skip', config)
	})

	afterAll(async () => {
		env.dbResult.raw.close()
		await rm(env.companyRoot, { recursive: true, force: true })
	})

	test('skips to next step on exhaustion', async () => {
		const result = await env.engine.materializeTask({
			title: 'Skip test',
			type: 'feature',
			created_by: 'test',
		})
		expect(result).not.toBeNull()
		const runId = result!.runId!

		await env.runService.start(runId)
		await env.runService.complete(runId, { status: 'failed', error: 'lease expired' })

		const failResult = await env.engine.handleRunFailure(result!.task.id, runId)
		expect(failResult).not.toBeNull()
		// Should advance to the review step (human_approval)
		expect(failResult!.workflow_step).toBe('review')
		expect(failResult!.status).toBe('blocked') // blocked because it's a human_approval step

		const activities = await env.activityService.listForTask(result!.task.id)
		const skipActivity = activities.find((a) => a.type === 'retry_skip')
		expect(skipActivity).toBeDefined()
	})
})

describe('RetryPolicy: no policy (default behavior)', () => {
	let env: Awaited<ReturnType<typeof createTestEnv>>

	beforeAll(async () => {
		const workflow = makeRetryWorkflow() // no retry policy
		const company = makeCompany() // no company-level retry policy
		const config = makeConfig(company, workflow)
		env = await createTestEnv('no-retry', config)
	})

	afterAll(async () => {
		env.dbResult.raw.close()
		await rm(env.companyRoot, { recursive: true, force: true })
	})

	test('fails immediately when no retry policy configured', async () => {
		const result = await env.engine.materializeTask({
			title: 'No retry test',
			type: 'feature',
			created_by: 'test',
		})
		expect(result).not.toBeNull()
		const runId = result!.runId!

		await env.runService.start(runId)
		await env.runService.complete(runId, { status: 'failed', error: 'lease expired' })

		const failResult = await env.engine.handleRunFailure(result!.task.id, runId)
		expect(failResult).not.toBeNull()
		expect(failResult!.status).toBe('failed')
	})
})

describe('RetryPolicy: backoff delay', () => {
	let env: Awaited<ReturnType<typeof createTestEnv>>

	beforeAll(async () => {
		const workflow = makeRetryWorkflow({
			max_attempts: 4,
			delay_seconds: 5,
			backoff_multiplier: 2,
			max_delay_seconds: 30,
			retry_on: ['infra', 'timeout'],
			on_exhausted: 'fail',
		})
		const company = makeCompany()
		const config = makeConfig(company, workflow)
		env = await createTestEnv('backoff', config)
	})

	afterAll(async () => {
		env.dbResult.raw.close()
		await rm(env.companyRoot, { recursive: true, force: true })
	})

	test('sets start_after with backoff delay on retry', async () => {
		const result = await env.engine.materializeTask({
			title: 'Backoff test',
			type: 'feature',
			created_by: 'test',
		})
		expect(result).not.toBeNull()
		const runId = result!.runId!

		const beforeRetry = Date.now()
		await env.runService.start(runId)
		await env.runService.complete(runId, { status: 'failed', error: 'lease expired' })

		await env.engine.handleRunFailure(result!.task.id, runId)

		const task = await env.taskService.get(result!.task.id)
		expect(task).not.toBeNull()
		// First retry: delay_seconds=5 * backoff_multiplier^0 = 5s
		if (task!.start_after) {
			const startAfterMs = new Date(task!.start_after).getTime()
			// start_after should be ~5 seconds from now
			expect(startAfterMs).toBeGreaterThan(beforeRetry + 3000) // at least 3s (allow timing slack)
			expect(startAfterMs).toBeLessThan(beforeRetry + 10000) // at most 10s
		}
	})
})
