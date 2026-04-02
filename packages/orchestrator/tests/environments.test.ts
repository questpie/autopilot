/**
 * Tests for environments, explicit worker tags, and external action targeting.
 *
 * Covers:
 * - Explicit worker tags in capability flow through to claim filtering
 * - Environment required_tags merge into execution targeting
 * - Environment secret_refs are serialized into targeting JSON (refs only, no values)
 * - Missing environment produces validation warning
 * - Step-level actions are serialized into targeting JSON
 * - WorkflowEngine validates environment references
 */
import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createCompanyDb, type CompanyDbResult } from '../src/db'
import { TaskService, RunService, WorkflowEngine } from '../src/services'
import type { AuthoredConfig } from '../src/services'
import type { Agent, Workflow, Company, Environment } from '@questpie/autopilot-spec'

// ─── Fixtures ──────────────────────────────────────────────────────────────

const AGENTS: Agent[] = [
	{ id: 'dev', name: 'Dev', role: 'developer', description: '', triggers: [] },
]

const STAGING_ENV: Environment = {
	id: 'staging',
	name: 'Staging',
	description: 'Staging environment',
	required_tags: ['staging', 'aws'],
	secret_refs: [
		{ name: 'deploy-url', source: 'env', key: 'STAGING_DEPLOY_URL' },
		{ name: 'deploy-token', source: 'env', key: 'STAGING_TOKEN' },
	],
}

const WORKFLOW_WITH_ENV: Workflow = {
	id: 'deploy-flow',
	name: 'Deploy Flow',
	description: '',
	steps: [
		{
			id: 'deploy',
			type: 'agent',
			agent_id: 'dev',
			instructions: 'Deploy to staging',
			targeting: { environment: 'staging', required_worker_tags: [] },
			actions: [
				{
					kind: 'webhook',
					url_ref: 'deploy-url',
					method: 'POST',
					body: '{"status":"deployed"}',
					idempotency_key: 'deploy-{{task_id}}',
				},
			],
		},
		{ id: 'finish', type: 'done', actions: [] },
	],
}

const WORKFLOW_NO_ENV: Workflow = {
	id: 'simple',
	name: 'Simple',
	description: '',
	steps: [
		{ id: 'work', type: 'agent', agent_id: 'dev', instructions: 'Do work', actions: [] },
		{ id: 'finish', type: 'done', actions: [] },
	],
}

const COMPANY: Company = {
	name: 'Test', slug: 'test', description: '', timezone: 'UTC', language: 'en',
	owner: { name: 'Test', email: 'test@test.com' },
	settings: {
		auto_assign: true, require_approval: [], max_concurrent_agents: 4,
		budget: { daily_token_limit: 0, alert_at: 0 }, auth: {},
		inference: { gateway_base_url: '', text_model: '', embedding_model: '', embedding_dimensions: 768 },
		default_task_assignee: 'dev', default_workflow: 'deploy-flow', default_runtime: 'claude-code',
	},
	setup_completed: false,
}

