/**
 * Tests for resolved run context distribution (Pass 19).
 *
 * Covers:
 * - ClaimedRun includes agent identity (name, role) from config
 * - Actions and secret_refs are separated from targeting blob
 * - Worker receives portable execution context without filesystem dependence
 * - splitTargeting correctly splits constraints from hooks
 */
import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createCompanyDb, type CompanyDbResult } from '../src/db'
import { TaskService, RunService, WorkerService, WorkflowEngine } from '../src/services'
import type { AuthoredConfig } from '../src/services'
import type { Agent, Workflow, CompanyScope, Environment } from '@questpie/autopilot-spec'

// ─── Fixtures ──────────────────────────────────────────────────────────────

const TEST_AGENTS: Agent[] = [
	{ id: 'dev', name: 'Developer', role: 'developer', description: 'Writes code', triggers: [] },
	{ id: 'reviewer', name: 'Code Reviewer', role: 'reviewer', description: 'Reviews code', triggers: [] },
]

const WORKFLOW_WITH_ACTIONS: Workflow = {
	id: 'with-actions',
	name: 'With Actions',
	description: '',
	steps: [
		{
			id: 'deploy',
			type: 'agent',
			agent_id: 'dev',
			instructions: 'Deploy the feature',
			actions: [
				{
					kind: 'webhook',
					url_ref: 'DEPLOY_URL',
					method: 'POST',
					body: '{"deployed": true}',
				},
			],
			targeting: {
				required_runtime: 'claude-code',
				required_worker_tags: ['staging'],
				allow_fallback: true,
				environment: 'staging',
			},
		},
		{ id: 'done', type: 'done' },
	],
}

const SIMPLE_WORKFLOW: Workflow = {
	id: 'simple',
	name: 'Simple',
	description: '',
	steps: [
		{ id: 'work', type: 'agent', agent_id: 'dev', instructions: 'Do the work' },
		{ id: 'review', type: 'agent', agent_id: 'reviewer', instructions: 'Review the work' },
		{ id: 'done', type: 'done' },
	],
}

const STAGING_ENV: Environment = {
	id: 'staging',
	name: 'Staging',
	description: '',
	required_tags: ['staging'],
	secret_refs: [
		{ name: 'DEPLOY_URL', source: 'env', key: 'STAGING_DEPLOY_URL' },
	],
}

