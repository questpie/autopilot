/**
 * Tests for the query / personal assistant plane (Pass 24.8).
 *
 * Covers:
 * - Query schema parsing (request + result)
 * - No hidden task creation
 * - Read-only query path
 * - Mutation-allowed query path
 * - Query result contract
 * - API route surface (POST + GET)
 * - Query completion on run completion
 * - Existing task/workflow paths do not regress
 */
import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Hono } from 'hono'
import {
	QueryRequestSchema,
	QueryResultSchema,
	QueryRowSchema,
	RunCompletionSchema,
} from '@questpie/autopilot-spec'
import { buildQueryInstructions } from '../src/services/queries'
import { createCompanyDb, type CompanyDbResult, companySchema, type CompanyDb } from '../src/db'
import {
	TaskService,
	RunService,
	WorkerService,
	EnrollmentService,
	WorkflowEngine,
	ActivityService,
	ArtifactService,
	ConversationBindingService,
	TaskRelationService,
	TaskGraphService,
	SecretService,
	QueryService,
	SessionMessageService,
} from '../src/services'
import type { AppEnv, Services } from '../src/api/app'
import type { Actor } from '../src/auth/types'
import type { AuthoredConfig } from '../src/services'
import { queries as queriesRoute } from '../src/api/routes/queries'
import { runs as runsRoute } from '../src/api/routes/runs'
import { workers as workersRoute } from '../src/api/routes/workers'
import { tasks as tasksRoute } from '../src/api/routes/tasks'

// ─── Helpers ───────────────────────────────────────────────────────────────

const FAKE_ACTOR: Actor = {
	id: 'test-user',
	type: 'human',
	name: 'Test User',
	role: 'owner',
	source: 'api',
}

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

function buildTestApp(companyRoot: string, db: CompanyDb, services: Services) {
	const app = new Hono<AppEnv>()

	app.use('*', async (c, next) => {
		c.set('companyRoot', companyRoot)
		c.set('db', db)
		c.set('auth', {} as never)
		c.set('services', services)
		c.set('authoredConfig', DEFAULT_AUTHORED_CONFIG)
		c.set('actor', FAKE_ACTOR)
		c.set('workerId', null)
		await next()
	})

	app.route('/api/queries', queriesRoute)
	app.route('/api/runs', runsRoute)
	app.route('/api/workers', workersRoute)
	app.route('/api/tasks', tasksRoute)

	return app
}

function post(body: unknown): RequestInit {
	return {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	}
}

// ─── Setup ─────────────────────────────────────────────────────────────────

let testDir: string
let dbResult: CompanyDbResult
let app: ReturnType<typeof buildTestApp>
let services: Services

beforeAll(async () => {
	testDir = join(tmpdir(), `qp-query-test-${Date.now()}`)
	await mkdir(testDir, { recursive: true })

	process.env.AUTOPILOT_MASTER_KEY = '0'.repeat(64)
	dbResult = await createCompanyDb(testDir)
	const db = dbResult.db

	const taskService = new TaskService(db)
	const runService = new RunService(db)
	const workerService = new WorkerService(db)
	const enrollmentService = new EnrollmentService(db)
	const activityService = new ActivityService(db)
	const artifactService = new ArtifactService(db)
	const conversationBindingService = new ConversationBindingService(db)
	const taskRelationService = new TaskRelationService(db)
	const secretService = new SecretService(db)
	const queryService = new QueryService(db)

	const workflowEngine = new WorkflowEngine(
		DEFAULT_AUTHORED_CONFIG,
		taskService,
		runService,
		activityService,
		artifactService,
	)
	const taskGraphService = new TaskGraphService(taskService, taskRelationService, workflowEngine)
	workflowEngine.setChildRollupFn((tid, rel) => taskGraphService.childRollup(tid, rel))

	services = {
		taskService,
		runService,
		workerService,
		enrollmentService,
		activityService,
		artifactService,
		conversationBindingService,
		taskRelationService,
		taskGraphService,
		workflowEngine,
		secretService,
		queryService,
		sessionMessageService: new SessionMessageService(db),
	}

	app = buildTestApp(testDir, db, services)
})

afterAll(async () => {
	dbResult.raw.close()
	await rm(testDir, { recursive: true, force: true })
	delete process.env.AUTOPILOT_MASTER_KEY
})

// ─── Schema Tests ─────────────────────────────────────────────────────────

describe('QueryRequestSchema', () => {
	test('parses minimal request', () => {
		const result = QueryRequestSchema.safeParse({ prompt: 'What agents do we have?' })
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.allow_repo_mutation).toBe(false)
		}
	})

	test('parses full request', () => {
		const result = QueryRequestSchema.safeParse({
			prompt: 'Explain the workflow config',
			agent_id: 'my-agent',
			allow_repo_mutation: true,
			runtime: 'claude-code',
		})
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.agent_id).toBe('my-agent')
			expect(result.data.allow_repo_mutation).toBe(true)
		}
	})

	test('rejects empty prompt', () => {
		const result = QueryRequestSchema.safeParse({ prompt: '' })
		expect(result.success).toBe(false)
	})
})