function makeConfig(overrides?: { defaultWorkflow?: string; environments?: Map<string, Environment> }): AuthoredConfig {
	return {
		company: {
			...COMPANY,
			settings: { ...COMPANY.settings, default_workflow: overrides?.defaultWorkflow ?? 'deploy-flow' },
		},
		agents: new Map(AGENTS.map((a) => [a.id, a])),
		workflows: new Map([
			['deploy-flow', WORKFLOW_WITH_ENV],
			['simple', WORKFLOW_NO_ENV],
		]),
		environments: overrides?.environments ?? new Map([['staging', STAGING_ENV]]),
	}
}

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

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('Environments & External Actions', () => {
	const companyRoot = join(tmpdir(), `qp-envs-${Date.now()}`)
	let dbResult: CompanyDbResult
	let taskService: TaskService
	let runService: RunService

	beforeAll(async () => {
		await mkdir(companyRoot, { recursive: true })
		await writeFile(join(companyRoot, 'company.yaml'), 'name: test\nowner:\n  name: Test\n  email: test@test.com\n')
		dbResult = await createCompanyDb(companyRoot)
		for (const sql of DDL) await dbResult.raw.execute(sql)
		taskService = new TaskService(dbResult.db)
		runService = new RunService(dbResult.db)
	})

	afterAll(async () => {
		dbResult.raw.close()
		await rm(companyRoot, { recursive: true, force: true })
	})

	test('explicit worker tags make workers eligible for tag-constrained runs', async () => {
		const runId = `run-tags-${Date.now()}`
		await runService.create({
			id: runId,
			agent_id: 'dev',
			runtime: 'claude-code',
			initiated_by: 'test',
			targeting: JSON.stringify({
				required_worker_tags: ['staging', 'aws'],
				allow_fallback: false,
			}),
		})

		// Worker WITHOUT explicit tags — only has derived runtime/model tags
		const noTagCaps = [{ runtime: 'claude-code', models: [], maxConcurrent: 1, tags: [] }]
		const noClaim = await runService.claim('worker-plain', undefined, noTagCaps)
		expect(noClaim).toBeUndefined()

		// Worker WITH explicit staging+aws tags
		const tagCaps = [{ runtime: 'claude-code', models: [], maxConcurrent: 1, tags: ['staging', 'aws', 'local'] }]
		const claimed = await runService.claim('worker-staging', undefined, tagCaps)
		expect(claimed).not.toBeUndefined()
		expect(claimed!.id).toBe(runId)
	})

	test('environment tags merge into run targeting', async () => {
		const engine = new WorkflowEngine(makeConfig(), taskService, runService)

		const taskId = `task-env-${Date.now()}`
		await taskService.create({ id: taskId, title: 'Deploy', type: 'feature', created_by: 'test' })

		const result = await engine.intake(taskId)
		expect(result).not.toBeNull()
		expect(result!.runId).not.toBeNull()

		const run = await runService.get(result!.runId!)
		expect(run!.targeting).not.toBeNull()

		const targeting = JSON.parse(run!.targeting!)
		expect(targeting.required_worker_tags).toContain('staging')
		expect(targeting.required_worker_tags).toContain('aws')
	})

	test('environment secret_refs are serialized into targeting (refs only, no values)', async () => {
		const engine = new WorkflowEngine(makeConfig(), taskService, runService)

		const taskId = `task-secrets-${Date.now()}`
		await taskService.create({ id: taskId, title: 'Secrets', type: 'feature', created_by: 'test' })

		const result = await engine.intake(taskId)
		const run = await runService.get(result!.runId!)
		const targeting = JSON.parse(run!.targeting!)

		expect(targeting.secret_refs).toBeDefined()
		expect(targeting.secret_refs.length).toBe(2)
		expect(targeting.secret_refs[0].name).toBe('deploy-url')
		expect(targeting.secret_refs[0].source).toBe('env')
		// No actual secret values — only refs
		expect(targeting.secret_refs[0].value).toBeUndefined()
	})

	test('step-level actions are serialized into targeting', async () => {
		const engine = new WorkflowEngine(makeConfig(), taskService, runService)

		const taskId = `task-actions-${Date.now()}`
		await taskService.create({ id: taskId, title: 'Actions', type: 'feature', created_by: 'test' })

		const result = await engine.intake(taskId)
		const run = await runService.get(result!.runId!)
		const targeting = JSON.parse(run!.targeting!)

		expect(targeting.actions).toBeDefined()
		expect(targeting.actions.length).toBe(1)
		expect(targeting.actions[0].kind).toBe('webhook')
		expect(targeting.actions[0].url_ref).toBe('deploy-url')
		expect(targeting.actions[0].idempotency_key).toBe('deploy-{{task_id}}')
	})

	test('missing environment produces validation warning', () => {
		const config = makeConfig({ environments: new Map() })
		const engine = new WorkflowEngine(config, taskService, runService)
		const issues = engine.validate()
		const envIssue = issues.find((i) => i.includes('environment') && i.includes('staging'))
		expect(envIssue).toBeDefined()
	})

	test('step without environment has no targeting when no other constraints', async () => {
		const engine = new WorkflowEngine(makeConfig({ defaultWorkflow: 'simple' }), taskService, runService)

		const taskId = `task-noenv-${Date.now()}`
		await taskService.create({ id: taskId, title: 'Simple', type: 'feature', created_by: 'test' })

		const result = await engine.intake(taskId)
		const run = await runService.get(result!.runId!)
		expect(run!.targeting).toBeNull()
	})
})