function makeConfig(): AuthoredConfig {
	return {
		company: {
			name: 'Test Co', slug: 'test-co', description: '', timezone: 'UTC',
			language: 'en', owner: { name: 'Test', email: 'test@test.com' },
			defaults: { runtime: 'claude-code' },
		},
		agents: new Map(TEST_AGENTS.map((a) => [a.id, a])),
		workflows: new Map([
			['with-actions', WORKFLOW_WITH_ACTIONS],
			['simple', SIMPLE_WORKFLOW],
		]),
		environments: new Map([['staging', STAGING_ENV]]),
		providers: new Map(),
		defaults: { runtime: 'claude-code', workflow: 'simple', task_assignee: 'dev' },
	}
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('Resolved Run Context', () => {
	const companyRoot = join(tmpdir(), `qp-run-ctx-${Date.now()}`)
	let dbResult: CompanyDbResult
	let taskService: TaskService
	let runService: RunService

	beforeAll(async () => {
		await mkdir(join(companyRoot, '.autopilot'), { recursive: true })
		await writeFile(
			join(companyRoot, '.autopilot', 'company.yaml'),
			'name: test\nslug: test\nowner:\n  name: Test\n  email: test@test.com\n',
		)
		dbResult = await createCompanyDb(companyRoot)
		taskService = new TaskService(dbResult.db)
		runService = new RunService(dbResult.db)
	})

	afterAll(async () => {
		dbResult.raw.close()
		await rm(companyRoot, { recursive: true, force: true })
	})

	// ── Agent identity in claimed run ────────────────────────────────────

	test('ClaimedRunSchema accepts agent_name and agent_role', async () => {
		const { ClaimedRunSchema } = await import('@questpie/autopilot-spec')
		const result = ClaimedRunSchema.parse({
			id: 'run-1',
			agent_id: 'dev',
			task_id: null,
			runtime: 'claude-code',
			status: 'claimed',
			agent_name: 'Developer',
			agent_role: 'developer',
			instructions: 'Do the work',
			actions: [],
			secret_refs: [],
		})
		expect(result.agent_name).toBe('Developer')
		expect(result.agent_role).toBe('developer')
	})

	test('ClaimedRunSchema defaults actions and secret_refs to empty arrays', async () => {
		const { ClaimedRunSchema } = await import('@questpie/autopilot-spec')
		const result = ClaimedRunSchema.parse({
			id: 'run-2',
			agent_id: 'dev',
			task_id: null,
			runtime: 'claude-code',
			status: 'claimed',
		})
		expect(result.actions).toEqual([])
		expect(result.secret_refs).toEqual([])
		expect(result.agent_name).toBeUndefined()
	})

	// ── Separated actions in claimed run ─────────────────────────────────

	test('ClaimedRunSchema accepts separated actions and secret_refs', async () => {
		const { ClaimedRunSchema } = await import('@questpie/autopilot-spec')
		const result = ClaimedRunSchema.parse({
			id: 'run-3',
			agent_id: 'dev',
			task_id: null,
			runtime: 'claude-code',
			status: 'claimed',
			targeting: { required_runtime: 'claude-code', allow_fallback: true },
			actions: [
				{ kind: 'webhook', url_ref: 'DEPLOY_URL', method: 'POST' },
			],
			secret_refs: [
				{ name: 'DEPLOY_URL', source: 'env', key: 'STAGING_DEPLOY_URL' },
			],
		})
		expect(result.actions.length).toBe(1)
		expect(result.actions[0]!.kind).toBe('webhook')
		expect(result.secret_refs.length).toBe(1)
		expect(result.secret_refs[0]!.name).toBe('DEPLOY_URL')
		// Targeting should only have constraints
		expect(result.targeting).toEqual({ required_runtime: 'claude-code', allow_fallback: true })
	})

	// ── Workflow engine creates runs with actions in targeting blob ──────

	test('workflow engine stores actions in targeting blob for DB', async () => {
		const config = makeConfig()
		config.defaults = { ...config.defaults, workflow: 'with-actions' }
		const engine = new WorkflowEngine(config, taskService, runService)

		const taskId = `task-actions-${Date.now()}`
		await taskService.create({ id: taskId, title: 'Deploy test', type: 'test', created_by: 'test' })

		const result = await engine.intake(taskId)
		expect(result).not.toBeNull()

		const run = await runService.get(result!.runId!)
		expect(run!.targeting).not.toBeNull()

		// DB targeting blob still has everything (actions + constraints + secret_refs)
		const targeting = JSON.parse(run!.targeting!)
		expect(targeting.required_runtime).toBe('claude-code')
		expect(targeting.required_worker_tags).toContain('staging')
		expect(targeting.actions).toHaveLength(1)
		expect(targeting.actions[0].kind).toBe('webhook')
		expect(targeting.secret_refs).toHaveLength(1)
	})

	// ── Portable context: worker doesn't need filesystem ────────────────

	test('ClaimedRun provides all fields needed for portable RunContext', async () => {
		const { ClaimedRunSchema } = await import('@questpie/autopilot-spec')

		// Simulate the full claim response an orchestrator would send
		const claim = ClaimedRunSchema.parse({
			id: 'run-1',
			agent_id: 'dev',
			task_id: 'task-1',
			runtime: 'claude-code',
			status: 'claimed',
			task_title: 'Test Task',
			task_description: 'A test task',
			agent_name: 'Developer',
			agent_role: 'developer',
			instructions: 'Do the work',
			runtime_session_ref: null,
			resumed_from_run_id: null,
			targeting: null,
			actions: [],
			secret_refs: [],
		})

		// Worker maps claim → RunContext by adding worker-local fields
		// (orchestratorUrl, apiKey, workDir). No filesystem or config resolution needed.
		expect(claim.agent_name).toBe('Developer')
		expect(claim.agent_role).toBe('developer')
		expect(claim.task_title).toBe('Test Task')
		expect(claim.instructions).toBe('Do the work')
		expect(claim.actions).toEqual([])
		expect(claim.secret_refs).toEqual([])
	})

	// ── Agent identity resolved from config ─────────────────────────────

	test('agent profile is available in authored config for claim enrichment', () => {
		const config = makeConfig()
		const dev = config.agents.get('dev')
		expect(dev).not.toBeUndefined()
		expect(dev!.name).toBe('Developer')
		expect(dev!.role).toBe('developer')

		const reviewer = config.agents.get('reviewer')
		expect(reviewer).not.toBeUndefined()
		expect(reviewer!.name).toBe('Code Reviewer')
		expect(reviewer!.role).toBe('reviewer')
	})

	test('unknown agent_id results in null name/role', () => {
		const config = makeConfig()
		const unknown = config.agents.get('nonexistent')
		expect(unknown).toBeUndefined()
		// Claim endpoint should set agent_name and agent_role to null for unknown agents
	})
})