describe('QueryResultSchema', () => {
	test('parses completed result', () => {
		const result = QueryResultSchema.safeParse({
			query_id: 'query-123',
			summary: 'Found 3 agents.',
			status: 'completed',
			run_id: 'run-456',
			mutated_repo: false,
		})
		expect(result.success).toBe(true)
	})

	test('does not accept removed fields (artifacts, outputs, changed_files)', () => {
		// These fields were removed from V1 to keep the contract truthful
		const result = QueryResultSchema.safeParse({
			query_id: 'query-123',
			summary: 'Done',
			status: 'completed',
			run_id: 'run-456',
			mutated_repo: false,
			artifacts: [{ kind: 'doc', title: 'x', ref_kind: 'inline', ref_value: 'y' }],
		})
		// Zod strips unknown keys by default, so this still parses
		expect(result.success).toBe(true)
		if (result.success) {
			expect('artifacts' in result.data).toBe(false)
		}
	})
})

describe('QueryRowSchema', () => {
	test('parses row', () => {
		const result = QueryRowSchema.safeParse({
			id: 'query-123',
			prompt: 'Hello',
			agent_id: 'agent-1',
			run_id: 'run-456',
			status: 'completed',
			allow_repo_mutation: false,
			mutated_repo: false,
			summary: 'Done',
			runtime_session_ref: null,
			session_id: null,
			created_by: 'user',
			created_at: '2024-01-01T00:00:00Z',
			ended_at: '2024-01-01T00:01:00Z',
			metadata: '{}',
		})
		expect(result.success).toBe(true)
	})
})

// ─── API Route Tests ──────────────────────────────────────────────────────

describe('POST /api/queries', () => {
	test('creates a query + taskless run', async () => {
		const res = await app.request(
			'/api/queries',
			post({ prompt: 'List all agents' }),
		)
		expect(res.status).toBe(201)

		const body = (await res.json()) as {
			query_id: string
			run_id: string
			status: string
		}
		expect(body.query_id).toMatch(/^query-/)
		expect(body.run_id).toMatch(/^run-/)
		expect(body.status).toBe('pending')

		// Verify the run exists and has NO task_id
		const runRes = await app.request(`/api/runs/${body.run_id}`)
		expect(runRes.status).toBe(200)
		const run = (await runRes.json()) as { id: string; task_id: string | null; instructions: string }
		expect(run.task_id).toBeNull()
		expect(run.instructions).toContain('Query Mode')
		expect(run.instructions).toContain('List all agents')
	})

	test('read-only query gets read-only instructions', async () => {
		const res = await app.request(
			'/api/queries',
			post({ prompt: 'Explain workflows', allow_repo_mutation: false }),
		)
		expect(res.status).toBe(201)
		const body = (await res.json()) as { run_id: string }

		const runRes = await app.request(`/api/runs/${body.run_id}`)
		const run = (await runRes.json()) as { instructions: string }
		expect(run.instructions).toContain('read-only')
		expect(run.instructions).not.toContain('mutable')
	})

	test('mutation-allowed query gets mutation instructions', async () => {
		const res = await app.request(
			'/api/queries',
			post({ prompt: 'Update agent config', allow_repo_mutation: true }),
		)
		expect(res.status).toBe(201)
		const body = (await res.json()) as { run_id: string }

		const runRes = await app.request(`/api/runs/${body.run_id}`)
		const run = (await runRes.json()) as { instructions: string }
		expect(run.instructions).toContain('mutable')
	})

	test('uses company default agent when none specified', async () => {
		const res = await app.request(
			'/api/queries',
			post({ prompt: 'Hello' }),
		)
		expect(res.status).toBe(201)

		const body = (await res.json()) as { query_id: string }
		const queryRes = await app.request(`/api/queries/${body.query_id}`)
		const query = (await queryRes.json()) as { agent_id: string }
		expect(query.agent_id).toBe('default-agent')
	})

	test('does NOT create any task rows', async () => {
		// Get task count before
		const beforeRes = await app.request('/api/tasks')
		const beforeTasks = (await beforeRes.json()) as unknown[]

		// Create a query
		await app.request('/api/queries', post({ prompt: 'No task please' }))

		// Get task count after
		const afterRes = await app.request('/api/tasks')
		const afterTasks = (await afterRes.json()) as unknown[]

		expect(afterTasks.length).toBe(beforeTasks.length)
	})
})

describe('GET /api/queries', () => {
	test('lists queries', async () => {
		const res = await app.request('/api/queries')
		expect(res.status).toBe(200)
		const queries = (await res.json()) as unknown[]
		expect(queries.length).toBeGreaterThan(0)
	})

	test('filters by status', async () => {
		const res = await app.request('/api/queries?status=pending')
		expect(res.status).toBe(200)
		const queries = (await res.json()) as Array<{ status: string }>
		for (const q of queries) {
			expect(q.status).toBe('pending')
		}
	})
})

describe('GET /api/queries/:id', () => {
	test('returns 404 for unknown ID', async () => {
		const res = await app.request('/api/queries/nonexistent')
		expect(res.status).toBe(404)
	})
})

