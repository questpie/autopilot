/**
 * Tests for Pass 24.9 — Messaging / Session Model V1.
 *
 * Covers:
 * - SessionModeSchema, SessionStatusSchema, SessionRowSchema parsing
 * - ConversationResultSchema query.message validation
 * - SessionService CRUD (findOrCreate, get, findByExternal, bindTask, updateLastQuery, close, list, listForTask)
 * - Inbound routing: query.message → session-based query plane dispatch
 * - Inbound routing: task-bound thread via session
 * - No hidden task creation from general messaging
 * - Unbound task action returns 422
 * - Session inspection API (GET /api/sessions, GET /api/sessions/:id)
 * - Backward compat: binding without session → task routing
 */
import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Hono } from 'hono'
import {
	ConversationResultSchema,
	SessionRowSchema,
	SessionModeSchema,
	SessionStatusSchema,
} from '@questpie/autopilot-spec'
import type { Provider } from '@questpie/autopilot-spec'
import { createCompanyDb, type CompanyDbResult } from '../src/db'
import {
	TaskService,
	RunService,
	WorkflowEngine,
	ActivityService,
	ArtifactService,
	ConversationBindingService,
	SessionService,
	QueryService,
	SecretService,
} from '../src/services'
import type { AuthoredConfig } from '../src/services'
import type { AppEnv, Services } from '../src/api/app'
import type { Actor } from '../src/auth/types'
import { conversations } from '../src/api/routes/conversations'
import { sessionsRoute } from '../src/api/routes/sessions'

// ─── Schema Tests ────────────────────────────────────────────────────────────

describe('SessionModeSchema', () => {
	test('validates query', () => {
		const r = SessionModeSchema.safeParse('query')
		expect(r.success).toBe(true)
	})

	test('validates task_thread', () => {
		const r = SessionModeSchema.safeParse('task_thread')
		expect(r.success).toBe(true)
	})

	test('rejects invalid mode', () => {
		const r = SessionModeSchema.safeParse('unknown_mode')
		expect(r.success).toBe(false)
	})
})

describe('SessionStatusSchema', () => {
	test('validates active', () => {
		const r = SessionStatusSchema.safeParse('active')
		expect(r.success).toBe(true)
	})

	test('validates closed', () => {
		const r = SessionStatusSchema.safeParse('closed')
		expect(r.success).toBe(true)
	})
})

describe('SessionRowSchema', () => {
	test('parses a valid row', () => {
		const r = SessionRowSchema.safeParse({
			id: 'sess-1',
			provider_id: 'telegram',
			external_conversation_id: 'chat-100',
			external_thread_id: null,
			mode: 'query',
			task_id: null,
			last_query_id: null,
			status: 'active',
			created_at: '2026-01-01T00:00:00.000Z',
			updated_at: '2026-01-01T00:00:00.000Z',
			metadata: '{}',
		})
		expect(r.success).toBe(true)
	})
})

describe('ConversationResultSchema query.message', () => {
	test('validates query.message action', () => {
		const r = ConversationResultSchema.safeParse({
			action: 'query.message',
			conversation_id: 'conv-1',
			message: 'What is the status?',
		})
		expect(r.success).toBe(true)
	})

	test('rejects query.message without message', () => {
		const r = ConversationResultSchema.safeParse({
			action: 'query.message',
			conversation_id: 'conv-1',
		})
		expect(r.success).toBe(false)
	})
})

// ─── SessionService Tests ───────────────────────────────────────────────────

