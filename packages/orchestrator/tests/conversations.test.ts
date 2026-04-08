/**
 * Tests for conversation binding V1.
 *
 * Covers:
 * - ConversationResultSchema validation
 * - Binding service CRUD
 * - Inbound conversation route with provider-secret auth
 * - task.reply dispatches through workflow engine
 * - task.approve dispatches through workflow engine
 * - task.reject dispatches through workflow engine
 * - Unbound conversation returns 422
 * - Noop result handled cleanly
 * - Example text-conversation handler E2E
 */
import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Hono } from 'hono'
import { ConversationResultSchema } from '@questpie/autopilot-spec'
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
	SessionMessageService,
} from '../src/services'
import type { AuthoredConfig } from '../src/services'
import type { AppEnv, Services } from '../src/api/app'
import type { Actor } from '../src/auth/types'
import { conversations } from '../src/api/routes/conversations'
import { invokeProvider } from '../src/providers/handler-runtime'

// ─── Schema Tests ────────────────────────────────────────────────────────────

describe('ConversationResult Schema', () => {
	test('validates task.reply', () => {
		const r = ConversationResultSchema.safeParse({
			action: 'task.reply',
			conversation_id: 'conv-1',
			message: 'looks good, ship it',
		})
		expect(r.success).toBe(true)
	})

	test('validates task.approve', () => {
		const r = ConversationResultSchema.safeParse({
			action: 'task.approve',
			conversation_id: 'conv-1',
		})
		expect(r.success).toBe(true)
	})

	test('validates task.reject with message', () => {
		const r = ConversationResultSchema.safeParse({
			action: 'task.reject',
			conversation_id: 'conv-1',
			message: 'needs more tests',
		})
		expect(r.success).toBe(true)
	})

	test('validates noop', () => {
		const r = ConversationResultSchema.safeParse({
			action: 'noop',
			reason: 'empty text',
		})
		expect(r.success).toBe(true)
	})

	test('rejects unknown action', () => {
		const r = ConversationResultSchema.safeParse({
			action: 'task.delete',
			conversation_id: 'conv-1',
		})
		expect(r.success).toBe(false)
	})

	test('rejects task.reply without message', () => {
		const r = ConversationResultSchema.safeParse({
			action: 'task.reply',
			conversation_id: 'conv-1',
		})
		expect(r.success).toBe(false)
	})
})

// ─── Binding Service Tests ───────────────────────────────────────────────────