describe('query completion on run finish', () => {
	test('query status updates to completed when its run completes', async () => {
		// Create a query
		const createRes = await app.request(
			'/api/queries',
			post({ prompt: 'Inspect state' }),
		)
		const { query_id, run_id } = (await createRes.json()) as {
			query_id: string
			run_id: string
		}

		// Simulate worker claim + complete
		await app.request(
			'/api/workers/claim',
			post({ worker_id: 'w-1' }),
		)
		await app.request(
			`/api/runs/${run_id}/events`,
			post({ type: 'started', summary: 'Starting' }),
		)
		await app.request(
			`/api/runs/${run_id}/complete`,
			post({ status: 'completed', summary: 'State looks good.' }),
		)

		// Check query is now completed (GET returns QueryResultSchema shape)
		const queryRes = await app.request(`/api/queries/${query_id}`)
		const query = (await queryRes.json()) as { query_id: string; status: string; summary: string; mutated_repo: boolean }
		expect(query.query_id).toBe(query_id)
		expect(query.status).toBe('completed')
		expect(query.summary).toBe('State looks good.')
		expect(query.mutated_repo).toBe(false)
	})

	test('mutated_repo is true when run reports changed_file artifacts', async () => {
		// Create a mutation-allowed query
		const createRes = await app.request(
			'/api/queries',
			post({ prompt: 'Edit the agent config', allow_repo_mutation: true }),
		)
		const { query_id, run_id } = (await createRes.json()) as {
			query_id: string
			run_id: string
		}

		// Simulate worker claim + complete with changed_file artifacts
		await app.request(
			'/api/workers/claim',
			post({ worker_id: 'w-1' }),
		)
		await app.request(
			`/api/runs/${run_id}/events`,
			post({ type: 'started', summary: 'Starting' }),
		)
		await app.request(
			`/api/runs/${run_id}/complete`,
			post({
				status: 'completed',
				summary: 'Updated agent role.',
				artifacts: [
					{
						kind: 'changed_file',
						title: '.autopilot/agents/default-agent.yaml',
						ref_kind: 'file',
						ref_value: '.autopilot/agents/default-agent.yaml',
					},
				],
			}),
		)

		// Check mutated_repo is true
		const queryRes = await app.request(`/api/queries/${query_id}`)
		const query = (await queryRes.json()) as { mutated_repo: boolean; status: string }
		expect(query.status).toBe('completed')
		expect(query.mutated_repo).toBe(true)
	})

	test('mutated_repo stays false when run has no changed_file artifacts', async () => {
		// Create a read-only query
		const createRes = await app.request(
			'/api/queries',
			post({ prompt: 'Just inspect' }),
		)
		const { query_id, run_id } = (await createRes.json()) as {
			query_id: string
			run_id: string
		}

		// Complete with a doc artifact (not a changed_file)
		await app.request(
			'/api/workers/claim',
			post({ worker_id: 'w-1' }),
		)
		await app.request(
			`/api/runs/${run_id}/events`,
			post({ type: 'started', summary: 'Starting' }),
		)
		await app.request(
			`/api/runs/${run_id}/complete`,
			post({
				status: 'completed',
				summary: 'Here is a draft.',
				artifacts: [
					{
						kind: 'doc',
						title: 'Draft proposal',
						ref_kind: 'inline',
						ref_value: 'Some draft content',
					},
				],
			}),
		)

		const queryRes = await app.request(`/api/queries/${query_id}`)
		const query = (await queryRes.json()) as { mutated_repo: boolean }
		expect(query.mutated_repo).toBe(false)
	})
})

describe('task regression', () => {
	test('task creation still works independently of queries', async () => {
		const res = await app.request(
			'/api/tasks',
			post({
				title: 'Independent task',
				type: 'feature',
				description: 'This is a normal task',
			}),
		)
		expect(res.status).toBe(201)
		const task = (await res.json()) as { id: string; title: string }
		expect(task.title).toBe('Independent task')
	})
})

describe('buildQueryInstructions', () => {
	test('mutable query instructions include artifact guidance', () => {
		const instructions = buildQueryInstructions('build a dashboard', {
			allowMutation: true,
			hasResume: false,
		})
		expect(instructions).toContain('mutable')
		expect(instructions).toContain('preview_file')
		expect(instructions).toContain('AUTOPILOT_RESULT')
		expect(instructions).toContain('task')
	})

	test('mutable query instructions include Autopilot-native tooling bias', () => {
		const instructions = buildQueryInstructions('create a prototype', {
			allowMutation: true,
			hasResume: false,
		})
		expect(instructions).toContain('Autopilot-native')
		expect(instructions).not.toContain('read-only')
	})

	test('read-only query instructions forbid modification', () => {
		const instructions = buildQueryInstructions('explain this', {
			allowMutation: false,
			hasResume: false,
		})
		expect(instructions).toContain('read-only')
		expect(instructions).toContain('Do NOT modify')
		expect(instructions).not.toContain('mutable')
	})
})