describe('SessionService', () => {
	const companyRoot = join(tmpdir(), `qp-session-svc-${Date.now()}`)
	let dbResult: CompanyDbResult
	let service: SessionService

	beforeAll(async () => {
		await mkdir(join(companyRoot, '.autopilot'), { recursive: true })
		await writeFile(join(companyRoot, '.autopilot', 'company.yaml'), 'name: test\nslug: test\n')
		dbResult = await createCompanyDb(companyRoot)
		service = new SessionService(dbResult.db)
	})

	afterAll(async () => {
		dbResult.raw.close()
		await rm(companyRoot, { recursive: true, force: true })
	})

	test('findOrCreate creates new session with default query mode', async () => {
		const session = await service.findOrCreate({
			provider_id: 'tg-1',
			external_conversation_id: 'chat-1',
		})
		expect(session).toBeDefined()
		expect(session.provider_id).toBe('tg-1')
		expect(session.external_conversation_id).toBe('chat-1')
		expect(session.mode).toBe('query')
		expect(session.status).toBe('active')
		expect(session.task_id).toBeNull()
	})

	test('findOrCreate returns existing session on second call', async () => {
		const first = await service.findOrCreate({
			provider_id: 'tg-2',
			external_conversation_id: 'chat-2',
		})
		const second = await service.findOrCreate({
			provider_id: 'tg-2',
			external_conversation_id: 'chat-2',
		})
		expect(second.id).toBe(first.id)
	})

	test('findOrCreate creates task_thread session when mode specified', async () => {
		const session = await service.findOrCreate({
			provider_id: 'tg-3',
			external_conversation_id: 'chat-3',
			mode: 'task_thread',
			task_id: 'task-abc',
		})
		expect(session.mode).toBe('task_thread')
		expect(session.task_id).toBe('task-abc')
	})

	test('get returns session by ID', async () => {
		const created = await service.findOrCreate({
			provider_id: 'tg-get',
			external_conversation_id: 'chat-get',
		})
		const fetched = await service.get(created.id)
		expect(fetched).toBeDefined()
		expect(fetched!.id).toBe(created.id)
	})

	test('findByExternal finds by provider + conversation', async () => {
		await service.findOrCreate({
			provider_id: 'tg-ext',
			external_conversation_id: 'chat-ext',
		})
		const found = await service.findByExternal('tg-ext', 'chat-ext')
		expect(found).toBeDefined()
		expect(found!.provider_id).toBe('tg-ext')
	})

	test('findByExternal with thread_id finds exact match', async () => {
		await service.findOrCreate({
			provider_id: 'tg-thread',
			external_conversation_id: 'chat-thread',
			external_thread_id: 'thread-99',
		})
		const found = await service.findByExternal('tg-thread', 'chat-thread', 'thread-99')
		expect(found).toBeDefined()
		expect(found!.external_thread_id).toBe('thread-99')
	})

	test('bindTask transitions session to task_thread mode', async () => {
		const session = await service.findOrCreate({
			provider_id: 'tg-bind',
			external_conversation_id: 'chat-bind',
		})
		expect(session.mode).toBe('query')

		const updated = await service.bindTask(session.id, 'task-xyz')
		expect(updated).toBeDefined()
		expect(updated!.mode).toBe('task_thread')
		expect(updated!.task_id).toBe('task-xyz')
	})

	test('updateLastQuery stores last query reference', async () => {
		const session = await service.findOrCreate({
			provider_id: 'tg-lq',
			external_conversation_id: 'chat-lq',
		})
		expect(session.last_query_id).toBeNull()

		const updated = await service.updateLastQuery(session.id, 'query-111')
		expect(updated).toBeDefined()
		expect(updated!.last_query_id).toBe('query-111')
	})

	test('close sets status to closed', async () => {
		const session = await service.findOrCreate({
			provider_id: 'tg-close',
			external_conversation_id: 'chat-close',
		})
		expect(session.status).toBe('active')

		const closed = await service.close(session.id)
		expect(closed).toBeDefined()
		expect(closed!.status).toBe('closed')
	})

	test('findByExternal does not return closed sessions', async () => {
		const session = await service.findOrCreate({
			provider_id: 'tg-close-find',
			external_conversation_id: 'chat-close-find',
		})
		await service.close(session.id)

		const found = await service.findByExternal('tg-close-find', 'chat-close-find')
		expect(found).toBeUndefined()
	})

	test('findOrCreate creates new session after prior is closed', async () => {
		const first = await service.findOrCreate({
			provider_id: 'tg-reopen',
			external_conversation_id: 'chat-reopen',
		})
		await service.close(first.id)

		const second = await service.findOrCreate({
			provider_id: 'tg-reopen',
			external_conversation_id: 'chat-reopen',
		})
		expect(second.id).not.toBe(first.id)
		expect(second.status).toBe('active')
	})

	test('thread-specific session does not match chat-level lookup', async () => {
		await service.findOrCreate({
			provider_id: 'tg-thread-scope',
			external_conversation_id: 'chat-scope',
			external_thread_id: 'msg-42',
			mode: 'task_thread',
			task_id: 'task-scope',
		})

		// Chat-level lookup (no thread) should not find the thread-specific session
		const chatLevel = await service.findByExternal('tg-thread-scope', 'chat-scope')
		expect(chatLevel).toBeUndefined()

		// Thread-specific lookup should find it
		const threadLevel = await service.findByExternal('tg-thread-scope', 'chat-scope', 'msg-42')
		expect(threadLevel).toBeDefined()
		expect(threadLevel!.mode).toBe('task_thread')
	})

	test('list returns all sessions', async () => {
		const all = await service.list()
		expect(all.length).toBeGreaterThanOrEqual(1)
	})

	test('list filters by status', async () => {
		const closed = await service.list({ status: 'closed' })
		for (const s of closed) {
			expect(s.status).toBe('closed')
		}
	})

	test('list filters by mode', async () => {
		const taskThreads = await service.list({ mode: 'task_thread' })
		for (const s of taskThreads) {
			expect(s.mode).toBe('task_thread')
		}
	})

	test('list filters by provider', async () => {
		const results = await service.list({ provider_id: 'tg-1' })
		for (const s of results) {
			expect(s.provider_id).toBe('tg-1')
		}
	})

	test('listForTask returns sessions for a task', async () => {
		const results = await service.listForTask('task-abc')
		expect(results.length).toBeGreaterThanOrEqual(1)
		for (const s of results) {
			expect(s.task_id).toBe('task-abc')
		}
	})
})