describe('ConversationBindingService', () => {
	const companyRoot = join(tmpdir(), `qp-conv-bind-${Date.now()}`)
	let dbResult: CompanyDbResult
	let service: ConversationBindingService

	beforeAll(async () => {
		await mkdir(join(companyRoot, '.autopilot'), { recursive: true })
		await writeFile(join(companyRoot, '.autopilot', 'company.yaml'), 'name: test\nslug: test\n')
		dbResult = await createCompanyDb(companyRoot)
		service = new ConversationBindingService(dbResult.db)
	})

	afterAll(async () => {
		dbResult.raw.close()
		await rm(companyRoot, { recursive: true, force: true })
	})

	test('create and get binding', async () => {
		const binding = await service.create({
			id: 'bind-1',
			provider_id: 'telegram-ops',
			external_conversation_id: 'chat-123',
			mode: 'task_thread',
			task_id: 'task-1',
		})
		expect(binding).toBeDefined()
		expect(binding!.provider_id).toBe('telegram-ops')
		expect(binding!.task_id).toBe('task-1')

		const fetched = await service.get('bind-1')
		expect(fetched).toBeDefined()
		expect(fetched!.id).toBe('bind-1')
	})

	test('findByExternal resolves binding', async () => {
		const found = await service.findByExternal('telegram-ops', 'chat-123')
		expect(found).toBeDefined()
		expect(found!.id).toBe('bind-1')
	})

	test('findByExternal with thread_id', async () => {
		await service.create({
			id: 'bind-2',
			provider_id: 'slack-ops',
			external_conversation_id: 'channel-1',
			external_thread_id: 'thread-42',
			mode: 'task_thread',
			task_id: 'task-2',
		})
		const found = await service.findByExternal('slack-ops', 'channel-1', 'thread-42')
		expect(found).toBeDefined()
		expect(found!.id).toBe('bind-2')
	})

	test('findByExternal returns undefined for unknown', async () => {
		const found = await service.findByExternal('unknown', 'unknown')
		expect(found).toBeUndefined()
	})

	test('findByExternal falls back to chat-level binding when thread_id not matched', async () => {
		// Create chat-level binding (no thread_id)
		const binding = await service.create({
			id: 'bind-fallback-chat',
			provider_id: 'tg-fallback',
			external_conversation_id: 'chat-500',
			mode: 'task_thread',
			task_id: 'task-fallback',
		})
		expect(binding).toBeDefined()

		// Verify it's findable without thread_id
		const direct = await service.findByExternal('tg-fallback', 'chat-500')
		expect(direct).toBeDefined()

		// Lookup with a thread_id that doesn't have its own binding
		// Should fall back to the chat-level binding
		const found = await service.findByExternal('tg-fallback', 'chat-500', 'msg-999')
		expect(found).toBeDefined()
		expect(found!.id).toBe('bind-fallback-chat')
		expect(found!.task_id).toBe('task-fallback')
	})

	test('findByExternal prefers exact thread match over chat-level fallback', async () => {
		// Create chat-level binding
		await service.create({
			id: 'bind-exact-chat',
			provider_id: 'tg-exact',
			external_conversation_id: 'chat-600',
			mode: 'task_thread',
			task_id: 'task-chat',
		})

		// Create thread-specific binding
		await service.create({
			id: 'bind-exact-thread',
			provider_id: 'tg-exact',
			external_conversation_id: 'chat-600',
			external_thread_id: 'thread-42',
			mode: 'task_thread',
			task_id: 'task-thread',
		})

		// Exact thread match should win
		const threadMatch = await service.findByExternal('tg-exact', 'chat-600', 'thread-42')
		expect(threadMatch).toBeDefined()
		expect(threadMatch!.id).toBe('bind-exact-thread')

		// Unknown thread should fall back to chat-level
		const chatFallback = await service.findByExternal('tg-exact', 'chat-600', 'other-thread')
		expect(chatFallback).toBeDefined()
		expect(chatFallback!.id).toBe('bind-exact-chat')
	})

	test('listForTask returns bindings', async () => {
		const bindings = await service.listForTask('task-1')
		expect(bindings.length).toBeGreaterThanOrEqual(1)
		expect(bindings[0]!.task_id).toBe('task-1')
	})
})

// ─── Inbound Conversation Route Tests ────────────────────────────────────────

