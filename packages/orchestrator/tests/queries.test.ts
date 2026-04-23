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
import { mkdir, rm, writeFile } from 'node:fs/promises'
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
	SessionService,
	SessionMessageService,
	VfsService,
	DefaultWorkerRegistry,
} from '../src/services'
import type { AppEnv, Services } from '../src/api/app'
import type { Actor } from '../src/auth/types'
import type { AuthoredConfig } from '../src/services'
import { queries as queriesRoute } from '../src/api/routes/queries'
import { runs as runsRoute } from '../src/api/routes/runs'
import { workers as workersRoute } from '../src/api/routes/workers'
import { tasks as tasksRoute } from '../src/api/routes/tasks'
import { chatSessions as chatSessionsRoute } from '../src/api/routes/chat-sessions'

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
	app.route('/api/chat-sessions', chatSessionsRoute)

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
	const sessionService = new SessionService(db)
	const vfsService = new VfsService(testDir, new DefaultWorkerRegistry())

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
		sessionService,
		sessionMessageService: new SessionMessageService(db),
		vfsService,
		scriptService: {} as never,
		userPreferenceService: {} as never,
		scheduleService: {} as never,
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

	test('session-backed query persists final assistant message before complete returns', async () => {
		const session = await services.sessionService.findOrCreate({
			provider_id: 'dashboard',
			external_conversation_id: `conv-query-session-${Date.now()}`,
		})
		const query = await services.queryService.create({
			prompt: 'Need a durable reply',
			agent_id: 'default-agent',
			allow_repo_mutation: false,
			session_id: session.id,
			created_by: 'test',
		})
		const runId = `run-query-session-${Date.now()}`
		await services.runService.create({
			id: runId,
			agent_id: 'default-agent',
			runtime: 'claude-code',
			initiated_by: 'test',
			instructions: 'durable reply',
		})
		await services.queryService.linkRun(query.id, runId)

		const completeRes = await app.request(
			`/api/runs/${runId}/complete`,
			post({ status: 'completed', summary: 'Durable reply' }),
		)
		expect(completeRes.status).toBe(200)

		const stored = await services.sessionMessageService.findAssistantForQuery(query.id)
		expect(stored).toBeDefined()
		expect(stored?.content).toBe('Durable reply')

		const completedQuery = await services.queryService.get(query.id)
		expect(completedQuery?.status).toBe('completed')
		expect(completedQuery?.summary).toBe('Durable reply')
	})

	test('cancel marks linked query as failed', async () => {
		const createRes = await app.request(
			'/api/queries',
			post({ prompt: 'Cancel me' }),
		)
		const { query_id, run_id } = (await createRes.json()) as {
			query_id: string
			run_id: string
		}

		const cancelRes = await app.request(
			`/api/runs/${run_id}/cancel`,
			post({ reason: 'cancelled by test' }),
		)
		expect(cancelRes.status).toBe(200)

		const queryRes = await app.request(`/api/queries/${query_id}`)
		const query = (await queryRes.json()) as { status: string; summary: string | null }
		expect(query.status).toBe('failed')
		expect(query.summary).toBe('cancelled by test')
	})

	test('worker claim marks mutable query runs as shared-checkout workspace_mode:none', async () => {
		const workerId = `worker-mutable-query-${Date.now()}`
		const runtime = `mutable-query-${Date.now()}`

		await app.request(
			'/api/workers/register',
			post({
				id: workerId,
				capabilities: [{ runtime, models: [], maxConcurrent: 1, tags: [] }],
			}),
		)

		await app.request(
			'/api/queries',
			post({ prompt: 'build a previewable deck', runtime, allow_repo_mutation: true }),
		)

		const claimRes = await app.request(
			'/api/workers/claim',
			post({ worker_id: workerId, runtime }),
		)
		expect(claimRes.status).toBe(200)
		const claim = await claimRes.json() as { run: { task_id: string | null; workspace_mode?: string | null } | null }
		expect(claim.run?.task_id).toBeNull()
		expect(claim.run?.workspace_mode).toBe('none')
	})

	test('worker claim keeps read-only query runs without workspace_mode override', async () => {
		const workerId = `worker-readonly-query-${Date.now()}`
		const runtime = `readonly-query-${Date.now()}`

		await app.request(
			'/api/workers/register',
			post({
				id: workerId,
				capabilities: [{ runtime, models: [], maxConcurrent: 1, tags: [] }],
			}),
		)

		await app.request(
			'/api/queries',
			post({ prompt: 'inspect this file only', runtime, allow_repo_mutation: false }),
		)

		const claimRes = await app.request(
			'/api/workers/claim',
			post({ worker_id: workerId, runtime }),
		)
		expect(claimRes.status).toBe(200)
		const claim = await claimRes.json() as { run: { task_id: string | null; workspace_mode?: string | null } | null }
		expect(claim.run?.task_id).toBeNull()
		expect(claim.run?.workspace_mode ?? null).toBeNull()
	})

	test('worker claim skips shared-checkout runs when shared checkout is already locked', async () => {
		const workflowId = `wf-isolated-${Date.now()}`
		const taskId = `task-isolated-${Date.now()}`
		const isolatedRunId = `run-isolated-${Date.now()}`
		const workerId = `worker-shared-lock-${Date.now()}`
		const runtime = `bug11-${Date.now()}`

		DEFAULT_AUTHORED_CONFIG.workflows.set(workflowId, {
			id: workflowId,
			steps: [],
			workspace: { mode: 'isolated_worktree' },
		} as any)

		try {
			await app.request(
				'/api/workers/register',
				post({
					id: workerId,
					capabilities: [{ runtime, models: [], maxConcurrent: 2, tags: [] }],
				}),
			)

			const query1Res = await app.request('/api/queries', post({ prompt: 'shared checkout 1', runtime }))
			const query1 = await query1Res.json() as { run_id: string }
			const query2Res = await app.request('/api/queries', post({ prompt: 'shared checkout 2', runtime }))
			const query2 = await query2Res.json() as { run_id: string }

			const firstClaimRes = await app.request(
				'/api/workers/claim',
				post({
					worker_id: workerId,
					runtime,
					shared_checkout_locked: false,
					shared_checkout_enabled: true,
					worktree_isolation_available: true,
				}),
			)
			const firstClaim = await firstClaimRes.json() as { run: { id: string; task_id: string | null } | null }
			expect(firstClaim.run?.task_id).toBeNull()
			expect([query1.run_id, query2.run_id]).toContain(firstClaim.run?.id ?? '')

			await services.taskService.create({
				id: taskId,
				title: 'Isolated task',
				type: 'feature',
				workflow_id: workflowId,
				workflow_step: 'run',
				created_by: FAKE_ACTOR.id,
			})
			await services.runService.create({
				id: isolatedRunId,
				agent_id: 'default-agent',
				task_id: taskId,
				runtime,
				initiated_by: FAKE_ACTOR.id,
				instructions: 'Run in isolated worktree',
			})

			const secondClaimRes = await app.request(
				'/api/workers/claim',
				post({
					worker_id: workerId,
					runtime,
					shared_checkout_locked: true,
					shared_checkout_enabled: true,
					worktree_isolation_available: true,
				}),
			)
			const secondClaim = await secondClaimRes.json() as { run: { id: string; task_id: string | null } | null }
			expect(secondClaim.run?.id).toBe(isolatedRunId)

			const deferredQueryIds = [query1.run_id, query2.run_id].filter((id) => id !== firstClaim.run?.id)
			for (const queryRunId of deferredQueryIds) {
				const deferredQuery = await services.runService.get(queryRunId)
				expect(deferredQuery?.status).toBe('pending')
			}
		} finally {
			DEFAULT_AUTHORED_CONFIG.workflows.delete(workflowId)
		}
	})

	test('worker claim returns no run when shared checkout is locked and only shared-checkout work remains', async () => {
		const workerId = `worker-shared-only-${Date.now()}`
		const runtime = `bug11-shared-${Date.now()}`

		await app.request(
			'/api/workers/register',
			post({
				id: workerId,
				capabilities: [{ runtime, models: [], maxConcurrent: 2, tags: [] }],
			}),
		)

		await app.request('/api/queries', post({ prompt: 'shared only 1', runtime }))
		await app.request('/api/queries', post({ prompt: 'shared only 2', runtime }))

		const firstClaimRes = await app.request(
			'/api/workers/claim',
			post({
				worker_id: workerId,
				runtime,
				shared_checkout_locked: false,
				shared_checkout_enabled: true,
				worktree_isolation_available: true,
			}),
		)
		const firstClaim = await firstClaimRes.json() as { run: { id: string } | null }
		expect(firstClaim.run).not.toBeNull()

		const secondClaimRes = await app.request(
			'/api/workers/claim',
			post({
				worker_id: workerId,
				runtime,
				shared_checkout_locked: true,
				shared_checkout_enabled: true,
				worktree_isolation_available: true,
			}),
		)
		const secondClaim = await secondClaimRes.json() as { run: { id: string } | null }
		expect(secondClaim.run).toBeNull()
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
			expect(instructions).toContain('artifact_create')
			expect(instructions).toContain('rendered preview')
			expect(instructions).toContain('Autopilot-native primitives')
			expect(instructions).toContain('task')
		})

	test('mutable query instructions explain self-contained HTML artifact expectations', () => {
		const instructions = buildQueryInstructions('build a reveal.js deck', {
			allowMutation: true,
			hasResume: false,
		})
			expect(instructions).toContain('self-contained files')
			expect(instructions).toContain('Tailwind via CDN')
		expect(instructions).toContain('proper HTML structure')
	})

	test('current attachments are injected into query instructions', () => {
		const instructions = buildQueryInstructions('Review this file', {
			allowMutation: true,
			hasResume: false,
			currentAttachments: [
				{
					type: 'text',
					name: 'notes.txt',
					mimeType: 'text/plain',
					content: 'Important note\nSecond line',
					metadata: { view: 'tasks', taskId: 'task-123' },
				},
			],
		})
		expect(instructions).toContain('## Attached Context')
		expect(instructions).toContain('notes.txt')
		expect(instructions).toContain('mime: text/plain')
		expect(instructions).toContain('Important note')
		expect(instructions).toContain('"taskId":"task-123"')
	})

	test('history attachments are surfaced on cold start', () => {
		const instructions = buildQueryInstructions('Continue', {
			allowMutation: true,
			hasResume: false,
			sessionMessages: [{
				id: 'smsg-1',
				session_id: 'sess-1',
				role: 'user',
				content: 'Please review the attachment',
				query_id: null,
				external_message_id: null,
				metadata: JSON.stringify({
					attachments: [{ type: 'file', name: 'design.png', mimeType: 'image/png' }],
				}),
				created_at: new Date().toISOString(),
			}],
		})
		expect(instructions).toContain('Please review the attachment')
		expect(instructions).toContain('design.png')
		expect(instructions).toContain('mime: image/png')
	})

	test('chat session task ref attachments are hydrated with task content', async () => {
		const task = await services.taskService.create({
			id: `task-chat-context-${Date.now()}`,
			title: 'Review homepage copy',
			description: 'Give an opinion on whether the copy feels too generic.',
			type: 'task',
			status: 'blocked',
			priority: 'high',
			created_by: 'test',
		})

		const res = await app.request('/api/chat-sessions', post({
			agentId: 'default-agent',
			message: 'nazor?',
			attachments: [{
				type: 'ref',
				label: `Task ${task!.id.slice(0, 8)} ${task!.title}`,
				refType: 'task',
				refId: task!.id,
			}],
		}))
		expect(res.status).toBe(200)

		const body = await res.json() as { run_id: string }
		const run = await services.runService.get(body.run_id)
		expect(run?.instructions).toContain('## Attached Context')
		expect(run?.instructions).toContain(`Task ID: ${task!.id}`)
		expect(run?.instructions).toContain('Review homepage copy')
		expect(run?.instructions).toContain('Give an opinion on whether the copy feels too generic.')
		expect(run?.instructions).toContain('Status: blocked')
	})

	test('chat session file and directory ref attachments are hydrated with VFS context', async () => {
		await mkdir(join(testDir, '.autopilot', 'workflows'), { recursive: true })
		await writeFile(
			join(testDir, '.autopilot', 'workflows', 'arch-review.yaml'),
			'name: arch-review\nsteps:\n  - id: inspect\n',
		)
		await writeFile(
			join(testDir, '.autopilot', 'workflows', 'bounded-dev.yaml'),
			'name: bounded-dev\nsteps:\n  - id: build\n',
		)

		const res = await app.request('/api/chat-sessions', post({
			agentId: 'default-agent',
			message: 'nazor na subory',
			attachments: [
				{
					type: 'ref',
					label: 'Current folder .autopilot/workflows',
					refType: 'directory',
					refId: '.autopilot/workflows',
					metadata: { path: '.autopilot/workflows' },
				},
				{
					type: 'ref',
					label: '.autopilot/workflows/arch-review.yaml',
					refType: 'file',
					refId: '.autopilot/workflows/arch-review.yaml',
					metadata: { path: '.autopilot/workflows/arch-review.yaml' },
				},
			],
		}))
		expect(res.status).toBe(200)

		const body = await res.json() as { run_id: string }
		const run = await services.runService.get(body.run_id)
		expect(run?.instructions).toContain('Directory: .autopilot/workflows')
		expect(run?.instructions).toContain('arch-review.yaml')
		expect(run?.instructions).toContain('bounded-dev.yaml')
		expect(run?.instructions).toContain('name: arch-review')
		expect(run?.instructions).toContain('steps:')
	})

	test('chat session run and artifact ref attachments are hydrated with run summary and artifact content', async () => {
		const runId = `run-chat-run-context-${Date.now()}`
		await services.runService.create({
			id: runId,
			agent_id: 'default-agent',
			runtime: 'claude-code',
			initiated_by: 'test',
			instructions: 'review artifacts',
		})
		await services.runService.appendEvent(runId, {
			type: 'progress',
			summary: 'Reading workflow files',
		})
		await services.runService.complete(runId, {
			status: 'completed',
			summary: 'The workflow looks coherent but needs naming cleanup.',
		})

		const artifactId = `artifact-chat-context-${Date.now()}`
		await services.artifactService.create({
			id: artifactId,
			run_id: runId,
			kind: 'doc',
			title: 'workflow-notes.md',
			ref_kind: 'inline',
			ref_value: '# Notes\nThe YAML is readable, but aliases are inconsistent.',
			mime_type: 'text/markdown',
		})

		const res = await app.request('/api/chat-sessions', post({
			agentId: 'default-agent',
			message: 'co si myslis?',
			attachments: [
				{
					type: 'ref',
					label: `Run ${runId.slice(0, 8)}`,
					refType: 'run',
					refId: runId,
					metadata: { runId },
				},
				{
					type: 'ref',
					label: 'workflow-notes.md',
					refType: 'artifact',
					refId: artifactId,
					metadata: { artifactId, runId },
				},
			],
		}))
		expect(res.status).toBe(200)

		const body = await res.json() as { run_id: string }
		const run = await services.runService.get(body.run_id)
		expect(run?.instructions).toContain(`Run ID: ${runId}`)
		expect(run?.instructions).toContain('The workflow looks coherent but needs naming cleanup.')
		expect(run?.instructions).toContain('Reading workflow files')
		expect(run?.instructions).toContain('Artifact ID:')
		expect(run?.instructions).toContain('workflow-notes.md')
		expect(run?.instructions).toContain('The YAML is readable, but aliases are inconsistent.')
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