// ─── Inbound Routing Tests ──────────────────────────────────────────────────

describe('Inbound Routing with Sessions', () => {
	const companyRoot = join(tmpdir(), `qp-session-route-${Date.now()}`)
	let dbResult: CompanyDbResult

	const FAKE_ACTOR: Actor = {
		id: 'test-user',
		type: 'human',
		name: 'Test',
		role: 'owner',
		source: 'api',
	}

	// Handler scripts
	const QUERY_MSG_HANDLER = `const input = await Bun.stdin.text()
const envelope = JSON.parse(input)
console.log(JSON.stringify({
  ok: true,
  metadata: {
    action: 'query.message',
    conversation_id: envelope.payload.conversation_id,
    message: envelope.payload.text,
  },
}))`

	const TASK_REPLY_HANDLER = `const input = await Bun.stdin.text()
const envelope = JSON.parse(input)
console.log(JSON.stringify({
  ok: true,
  metadata: {
    action: 'task.reply',
    conversation_id: envelope.payload.conversation_id,
    thread_id: envelope.payload.thread_id,
    message: envelope.payload.text,
  },
}))`

	const TASK_APPROVE_HANDLER = `const input = await Bun.stdin.text()
const envelope = JSON.parse(input)
console.log(JSON.stringify({
  ok: true,
  metadata: {
    action: 'task.approve',
    conversation_id: envelope.payload.conversation_id,
    thread_id: envelope.payload.thread_id,
  },
}))`

	const NOOP_HANDLER = `console.log(JSON.stringify({ ok: true, metadata: { action: 'noop', reason: 'test' } }))`

	function makeProvider(id: string, handler: string): Provider {
		return {
			id,
			name: id,
			kind: 'conversation_channel',
			handler,
			capabilities: [{ op: 'conversation.ingest' }],
			events: [],
			config: {},
			secret_refs: [{ name: 'auth_secret', source: 'env', key: `__TEST_SESSION_SECRET_${id}` }],
			description: '',
		}
	}

	function makeServices(): Services {
		return {
			taskService: new TaskService(dbResult.db),
			runService: new RunService(dbResult.db),
			workerService: {} as any,
			enrollmentService: {} as any,
			activityService: new ActivityService(dbResult.db),
			artifactService: new ArtifactService(dbResult.db),
			conversationBindingService: new ConversationBindingService(dbResult.db),
			sessionService: new SessionService(dbResult.db),
			queryService: new QueryService(dbResult.db),
			workflowEngine: {} as any,
			taskRelationService: {} as any,
			taskGraphService: {} as any,
			secretService: new SecretService(dbResult.db),
		}
	}

	function buildApp(providers: Map<string, Provider>, services: Services, authoredConfigOverride?: AuthoredConfig) {
		const authoredConfig: AuthoredConfig = authoredConfigOverride ?? {
			company: { name: 'test', slug: 'test', description: '', timezone: 'UTC', language: 'en', owner: { name: '', email: '' }, defaults: {} },
			agents: new Map([
				['dev', { id: 'dev', name: 'Dev', role: 'developer', description: '' }],
			]),
			workflows: new Map([
				['review', {
					id: 'review',
					name: 'Review',
					description: '',
					steps: [
						{ id: 'work', type: 'agent', agent_id: 'dev', instructions: 'Do work' },
						{ id: 'review', type: 'human_approval' },
						{ id: 'done', type: 'done' },
					],
				}],
			]),
			environments: new Map(),
			providers,
			capabilityProfiles: new Map(),
			defaults: { runtime: 'claude-code', workflow: 'review', task_assignee: 'dev' },
		}

		const app = new Hono<AppEnv>()
		app.use('*', async (c, next) => {
			c.set('companyRoot', companyRoot)
			c.set('db', dbResult.db)
			c.set('auth', {} as never)
			c.set('services', services)
			c.set('authoredConfig', authoredConfig)
			c.set('actor', FAKE_ACTOR)
			c.set('workerId', null)
			await next()
		})
		app.route('/api/conversations', conversations)
		app.route('/api/sessions', sessionsRoute)
		return app
	}

	function post(body: unknown, headers?: Record<string, string>): RequestInit {
		return {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', ...headers },
			body: JSON.stringify(body),
		}
	}

	beforeAll(async () => {
		await mkdir(join(companyRoot, '.autopilot', 'handlers'), { recursive: true })
		await writeFile(join(companyRoot, '.autopilot', 'company.yaml'), 'name: test\nslug: test\n')
		await writeFile(join(companyRoot, '.autopilot', 'handlers', 'query-msg.ts'), QUERY_MSG_HANDLER)
		await writeFile(join(companyRoot, '.autopilot', 'handlers', 'task-reply.ts'), TASK_REPLY_HANDLER)
		await writeFile(join(companyRoot, '.autopilot', 'handlers', 'task-approve.ts'), TASK_APPROVE_HANDLER)
		await writeFile(join(companyRoot, '.autopilot', 'handlers', 'noop.ts'), NOOP_HANDLER)
		dbResult = await createCompanyDb(companyRoot)
		process.env.AUTOPILOT_MASTER_KEY = '0'.repeat(64)
	})

	afterAll(async () => {
		dbResult.raw.close()
		await rm(companyRoot, { recursive: true, force: true })
		delete process.env.AUTOPILOT_MASTER_KEY
	})

	test('general chat routes to query mode', async () => {
		process.env.__TEST_SESSION_SECRET_prov1 = 'secret-1'
		const providers = new Map([['prov1', makeProvider('prov1', 'handlers/query-msg.ts')]])
		const services = makeServices()
		const app = buildApp(providers, services)

		const res = await app.request(
			'/api/conversations/prov1',
			post(
				{ conversation_id: 'conv-q1', text: 'Hello, what is the project status?' },
				{ 'x-provider-secret': 'secret-1' },
			),
		)

		expect(res.status).toBe(200)
		const body = await res.json() as any
		expect(body.action).toBe('query.dispatched')
		expect(body.session_id).toBeDefined()
		expect(body.query_id).toBeDefined()
		expect(body.run_id).toBeDefined()

		delete process.env.__TEST_SESSION_SECRET_prov1
	})

	test('query mode creates session', async () => {
		process.env.__TEST_SESSION_SECRET_prov2 = 'secret-2'
		const providers = new Map([['prov2', makeProvider('prov2', 'handlers/query-msg.ts')]])
		const services = makeServices()
		const app = buildApp(providers, services)

		// Dispatch a query.message
		const res = await app.request(
			'/api/conversations/prov2',
			post(
				{ conversation_id: 'conv-q2', text: 'Check status' },
				{ 'x-provider-secret': 'secret-2' },
			),
		)
		expect(res.status).toBe(200)
		const body = await res.json() as any
		const sessionId = body.session_id

		// Verify session via GET /api/sessions/:id
		const sessRes = await app.request(`/api/sessions/${sessionId}`)
		expect(sessRes.status).toBe(200)
		const sessBody = await sessRes.json() as any
		expect(sessBody.mode).toBe('query')
		expect(sessBody.provider_id).toBe('prov2')
		expect(sessBody.status).toBe('active')

		delete process.env.__TEST_SESSION_SECRET_prov2
	})

	test('second query.message continues from prior query', async () => {
		process.env.__TEST_SESSION_SECRET_prov3 = 'secret-3'
		const providers = new Map([['prov3', makeProvider('prov3', 'handlers/query-msg.ts')]])
		const services = makeServices()
		const app = buildApp(providers, services)

		// First message
		const res1 = await app.request(
			'/api/conversations/prov3',
			post(
				{ conversation_id: 'conv-q3', text: 'First question' },
				{ 'x-provider-secret': 'secret-3' },
			),
		)
		expect(res1.status).toBe(200)
		const body1 = await res1.json() as any
		const firstQueryId = body1.query_id

		// Second message — same conversation_id, should continue
		const res2 = await app.request(
			'/api/conversations/prov3',
			post(
				{ conversation_id: 'conv-q3', text: 'Follow up question' },
				{ 'x-provider-secret': 'secret-3' },
			),
		)
		expect(res2.status).toBe(200)
		const body2 = await res2.json() as any
		expect(body2.action).toBe('query.dispatched')
		expect(body2.continue_from).toBe(firstQueryId)

		delete process.env.__TEST_SESSION_SECRET_prov3
	})

	test('task-bound thread routes to task primitives', async () => {
		process.env.__TEST_SESSION_SECRET_prov4 = 'secret-4'
		const providers = new Map([['prov4', makeProvider('prov4', 'handlers/task-approve.ts')]])
		const taskService = new TaskService(dbResult.db)
		const runService = new RunService(dbResult.db)
		const activityService = new ActivityService(dbResult.db)
		const artifactService = new ArtifactService(dbResult.db)
		const sessionService = new SessionService(dbResult.db)
		const bindingService = new ConversationBindingService(dbResult.db)

		const authoredConfig: AuthoredConfig = {
			company: { name: 'test', slug: 'test', description: '', timezone: 'UTC', language: 'en', owner: { name: '', email: '' }, defaults: {} },
			agents: new Map([['dev', { id: 'dev', name: 'Dev', role: 'developer', description: '' }]]),
			workflows: new Map([['review', {
				id: 'review', name: 'Review', description: '', steps: [
					{ id: 'work', type: 'agent', agent_id: 'dev', instructions: 'Do work' },
					{ id: 'review', type: 'human_approval' },
					{ id: 'done', type: 'done' },
				],
			}]]),
			environments: new Map(),
			providers,
			capabilityProfiles: new Map(),
			defaults: { runtime: 'claude-code', workflow: 'review', task_assignee: 'dev' },
		}

		const workflowEngine = new WorkflowEngine(authoredConfig, taskService, runService, activityService, artifactService)

		// Create a task at human_approval step
		const mat = await workflowEngine.materializeTask({ title: 'Test approve session', type: 'feature', created_by: 'test' })
		const taskId = mat!.task.id
		await runService.start(mat!.runId!)
		await runService.complete(mat!.runId!, { status: 'completed', summary: 'Done' })
		await workflowEngine.advance(taskId)

		// Verify task is blocked on review
		const task = await taskService.get(taskId)
		expect(task!.workflow_step).toBe('review')
		expect(task!.status).toBe('blocked')

		// Create a task_thread session for this conversation
		await sessionService.findOrCreate({
			provider_id: 'prov4',
			external_conversation_id: 'conv-task-approve',
			mode: 'task_thread',
			task_id: taskId,
		})

		const services: Services = {
			taskService, runService,
			workerService: {} as any,
			enrollmentService: {} as any,
			activityService,
			artifactService,
			conversationBindingService: bindingService,
			sessionService,
			queryService: new QueryService(dbResult.db),
			workflowEngine,
			taskRelationService: {} as any,
			taskGraphService: {} as any,
			secretService: new SecretService(dbResult.db),
		}

		const app = buildApp(providers, services, authoredConfig)
		const res = await app.request(
			'/api/conversations/prov4',
			post(
				{ conversation_id: 'conv-task-approve', text: '/approve' },
				{ 'x-provider-secret': 'secret-4' },
			),
		)

		expect(res.status).toBe(200)
		const body = await res.json() as any
		expect(body.action).toBe('task.approved')

		// Task should have advanced past review
		const finalTask = await taskService.get(taskId)
		expect(finalTask!.status).toBe('done')

		delete process.env.__TEST_SESSION_SECRET_prov4
	})

	test('task notification creates session via binding', async () => {
		process.env.__TEST_SESSION_SECRET_prov5 = 'secret-5'
		const providers = new Map([['prov5', makeProvider('prov5', 'handlers/task-reply.ts')]])
		const taskService = new TaskService(dbResult.db)
		const runService = new RunService(dbResult.db)
		const activityService = new ActivityService(dbResult.db)
		const artifactService = new ArtifactService(dbResult.db)
		const sessionService = new SessionService(dbResult.db)
		const bindingService = new ConversationBindingService(dbResult.db)

		const authoredConfig: AuthoredConfig = {
			company: { name: 'test', slug: 'test', description: '', timezone: 'UTC', language: 'en', owner: { name: '', email: '' }, defaults: {} },
			agents: new Map([['dev', { id: 'dev', name: 'Dev', role: 'developer', description: '' }]]),
			workflows: new Map([['review', {
				id: 'review', name: 'Review', description: '', steps: [
					{ id: 'work', type: 'agent', agent_id: 'dev', instructions: 'Do work' },
					{ id: 'review', type: 'human_approval' },
					{ id: 'done', type: 'done' },
				],
			}]]),
			environments: new Map(),
			providers,
			capabilityProfiles: new Map(),
			defaults: { runtime: 'claude-code', workflow: 'review', task_assignee: 'dev' },
		}

		const workflowEngine = new WorkflowEngine(authoredConfig, taskService, runService, activityService, artifactService)

		// Create a task at human_approval step
		const mat = await workflowEngine.materializeTask({ title: 'Test reply session', type: 'feature', created_by: 'test' })
		const taskId = mat!.task.id
		await runService.start(mat!.runId!)
		await runService.complete(mat!.runId!, { status: 'completed', summary: 'Done' })
		await workflowEngine.advance(taskId)

		// Create a binding (simulating notification delivery creating it)
		await bindingService.create({
			id: `bind-notif-${Date.now()}`,
			provider_id: 'prov5',
			external_conversation_id: 'conv-notif-reply',
			mode: 'task_thread',
			task_id: taskId,
		})

		// Also create a task_thread session for the same external IDs
		await sessionService.findOrCreate({
			provider_id: 'prov5',
			external_conversation_id: 'conv-notif-reply',
			mode: 'task_thread',
			task_id: taskId,
		})

		const services: Services = {
			taskService, runService,
			workerService: {} as any,
			enrollmentService: {} as any,
			activityService,
			artifactService,
			conversationBindingService: bindingService,
			sessionService,
			queryService: new QueryService(dbResult.db),
			workflowEngine,
			taskRelationService: {} as any,
			taskGraphService: {} as any,
			secretService: new SecretService(dbResult.db),
		}

		const app = buildApp(providers, services, authoredConfig)
		const res = await app.request(
			'/api/conversations/prov5',
			post(
				{ conversation_id: 'conv-notif-reply', text: 'Needs more tests please' },
				{ 'x-provider-secret': 'secret-5' },
			),
		)

		expect(res.status).toBe(200)
		const body = await res.json() as any
		expect(body.action).toBe('task.replied')

		delete process.env.__TEST_SESSION_SECRET_prov5
	})

	test('no hidden task creation from general messaging', async () => {
		process.env.__TEST_SESSION_SECRET_prov6 = 'secret-6'
		const providers = new Map([['prov6', makeProvider('prov6', 'handlers/query-msg.ts')]])
		const services = makeServices()
		const taskService = services.taskService
		const app = buildApp(providers, services)

		// Count tasks before
		const tasksBefore = await taskService.list()
		const countBefore = tasksBefore.length

		// Send a query.message
		const res = await app.request(
			'/api/conversations/prov6',
			post(
				{ conversation_id: 'conv-no-task', text: 'Just a question' },
				{ 'x-provider-secret': 'secret-6' },
			),
		)
		expect(res.status).toBe(200)
		const body = await res.json() as any
		expect(body.action).toBe('query.dispatched')

		// Verify no new tasks created
		const tasksAfter = await taskService.list()
		expect(tasksAfter.length).toBe(countBefore)

		delete process.env.__TEST_SESSION_SECRET_prov6
	})

	test('unbound task action returns 422', async () => {
		process.env.__TEST_SESSION_SECRET_prov7 = 'secret-7'
		const providers = new Map([['prov7', makeProvider('prov7', 'handlers/task-reply.ts')]])
		const services = makeServices()
		const app = buildApp(providers, services)

		const res = await app.request(
			'/api/conversations/prov7',
			post(
				{ conversation_id: 'unknown-conv-xyz', text: 'hello' },
				{ 'x-provider-secret': 'secret-7' },
			),
		)
		expect(res.status).toBe(422)
		const body = await res.json() as any
		expect(body.error).toBe('unbound_conversation')

		delete process.env.__TEST_SESSION_SECRET_prov7
	})

	test('session inspection API — GET /api/sessions returns sessions', async () => {
		process.env.__TEST_SESSION_SECRET_prov8 = 'secret-8'
		const providers = new Map([['prov8', makeProvider('prov8', 'handlers/query-msg.ts')]])
		const services = makeServices()
		const app = buildApp(providers, services)

		// Create a session by sending a query.message
		await app.request(
			'/api/conversations/prov8',
			post(
				{ conversation_id: 'conv-inspect', text: 'Inspect me' },
				{ 'x-provider-secret': 'secret-8' },
			),
		)

		// List sessions
		const listRes = await app.request('/api/sessions')
		expect(listRes.status).toBe(200)
		const listBody = await listRes.json() as any[]
		expect(listBody.length).toBeGreaterThanOrEqual(1)

		delete process.env.__TEST_SESSION_SECRET_prov8
	})

	test('session inspection API — GET /api/sessions/:id returns single session', async () => {
		process.env.__TEST_SESSION_SECRET_prov9 = 'secret-9'
		const providers = new Map([['prov9', makeProvider('prov9', 'handlers/query-msg.ts')]])
		const services = makeServices()
		const app = buildApp(providers, services)

		// Create a session
		const res = await app.request(
			'/api/conversations/prov9',
			post(
				{ conversation_id: 'conv-single', text: 'Get me' },
				{ 'x-provider-secret': 'secret-9' },
			),
		)
		const body = await res.json() as any
		const sessionId = body.session_id

		// Get single session
		const getRes = await app.request(`/api/sessions/${sessionId}`)
		expect(getRes.status).toBe(200)
		const getBody = await getRes.json() as any
		expect(getBody.id).toBe(sessionId)

		delete process.env.__TEST_SESSION_SECRET_prov9
	})

	test('session inspection API — 404 for unknown session', async () => {
		const providers = new Map<string, Provider>()
		const services = makeServices()
		const app = buildApp(providers, services)

		const res = await app.request('/api/sessions/sess-does-not-exist')
		expect(res.status).toBe(404)
		const body = await res.json() as any
		expect(body.error).toBe('session not found')
	})
})