describe('Inbound Conversation Route', () => {
	const companyRoot = join(tmpdir(), `qp-conv-route-${Date.now()}`)
	let dbResult: CompanyDbResult

	const FAKE_ACTOR: Actor = {
		id: 'test-user',
		type: 'human',
		name: 'Test',
		role: 'owner',
		source: 'api',
	}

	// Handler scripts
	const REPLY_HANDLER = `const input = await Bun.stdin.text()
const envelope = JSON.parse(input)
console.log(JSON.stringify({
  ok: true,
  metadata: {
    action: 'task.reply',
    conversation_id: envelope.payload.conversation_id,
    message: envelope.payload.text,
  },
}))`

	const APPROVE_HANDLER = `const input = await Bun.stdin.text()
const envelope = JSON.parse(input)
console.log(JSON.stringify({
  ok: true,
  metadata: {
    action: 'task.approve',
    conversation_id: envelope.payload.conversation_id,
  },
}))`

	const NOOP_HANDLER = `console.log(JSON.stringify({
  ok: true,
  metadata: { action: 'noop', reason: 'test' },
}))`

	const UNBOUND_HANDLER = `const input = await Bun.stdin.text()
console.log(JSON.stringify({
  ok: true,
  metadata: {
    action: 'task.reply',
    conversation_id: 'unknown-conv',
    message: 'hello',
  },
}))`

	const COMMAND_HANDLER = `const input = await Bun.stdin.text()
const envelope = JSON.parse(input)
console.log(JSON.stringify({
  ok: true,
  metadata: {
    action: 'conversation.command',
    conversation_id: envelope.payload.conversation_id,
    thread_id: envelope.payload.thread_id,
    command: envelope.payload.command,
    args: envelope.payload.args,
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
			secret_refs: [{ name: 'auth_secret', source: 'env', key: `__TEST_CONV_SECRET_${id}` }],
			description: '',
		}
	}

	function buildApp(providers: Map<string, Provider>, services: Services) {
		const authoredConfig: AuthoredConfig = {
			company: {
				name: 'test',
				slug: 'test',
				description: '',
				timezone: 'UTC',
				language: 'en',
				owner: { name: '', email: '' },
				defaults: {},
				conversation_commands: {
					build: {
						action: 'task.create',
						workflow_id: 'review',
						type: 'feature',
						title_template: '{{args}}',
						description_template: '{{args}}',
					},
				},
			},
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
			skills: new Map(),
			context: new Map(),
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
		process.env.AUTOPILOT_MASTER_KEY = '0'.repeat(64)
		await mkdir(join(companyRoot, '.autopilot', 'handlers'), { recursive: true })
		await writeFile(join(companyRoot, '.autopilot', 'company.yaml'), 'name: test\nslug: test\n')
		await writeFile(join(companyRoot, '.autopilot', 'handlers', 'reply.ts'), REPLY_HANDLER)
		await writeFile(join(companyRoot, '.autopilot', 'handlers', 'approve.ts'), APPROVE_HANDLER)
		await writeFile(join(companyRoot, '.autopilot', 'handlers', 'noop.ts'), NOOP_HANDLER)
		await writeFile(join(companyRoot, '.autopilot', 'handlers', 'unbound.ts'), UNBOUND_HANDLER)
		await writeFile(join(companyRoot, '.autopilot', 'handlers', 'command.ts'), COMMAND_HANDLER)
		dbResult = await createCompanyDb(companyRoot)
	})

	afterAll(async () => {
		dbResult.raw.close()
		await rm(companyRoot, { recursive: true, force: true })
		delete process.env.AUTOPILOT_MASTER_KEY
	})

	test('provider-secret auth rejects missing header', async () => {
		process.env.__TEST_CONV_SECRET_conv1 = 'my-secret'
		const providers = new Map([['conv1', makeProvider('conv1', 'handlers/reply.ts')]])
		const services = makeServices()
		const app = buildApp(providers, services)

		const res = await app.request('/api/conversations/conv1', post({ text: 'hello' }))
		expect(res.status).toBe(401)
		delete process.env.__TEST_CONV_SECRET_conv1
	})

	test('provider-secret auth rejects wrong secret', async () => {
		process.env.__TEST_CONV_SECRET_conv2 = 'correct-secret'
		const providers = new Map([['conv2', makeProvider('conv2', 'handlers/reply.ts')]])
		const services = makeServices()
		const app = buildApp(providers, services)

		const res = await app.request(
			'/api/conversations/conv2',
			post({ text: 'hello' }, { 'x-provider-secret': 'wrong-secret' }),
		)
		expect(res.status).toBe(401)
		delete process.env.__TEST_CONV_SECRET_conv2
	})

	test('provider-secret auth accepts correct secret via X-Provider-Secret', async () => {
		process.env.__TEST_CONV_SECRET_conv3 = 'valid-secret'
		const providers = new Map([['conv3', makeProvider('conv3', 'handlers/noop.ts')]])
		const services = makeServices()
		const app = buildApp(providers, services)

		const res = await app.request(
			'/api/conversations/conv3',
			post({ text: '' }, { 'x-provider-secret': 'valid-secret' }),
		)
		expect(res.status).toBe(200)
		const body = await res.json() as any
		expect(body.action).toBe('noop')
		delete process.env.__TEST_CONV_SECRET_conv3
	})

	test('provider-secret auth accepts Telegram webhook secret header', async () => {
		process.env.__TEST_CONV_SECRET_conv3b = 'tg-webhook-secret'
		const providers = new Map([['conv3b', makeProvider('conv3b', 'handlers/noop.ts')]])
		const services = makeServices()
		const app = buildApp(providers, services)

		const res = await app.request(
			'/api/conversations/conv3b',
			post({ text: '' }, { 'x-telegram-bot-api-secret-token': 'tg-webhook-secret' }),
		)
		expect(res.status).toBe(200)
		const body = await res.json() as any
		expect(body.action).toBe('noop')
		delete process.env.__TEST_CONV_SECRET_conv3b
	})

	test('unbound conversation returns 422', async () => {
		process.env.__TEST_CONV_SECRET_conv4 = 'secret-4'
		const providers = new Map([['conv4', makeProvider('conv4', 'handlers/unbound.ts')]])
		const services = makeServices()
		const app = buildApp(providers, services)

		const res = await app.request(
			'/api/conversations/conv4',
			post({ conversation_id: 'unknown-conv', text: 'hello' }, { 'x-provider-secret': 'secret-4' }),
		)
		expect(res.status).toBe(422)
		const body = await res.json() as any
		expect(body.error).toBe('unbound_conversation')
		delete process.env.__TEST_CONV_SECRET_conv4
	})

	test('task.reply dispatches through workflow engine', async () => {
		process.env.__TEST_CONV_SECRET_conv5 = 'secret-5'
		const providers = new Map([['conv5', makeProvider('conv5', 'handlers/reply.ts')]])
		const taskService = new TaskService(dbResult.db)
		const runService = new RunService(dbResult.db)
		const activityService = new ActivityService(dbResult.db)
		const bindingService = new ConversationBindingService(dbResult.db)
		const workflowEngine = new WorkflowEngine(
			{
				company: {} as any,
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
				defaults: { runtime: 'claude-code', workflow: 'review', task_assignee: 'dev' },
			},
			taskService, runService, activityService,
		)
		const services: Services = {
			taskService, runService,
			workerService: {} as any,
			enrollmentService: {} as any,
			activityService,
			artifactService: new ArtifactService(dbResult.db),
			conversationBindingService: bindingService,
			sessionService: new SessionService(dbResult.db),
			sessionMessageService: new SessionMessageService(dbResult.db),
			queryService: new QueryService(dbResult.db),
			secretService: new SecretService(dbResult.db),
			workflowEngine,
			taskRelationService: {} as any,
			taskGraphService: {} as any,
		}

		// Create a task at human_approval step
		const materialResult = await workflowEngine.materializeTask({
			title: 'Test task for reply',
			type: 'feature',
			created_by: 'test',
		})
		expect(materialResult).toBeDefined()
		const taskId = materialResult!.task.id

		// Complete the initial run to advance to review step
		const runId = materialResult!.runId!
		await runService.start(runId)
		await runService.complete(runId, { status: 'completed', summary: 'Done' })
		await workflowEngine.advance(taskId)

		// Verify task is now on review (human_approval) step
		const taskAfterAdvance = await taskService.get(taskId)
		expect(taskAfterAdvance!.workflow_step).toBe('review')
		expect(taskAfterAdvance!.status).toBe('blocked')

		// Create binding
		await bindingService.create({
			id: `bind-reply-${Date.now()}`,
			provider_id: 'conv5',
			external_conversation_id: 'conv-reply-1',
			mode: 'task_thread',
			task_id: taskId,
		})

		// Send reply through conversation route
		const app = buildApp(providers, services)
		const res = await app.request(
			'/api/conversations/conv5',
			post(
				{ conversation_id: 'conv-reply-1', text: 'Looks great, add more tests' },
				{ 'x-provider-secret': 'secret-5' },
			),
		)

		expect(res.status).toBe(200)
		const body = await res.json() as any
		expect(body.action).toBe('task.replied')

		delete process.env.__TEST_CONV_SECRET_conv5
	})

	test('task.approve dispatches through workflow engine', async () => {
		process.env.__TEST_CONV_SECRET_conv6 = 'secret-6'
		const providers = new Map([['conv6', makeProvider('conv6', 'handlers/approve.ts')]])
		const taskService = new TaskService(dbResult.db)
		const runService = new RunService(dbResult.db)
		const activityService = new ActivityService(dbResult.db)
		const bindingService = new ConversationBindingService(dbResult.db)
		const workflowEngine = new WorkflowEngine(
			{
				company: {} as any,
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
				defaults: { runtime: 'claude-code', workflow: 'review', task_assignee: 'dev' },
			},
			taskService, runService, activityService,
		)
		const services: Services = {
			taskService, runService,
			workerService: {} as any,
			enrollmentService: {} as any,
			activityService,
			artifactService: new ArtifactService(dbResult.db),
			conversationBindingService: bindingService,
			sessionService: new SessionService(dbResult.db),
			sessionMessageService: new SessionMessageService(dbResult.db),
			queryService: new QueryService(dbResult.db),
			secretService: new SecretService(dbResult.db),
			workflowEngine,
			taskRelationService: {} as any,
			taskGraphService: {} as any,
		}

		// Create task, advance to human_approval
		const mat = await workflowEngine.materializeTask({ title: 'Test approve', type: 'feature', created_by: 'test' })
		const taskId = mat!.task.id
		await runService.start(mat!.runId!)
		await runService.complete(mat!.runId!, { status: 'completed', summary: 'Done' })
		await workflowEngine.advance(taskId)

		// Create binding
		await bindingService.create({
			id: `bind-approve-${Date.now()}`,
			provider_id: 'conv6',
			external_conversation_id: 'conv-approve-1',
			mode: 'task_thread',
			task_id: taskId,
		})

		// Send approve
		const app = buildApp(providers, services)
		const res = await app.request(
			'/api/conversations/conv6',
			post(
				{ conversation_id: 'conv-approve-1', text: '/approve' },
				{ 'x-provider-secret': 'secret-6' },
			),
		)

		expect(res.status).toBe(200)
		const body = await res.json() as any
		expect(body.action).toBe('task.approved')

		// Task should have advanced past review
		const final = await taskService.get(taskId)
		expect(final!.status).toBe('done')

		delete process.env.__TEST_CONV_SECRET_conv6
	})

	test('rejects provider without auth_secret configured', async () => {
		const noAuthProvider: Provider = {
			id: 'no-auth',
			name: 'No Auth',
			kind: 'conversation_channel',
			handler: 'handlers/noop.ts',
			capabilities: [{ op: 'conversation.ingest' }],
			events: [],
			config: {},
			secret_refs: [], // No auth_secret
			description: '',
		}
		const providers = new Map([['no-auth', noAuthProvider]])
		const services = makeServices()
		const app = buildApp(providers, services)

		const res = await app.request(
			'/api/conversations/no-auth',
			post({ text: 'hello' }, { 'x-provider-secret': 'anything' }),
		)
		expect(res.status).toBe(403)
		const body = await res.json() as any
		expect(body.error).toContain('auth_secret')
	})

	test('binding creation rejects non-conversation_channel provider', async () => {
		const notifProvider: Provider = {
			id: 'notif-prov',
			name: 'Notif',
			kind: 'notification_channel',
			handler: 'handlers/noop.ts',
			capabilities: [{ op: 'notify.send' }],
			events: [],
			config: {},
			secret_refs: [],
			description: '',
		}
		const providers = new Map([['notif-prov', notifProvider]])
		const services = makeServices()
		const app = buildApp(providers, services)

		const res = await app.request(
			'/api/conversations/bindings',
			post({
				provider_id: 'notif-prov',
				external_conversation_id: 'conv-1',
				mode: 'task_thread',
				task_id: 'task-nonexistent',
			}),
		)
		expect(res.status).toBe(400)
		const body = await res.json() as any
		expect(body.error).toContain('not a conversation_channel')
	})

	test('binding creation rejects nonexistent task_id', async () => {
		process.env.__TEST_CONV_SECRET_conv7 = 'secret-7'
		const providers = new Map([['conv7', makeProvider('conv7', 'handlers/noop.ts')]])
		const services = makeServices()
		const app = buildApp(providers, services)

		const res = await app.request(
			'/api/conversations/bindings',
			post({
				provider_id: 'conv7',
				external_conversation_id: 'conv-1',
				mode: 'task_thread',
				task_id: 'task-does-not-exist',
			}),
		)
		expect(res.status).toBe(404)
		const body = await res.json() as any
		expect(body.error).toContain('Task not found')
		delete process.env.__TEST_CONV_SECRET_conv7
	})

	test('conversation.command is idempotent for same conversation thread', async () => {
		process.env.__TEST_CONV_SECRET_convcmd = 'secret-cmd'
		const providers = new Map([['convcmd', makeProvider('convcmd', 'handlers/command.ts')]])
		const taskService = new TaskService(dbResult.db)
		const runService = new RunService(dbResult.db)
		const activityService = new ActivityService(dbResult.db)
		const workflowEngine = new WorkflowEngine(
			{
				company: {} as any,
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
				defaults: { runtime: 'claude-code', workflow: 'review', task_assignee: 'dev' },
			},
			taskService, runService, activityService,
		)
		const services: Services = {
			taskService, runService,
			workerService: {} as any,
			enrollmentService: {} as any,
			activityService,
			artifactService: new ArtifactService(dbResult.db),
			conversationBindingService: new ConversationBindingService(dbResult.db),
			sessionService: new SessionService(dbResult.db),
			sessionMessageService: new SessionMessageService(dbResult.db),
			queryService: new QueryService(dbResult.db),
			secretService: new SecretService(dbResult.db),
			workflowEngine,
			taskRelationService: {} as any,
			taskGraphService: {} as any,
		}
		const app = buildApp(providers, services)

		const payload = {
			conversation_id: 'cmd-chat-1',
			thread_id: 'telegram-message-777',
			command: 'build',
			args: 'prepare demo note',
		}
		const headers = { 'x-provider-secret': 'secret-cmd' }
		const first = await app.request('/api/conversations/convcmd', post(payload, headers))
		const second = await app.request('/api/conversations/convcmd', post(payload, headers))

		expect(first.status).toBe(200)
		expect(second.status).toBe(200)
		const firstBody = await first.json() as any
		const secondBody = await second.json() as any
		expect(firstBody.action).toBe('task.created')
		expect(secondBody.action).toBe('task.created')
		expect(secondBody.existing).toBe(true)
		expect(secondBody.task_id).toBe(firstBody.task_id)

		const matchingTasks = (await taskService.list()).filter((task) => task.title === 'prepare demo note')
		expect(matchingTasks.length).toBe(1)

		delete process.env.__TEST_CONV_SECRET_convcmd
	})

	test('duplicate binding creation returns 409', async () => {
		process.env.__TEST_CONV_SECRET_conv8 = 'secret-8'
		const providers = new Map([['conv8', makeProvider('conv8', 'handlers/noop.ts')]])
		const taskService = new TaskService(dbResult.db)
		const bindingService = new ConversationBindingService(dbResult.db)

		// Create a task first
		await taskService.create({ id: 'task-dup-test', title: 'Dup test', type: 'feature', created_by: 'test' })

		// Create first binding
		await bindingService.create({
			id: 'bind-dup-1',
			provider_id: 'conv8',
			external_conversation_id: 'conv-dup',
			mode: 'task_thread',
			task_id: 'task-dup-test',
		})

		// Try to create duplicate via API
		const services: Services = {
			...makeServices(),
			conversationBindingService: bindingService,
			taskService,
		}
		const app = buildApp(providers, services)
		const res = await app.request(
			'/api/conversations/bindings',
			post({
				provider_id: 'conv8',
				external_conversation_id: 'conv-dup',
				mode: 'task_thread',
				task_id: 'task-dup-test',
			}),
		)
		expect(res.status).toBe(409)
		delete process.env.__TEST_CONV_SECRET_conv8
	})

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
			sessionMessageService: new SessionMessageService(dbResult.db),
			queryService: new QueryService(dbResult.db),
			secretService: new SecretService(dbResult.db),
			workflowEngine: {} as any,
			taskRelationService: {} as any,
			taskGraphService: {} as any,
		}
	}
})

// ─── Example Handler E2E ─────────────────────────────────────────────────────

describe('Text Conversation Handler E2E', () => {
	const testRoot = join(tmpdir(), `qp-text-conv-e2e-${Date.now()}`)

	const HANDLER_SRC = `
const envelope = await Bun.stdin.json();
const { op, payload } = envelope;

if (op === 'notify.send') {
  if (payload.conversation_id) {
    console.log(JSON.stringify({
      ok: true,
      metadata: {
        delivered: true,
        conversation_id: payload.conversation_id,
        thread_id: payload.thread_id,
        title: payload.title,
        preview_url: payload.preview_url,
      },
    }));
  } else {
    console.log(JSON.stringify({ ok: true, metadata: { skipped: true } }));
  }
} else if (op === 'conversation.ingest') {
  if (!payload.conversation_id || !payload.text) {
    console.log(JSON.stringify({ ok: true, metadata: { action: 'noop' } }));
  } else if (payload.text === '/approve') {
    console.log(JSON.stringify({ ok: true, metadata: { action: 'task.approve', conversation_id: payload.conversation_id } }));
  } else if (payload.text.startsWith('/reject ')) {
    console.log(JSON.stringify({ ok: true, metadata: { action: 'task.reject', conversation_id: payload.conversation_id, message: payload.text.slice('/reject '.length) } }));
  } else {
    console.log(JSON.stringify({ ok: true, metadata: { action: 'task.reply', message: payload.text, conversation_id: payload.conversation_id } }));
  }
} else {
  console.log(JSON.stringify({ ok: false, error: 'unknown op: ' + op }));
}
`

	beforeAll(async () => {
		await mkdir(join(testRoot, '.autopilot', 'handlers'), { recursive: true })
		await writeFile(join(testRoot, '.autopilot', 'handlers', 'text-conversation.ts'), HANDLER_SRC)
	})

	afterAll(async () => {
		await rm(testRoot, { recursive: true, force: true })
	})

	const provider: Provider = {
		id: 'text-conv',
		name: 'Text Conv',
		kind: 'conversation_channel',
		handler: 'handlers/text-conversation.ts',
		capabilities: [{ op: 'conversation.ingest' }],
		events: [],
		config: {},
		secret_refs: [],
		description: '',
	}

	test('/approve maps to task.approve', async () => {
		const result = await invokeProvider(
			provider, 'conversation.ingest',
			{ conversation_id: 'c1', text: '/approve' },
			{ companyRoot: testRoot },
		)
		expect(result.ok).toBe(true)
		const parsed = ConversationResultSchema.parse(result.metadata)
		expect(parsed.action).toBe('task.approve')
		if (parsed.action === 'task.approve') {
			expect(parsed.conversation_id).toBe('c1')
		}
	})

	test('/reject with reason maps to task.reject', async () => {
		const result = await invokeProvider(
			provider, 'conversation.ingest',
			{ conversation_id: 'c1', text: '/reject needs more tests' },
			{ companyRoot: testRoot },
		)
		expect(result.ok).toBe(true)
		const parsed = ConversationResultSchema.parse(result.metadata)
		expect(parsed.action).toBe('task.reject')
		if (parsed.action === 'task.reject') {
			expect(parsed.message).toBe('needs more tests')
		}
	})

	test('regular text maps to task.reply', async () => {
		const result = await invokeProvider(
			provider, 'conversation.ingest',
			{ conversation_id: 'c1', text: 'looks good, ship it' },
			{ companyRoot: testRoot },
		)
		expect(result.ok).toBe(true)
		const parsed = ConversationResultSchema.parse(result.metadata)
		expect(parsed.action).toBe('task.reply')
		if (parsed.action === 'task.reply') {
			expect(parsed.message).toBe('looks good, ship it')
		}
	})

	test('empty text returns noop', async () => {
		const result = await invokeProvider(
			provider, 'conversation.ingest',
			{ conversation_id: 'c1', text: '' },
			{ companyRoot: testRoot },
		)
		expect(result.ok).toBe(true)
		const parsed = ConversationResultSchema.parse(result.metadata)
		expect(parsed.action).toBe('noop')
	})

	test('missing conversation_id returns noop', async () => {
		const result = await invokeProvider(
			provider, 'conversation.ingest',
			{ text: 'hello' },
			{ companyRoot: testRoot },
		)
		expect(result.ok).toBe(true)
		const parsed = ConversationResultSchema.parse(result.metadata)
		expect(parsed.action).toBe('noop')
	})
})