// ─── Regression: Backward Compat — Binding without Session ──────────────────

describe('Backward Compat: binding without session routes to task', () => {
	const companyRoot = join(tmpdir(), `qp-session-compat-${Date.now()}`)
	let dbResult: CompanyDbResult

	const FAKE_ACTOR: Actor = {
		id: 'test-user',
		type: 'human',
		name: 'Test',
		role: 'owner',
		source: 'api',
	}

	const APPROVE_HANDLER = `const input = await Bun.stdin.text()
const envelope = JSON.parse(input)
console.log(JSON.stringify({
  ok: true,
  metadata: {
    action: 'task.approve',
    conversation_id: envelope.payload.conversation_id,
  },
}))`

	function makeProvider(id: string, handler: string): Provider {
		return {
			id,
			name: id,
			kind: 'conversation_channel',
			handler,
			capabilities: [{ op: 'conversation.ingest' }],
			events: [],
			config: {},
			secret_refs: [{ name: 'auth_secret', source: 'env', key: `__TEST_SESSION_COMPAT_${id}` }],
			description: '',
		}
	}

	beforeAll(async () => {
		await mkdir(join(companyRoot, '.autopilot', 'handlers'), { recursive: true })
		await writeFile(join(companyRoot, '.autopilot', 'company.yaml'), 'name: test\nslug: test\n')
		await writeFile(join(companyRoot, '.autopilot', 'handlers', 'approve.ts'), APPROVE_HANDLER)
		dbResult = await createCompanyDb(companyRoot)
		process.env.AUTOPILOT_MASTER_KEY = '0'.repeat(64)
	})

	afterAll(async () => {
		dbResult.raw.close()
		await rm(companyRoot, { recursive: true, force: true })
		delete process.env.AUTOPILOT_MASTER_KEY
	})

	test('binding without session still routes task.approve', async () => {
		process.env.__TEST_SESSION_COMPAT_compat1 = 'compat-secret'
		const providers = new Map([['compat1', makeProvider('compat1', 'handlers/approve.ts')]])
		const taskService = new TaskService(dbResult.db)
		const runService = new RunService(dbResult.db)
		const activityService = new ActivityService(dbResult.db)
		const artifactService = new ArtifactService(dbResult.db)
		const bindingService = new ConversationBindingService(dbResult.db)

		const authoredConfig: AuthoredConfig = {
			company: { name: 'test', slug: 'test', description: '', timezone: 'UTC', language: 'en', owner: { name: '', email: '' }, defaults: {} },
			agents: new Map([['dev', { id: 'dev', name: 'Dev', role: 'developer', description: '' }]]),
			workflows: new Map([['review', {
				id: 'review', name: 'Review', description: '', steps: [
					{ id: 'work', type: 'agent', agent_id: 'dev', instructions: 'Do work' },
					{ id: 'review', type: 'human_approval' },
					{ id: 'done', type: 'done' },
				],
			}]]),
			environments: new Map(),
			providers,
			capabilityProfiles: new Map(),
			defaults: { runtime: 'claude-code', workflow: 'review', task_assignee: 'dev' },
		}

		const workflowEngine = new WorkflowEngine(authoredConfig, taskService, runService, activityService, artifactService)

		// Create task at human_approval
		const mat = await workflowEngine.materializeTask({ title: 'Compat test', type: 'feature', created_by: 'test' })
		const taskId = mat!.task.id
		await runService.start(mat!.runId!)
		await runService.complete(mat!.runId!, { status: 'completed', summary: 'Done' })
		await workflowEngine.advance(taskId)

		// Create ONLY a binding, NO session
		await bindingService.create({
			id: `bind-compat-${Date.now()}`,
			provider_id: 'compat1',
			external_conversation_id: 'conv-compat-1',
			mode: 'task_thread',
			task_id: taskId,
		})

		const services: Services = {
			taskService, runService,
			workerService: {} as any,
			enrollmentService: {} as any,
			activityService,
			artifactService,
			conversationBindingService: bindingService,
			sessionService: new SessionService(dbResult.db),
			queryService: new QueryService(dbResult.db),
			workflowEngine,
			taskRelationService: {} as any,
			taskGraphService: {} as any,
			secretService: new SecretService(dbResult.db),
		}

		const app = new Hono<AppEnv>()
		app.use('*', async (c, next) => {
			c.set('companyRoot', companyRoot)
			c.set('db', dbResult.db)
			c.set('auth', {} as never)
			c.set('services', services)
			c.set('authoredConfig', authoredConfig)
			c.set('actor', FAKE_ACTOR)
			c.set('workerId', null)
			await next()
		})
		app.route('/api/conversations', conversations)

		const res = await app.request(
			'/api/conversations/compat1',
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'x-provider-secret': 'compat-secret' },
				body: JSON.stringify({ conversation_id: 'conv-compat-1', text: '/approve' }),
			},
		)

		expect(res.status).toBe(200)
		const body = await res.json() as any
		expect(body.action).toBe('task.approved')

		// Task should be done
		const finalTask = await taskService.get(taskId)
		expect(finalTask!.status).toBe('done')

		delete process.env.__TEST_SESSION_COMPAT_compat1
	})
})
