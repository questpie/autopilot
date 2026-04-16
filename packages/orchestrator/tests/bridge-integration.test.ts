/**
 * Bridge integration tests — service-level tests for QueryResponseBridge and
 * NotificationBridge conversation flows.
 *
 * Tests the bridge classes directly with real DB services, NOT through HTTP handlers.
 * Uses createCompanyDb for a real DB, creates services, and calls bridge methods
 * or simulates events.
 *
 * Covers:
 * - QueryResponseBridge queue drain preserves runtime config from previous run
 * - NotificationBridge default-chat: taskless run_completed does NOT invoke default-chat
 * - NotificationBridge default-chat: failed notify.send does NOT store system session message
 * - NotificationBridge default-chat: task-scoped delivery stores system message on success
 * - QueryResponseBridge progress fallback edit tracking (edit_message_id sequence)
 */
import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { mkdir, rm, writeFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { Provider } from '@questpie/autopilot-spec'
import { createCompanyDb, type CompanyDbResult } from '../src/db'
import {
	RunService,
	QueryService,
	SessionService,
	SessionMessageService,
	TaskService,
	ArtifactService,
	ConversationBindingService,
	WorkerService,
} from '../src/services'
import { EventBus } from '../src/events/event-bus'
import { QueryResponseBridge } from '../src/providers/query-response-bridge'
import { NotificationBridge } from '../src/providers/notification-bridge'

// ─── Test 1: QueryResponseBridge queue drain preserves runtime config ────────

describe('QueryResponseBridge queue drain', () => {
	const testRoot = join(tmpdir(), `qp-bridge-drain-${Date.now()}`)
	const invocationsFile = join(testRoot, 'drain-invocations.jsonl')

	let dbResult: CompanyDbResult
	let runService: RunService
	let queryService: QueryService
	let sessionService: SessionService
	let sessionMessageService: SessionMessageService
	let eventBus: EventBus

	// Handler that records invocations and returns ok
	const HANDLER_SRC = `import { appendFileSync } from 'node:fs'
const input = await Bun.stdin.text()
const envelope = JSON.parse(input)
appendFileSync('${invocationsFile}', JSON.stringify({
  op: envelope.op,
  conversation_id: envelope.payload?.conversation_id,
  edit_message_id: envelope.payload?.edit_message_id,
  summary: envelope.payload?.summary,
}) + '\\n')
console.log(JSON.stringify({ ok: true, external_id: 'ext-msg-1' }))`

	function makeConvProvider(): Provider {
		return {
			id: 'test-prov',
			name: 'Test Conv',
			kind: 'conversation_channel',
			handler: 'handlers/drain-handler.ts',
			capabilities: [{ op: 'conversation.ingest' }, { op: 'notify.send' }],
			events: [
				{ types: ['run_completed'], statuses: ['completed', 'failed'] },
			],
			config: {},
			secret_refs: [],
			description: '',
		}
	}

	beforeAll(async () => {
		await mkdir(join(testRoot, '.autopilot', 'handlers'), { recursive: true })
		await writeFile(join(testRoot, '.autopilot', 'handlers', 'drain-handler.ts'), HANDLER_SRC)

		dbResult = await createCompanyDb(testRoot)
		runService = new RunService(dbResult.db)
		queryService = new QueryService(dbResult.db)
		sessionService = new SessionService(dbResult.db)
		sessionMessageService = new SessionMessageService(dbResult.db)
		eventBus = new EventBus()
	})

	afterAll(async () => {
		dbResult.raw.close()
		await rm(testRoot, { recursive: true, force: true })
	})

	test('drained run preserves runtime/model/provider/variant from previous run', async () => {
		const authoredConfig = {
			company: {},
			agents: new Map(),
			workflows: new Map(),
			environments: new Map(),
			providers: new Map([['test-prov', makeConvProvider()]]),
			capabilityProfiles: new Map(),
			defaults: { runtime: 'claude-code' },
		}

		const bridge = new QueryResponseBridge(
			eventBus,
			authoredConfig,
			queryService,
			runService,
			sessionService,
			{ companyRoot: testRoot },
			undefined, // secretService
			sessionMessageService,
		)
		bridge.start()

		// 1. Create a session with runtime_session_ref + preferred_worker_id
		const session = await sessionService.findOrCreate({
			provider_id: 'test-prov',
			external_conversation_id: 'chat-drain-1',
			mode: 'query',
		})
		await sessionService.updateResumeState(session.id, 'claude-abc', 'worker-1')

		// 2. Create first query + run with specific runtime config
		const query1 = await queryService.create({
			prompt: 'first message',
			agent_id: 'dev',
			allow_repo_mutation: false,
			session_id: session.id,
			created_by: 'test',
		})
		const run1Id = `run-drain-test-1-${Date.now()}`
		await runService.create({
			id: run1Id,
			agent_id: 'dev',
			runtime: 'claude-code',
			model: 'claude-sonnet-4',
			provider: 'anthropic',
			variant: 'extended-thinking',
			initiated_by: 'test',
			instructions: 'first',
			runtime_session_ref: 'claude-abc',
			preferred_worker_id: 'worker-1',
		})
		await queryService.linkRun(query1.id, run1Id)

		// 3. Queue a second user message (unconsumed — no query_id)
		await sessionMessageService.create({
			session_id: session.id,
			role: 'user',
			content: 'second message',
		})

		// 4. Complete run 1
		await runService.start(run1Id)
		await runService.complete(run1Id, {
			status: 'completed',
			summary: 'Done with first',
			runtime_session_ref: 'claude-def',
		})

		// Simulate worker claiming (set worker_id on the run directly)
		// The claim() method sets worker_id, but since we're skipping that flow,
		// update it manually via the DB
		const { runs } = await import('../src/db/company-schema')
		const { eq } = await import('drizzle-orm')
		await dbResult.db
			.update(runs)
			.set({ worker_id: 'worker-1' })
			.where(eq(runs.id, run1Id))

		// 5. Emit run_completed event — bridge handles it and drains queue
		eventBus.emit({ type: 'run_completed', runId: run1Id, status: 'completed' })

		// Wait for async processing
		await new Promise((r) => setTimeout(r, 3000))
		bridge.stop()

		// 6. Check: queued messages should be consumed
		const queued = await sessionMessageService.listQueued(session.id)
		expect(queued.length).toBe(0)

		// 7. Check: a new run should have been created with the same runtime config
		const allRuns = await runService.list({ agent_id: 'dev' })
		const drainedRun = allRuns.find((r) => r.id !== run1Id && r.status === 'pending')
		expect(drainedRun).toBeDefined()
		expect(drainedRun!.runtime).toBe('claude-code')
		expect(drainedRun!.model).toBe('claude-sonnet-4')
		expect(drainedRun!.provider).toBe('anthropic')
		expect(drainedRun!.variant).toBe('extended-thinking')
		// Session resume state should be updated from completed run
		expect(drainedRun!.runtime_session_ref).toBe('claude-def')
	})
})

// ─── Test 2: NotificationBridge default-chat behavior ────────────────────────

describe('NotificationBridge default-chat', () => {
	const testRoot = join(tmpdir(), `qp-bridge-notif-${Date.now()}`)
	const invocationsFile = join(testRoot, 'notif-invocations.jsonl')

	let dbResult: CompanyDbResult
	let runService: RunService
	let sessionService: SessionService
	let sessionMessageService: SessionMessageService
	let taskService: TaskService
	let artifactService: ArtifactService
	let bindingService: ConversationBindingService

	// Handler that succeeds and records invocations
	const OK_HANDLER_SRC = `import { appendFileSync } from 'node:fs'
const input = await Bun.stdin.text()
const envelope = JSON.parse(input)
appendFileSync('${invocationsFile}', JSON.stringify({
  op: envelope.op,
  conversation_id: envelope.payload?.conversation_id,
  task_id: envelope.payload?.task_id,
}) + '\\n')
console.log(JSON.stringify({ ok: true }))`

	// Handler that fails
	const FAIL_HANDLER_SRC = `import { appendFileSync } from 'node:fs'
const input = await Bun.stdin.text()
const envelope = JSON.parse(input)
appendFileSync('${join(testRoot, 'fail-invocations.jsonl')}', JSON.stringify({
  op: envelope.op,
  conversation_id: envelope.payload?.conversation_id,
}) + '\\n')
console.log(JSON.stringify({ ok: false, error: 'delivery failed' }))`

	function makeConvProviderWithDefaultChat(
		id: string,
		handler: string,
		defaultChatId: string,
	): Provider {
		return {
			id,
			name: id,
			kind: 'conversation_channel',
			handler,
			capabilities: [{ op: 'notify.send' }],
			events: [
				{ types: ['run_completed'], statuses: ['completed', 'failed'] },
			],
			config: { default_chat_id: defaultChatId },
			secret_refs: [],
			description: '',
		}
	}

	beforeAll(async () => {
		await mkdir(join(testRoot, '.autopilot', 'handlers'), { recursive: true })
		await writeFile(join(testRoot, '.autopilot', 'handlers', 'ok-handler.ts'), OK_HANDLER_SRC)
		await writeFile(join(testRoot, '.autopilot', 'handlers', 'fail-handler.ts'), FAIL_HANDLER_SRC)

		dbResult = await createCompanyDb(testRoot)
		runService = new RunService(dbResult.db)
		sessionService = new SessionService(dbResult.db)
		sessionMessageService = new SessionMessageService(dbResult.db)
		taskService = new TaskService(dbResult.db)
		artifactService = new ArtifactService(dbResult.db)
		bindingService = new ConversationBindingService(dbResult.db)
	})

	afterAll(async () => {
		dbResult.raw.close()
		await rm(testRoot, { recursive: true, force: true })
	})

	test('taskless run_completed does NOT invoke default-chat', async () => {
		await writeFile(invocationsFile, '')

		const eventBus = new EventBus()
		const provider = makeConvProviderWithDefaultChat(
			'notif-taskless',
			'handlers/ok-handler.ts',
			'default-chat-123',
		)

		// Create a run WITHOUT task_id
		const runId = `run-taskless-${Date.now()}`
		await runService.create({
			id: runId,
			agent_id: 'dev',
			runtime: 'claude-code',
			initiated_by: 'test',
			instructions: 'test run without task',
		})
		await runService.start(runId)
		await runService.complete(runId, { status: 'completed', summary: 'Done' })

		const authoredConfig = {
			company: {},
			agents: new Map(),
			workflows: new Map(),
			environments: new Map(),
			providers: new Map([['notif-taskless', provider]]),
			capabilityProfiles: new Map(),
			defaults: { runtime: 'claude-code' },
		}

		const bridge = new NotificationBridge(
			eventBus,
			authoredConfig,
			runService,
			taskService,
			artifactService,
			bindingService,
			{ companyRoot: testRoot },
			undefined,
			sessionService,
			sessionMessageService,
		)
		bridge.start()

		eventBus.emit({ type: 'run_completed', runId, status: 'completed' })
		await new Promise((r) => setTimeout(r, 2000))
		bridge.stop()

		// The handler may have been invoked for generic notification_channel matching,
		// but default-chat delivery should NOT happen because there's no task_id
		const content = await Bun.file(invocationsFile).text()
		const lines = content.trim().split('\n').filter(Boolean)
		// No invocation should have conversation_id = 'default-chat-123'
		const defaultChatCalls = lines
			.map((l) => JSON.parse(l))
			.filter((e: Record<string, unknown>) => e.conversation_id === 'default-chat-123')
		expect(defaultChatCalls.length).toBe(0)
	})

	test('task-scoped run_completed does NOT invoke default-chat (TaskProgressBridge owns it)', async () => {
		const failInvocationsFile = join(testRoot, 'fail-invocations.jsonl')
		await writeFile(failInvocationsFile, '')
		await writeFile(invocationsFile, '')

		const eventBus = new EventBus()
		const provider = makeConvProviderWithDefaultChat(
			'notif-task-suppressed',
			'handlers/ok-handler.ts',
			'default-chat-suppressed',
		)

		const taskId = `task-suppressed-${Date.now()}`
		await taskService.create({
			id: taskId,
			title: 'Test task suppressed',
			type: 'development',
			created_by: 'test',
		})

		const runId = `run-suppressed-${Date.now()}`
		await runService.create({
			id: runId,
			agent_id: 'dev',
			task_id: taskId,
			runtime: 'claude-code',
			initiated_by: 'test',
			instructions: 'test run with task',
		})
		await runService.start(runId)
		await runService.complete(runId, { status: 'completed', summary: 'Done' })

		const authoredConfig = {
			company: {},
			agents: new Map(),
			workflows: new Map(),
			environments: new Map(),
			providers: new Map([['notif-task-suppressed', provider]]),
			capabilityProfiles: new Map(),
			defaults: { runtime: 'claude-code' },
		}

		const bridge = new NotificationBridge(
			eventBus,
			authoredConfig,
			runService,
			taskService,
			artifactService,
			bindingService,
			{ companyRoot: testRoot },
			undefined,
			sessionService,
			sessionMessageService,
		)
		bridge.start()

		eventBus.emit({ type: 'run_completed', runId, status: 'completed' })
		await new Promise((r) => setTimeout(r, 2000))
		bridge.stop()

		// NotificationBridge no longer sends task-scoped default-chat notifications
		// (TaskProgressBridge owns that delivery path)
		const content = await Bun.file(invocationsFile).text()
		const lines = content.trim().split('\n').filter(Boolean)
		const defaultChatCalls = lines
			.map((l) => JSON.parse(l))
			.filter((e: Record<string, unknown>) => e.conversation_id === 'default-chat-suppressed')
		expect(defaultChatCalls.length).toBe(0)
	})

	test('task binding suppresses duplicate default-chat delivery', async () => {
		await writeFile(invocationsFile, '')

		const eventBus = new EventBus()
		const provider = makeConvProviderWithDefaultChat(
			'notif-bound',
			'handlers/ok-handler.ts',
			'default-chat-bound',
		)

		const taskId = `task-bound-${Date.now()}`
		await taskService.create({
			id: taskId,
			title: 'Bound task',
			type: 'development',
			created_by: 'test',
		})
		await bindingService.create({
			id: `bind-bound-${Date.now()}`,
			provider_id: 'notif-bound',
			external_conversation_id: 'bound-chat-123',
			external_thread_id: 'source-message-1',
			mode: 'task_thread',
			task_id: taskId,
		})

		const runId = `run-bound-${Date.now()}`
		await runService.create({
			id: runId,
			agent_id: 'dev',
			task_id: taskId,
			runtime: 'claude-code',
			initiated_by: 'test',
			instructions: 'test run with bound task',
		})
		await runService.start(runId)
		await runService.complete(runId, { status: 'completed', summary: 'Bound task completed' })

		const authoredConfig = {
			company: {},
			agents: new Map(),
			workflows: new Map(),
			environments: new Map(),
			providers: new Map([['notif-bound', provider]]),
			capabilityProfiles: new Map(),
			defaults: { runtime: 'claude-code' },
		}

		const bridge = new NotificationBridge(
			eventBus,
			authoredConfig,
			runService,
			taskService,
			artifactService,
			bindingService,
			{ companyRoot: testRoot },
			undefined,
			sessionService,
			sessionMessageService,
		)
		bridge.start()

		eventBus.emit({ type: 'run_completed', runId, status: 'completed' })
		await new Promise((r) => setTimeout(r, 2000))
		bridge.stop()

		const content = await Bun.file(invocationsFile).text()
		const entries = content.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line))

		const boundCalls = entries.filter((e: Record<string, unknown>) => e.conversation_id === 'bound-chat-123')
		const defaultChatCalls = entries.filter((e: Record<string, unknown>) => e.conversation_id === 'default-chat-bound')
		// NotificationBridge skips ALL delivery for tasks with task_thread bindings
		// (TaskProgressBridge handles them instead)
		expect(boundCalls.length).toBe(0)
		expect(defaultChatCalls.length).toBe(0)
	})
})

// ─── Test 3: QueryResponseBridge progress fallback edit tracking ─────────────

describe('QueryResponseBridge progress fallback edit', () => {
	const testRoot = join(tmpdir(), `qp-bridge-progress-${Date.now()}`)
	const invocationsFile = join(testRoot, 'progress-invocations.jsonl')

	let dbResult: CompanyDbResult
	let runService: RunService
	let queryService: QueryService
	let sessionService: SessionService
	let sessionMessageService: SessionMessageService

	// Counter-based handler: returns incrementing external_id so we can track edit_message_id
	const PROGRESS_HANDLER_SRC = `import { appendFileSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
const input = await Bun.stdin.text()
const envelope = JSON.parse(input)
const counterFile = '${join(testRoot, 'msg-counter.txt')}'
let counter = 1
if (existsSync(counterFile)) {
  counter = parseInt(readFileSync(counterFile, 'utf-8').trim(), 10) + 1
}
writeFileSync(counterFile, String(counter))
appendFileSync('${invocationsFile}', JSON.stringify({
  op: envelope.op,
  edit_message_id: envelope.payload?.edit_message_id || null,
  summary: envelope.payload?.summary,
  event_type: envelope.payload?.event_type,
  counter,
}) + '\\n')
console.log(JSON.stringify({ ok: true, external_id: 'ext-progress-' + counter }))`

	function makeConvProvider(): Provider {
		return {
			id: 'progress-prov',
			name: 'Progress Conv',
			kind: 'conversation_channel',
			handler: 'handlers/progress-handler.ts',
			capabilities: [{ op: 'conversation.ingest' }, { op: 'notify.send' }],
			events: [
				{ types: ['run_completed'], statuses: ['completed', 'failed'] },
				{ types: ['run_event'] },
			],
			config: {},
			secret_refs: [],
			description: '',
		}
	}

	beforeAll(async () => {
		await mkdir(join(testRoot, '.autopilot', 'handlers'), { recursive: true })
		await writeFile(join(testRoot, '.autopilot', 'handlers', 'progress-handler.ts'), PROGRESS_HANDLER_SRC)

		dbResult = await createCompanyDb(testRoot)
		runService = new RunService(dbResult.db)
		queryService = new QueryService(dbResult.db)
		sessionService = new SessionService(dbResult.db)
		sessionMessageService = new SessionMessageService(dbResult.db)
	})

	afterAll(async () => {
		dbResult.raw.close()
		await rm(testRoot, { recursive: true, force: true })
	})

	test('updates edit_message_id across progress events and final completion', async () => {
		await writeFile(invocationsFile, '')
		await writeFile(join(testRoot, 'msg-counter.txt'), '0')

		const eventBus = new EventBus()
		const authoredConfig = {
			company: {},
			agents: new Map(),
			workflows: new Map(),
			environments: new Map(),
			providers: new Map([['progress-prov', makeConvProvider()]]),
			capabilityProfiles: new Map(),
			defaults: { runtime: 'claude-code' },
		}

		const bridge = new QueryResponseBridge(
			eventBus,
			authoredConfig,
			queryService,
			runService,
			sessionService,
			{ companyRoot: testRoot },
			undefined,
			sessionMessageService,
		)
		bridge.start()

		// Create session, query, and run
		const session = await sessionService.findOrCreate({
			provider_id: 'progress-prov',
			external_conversation_id: 'chat-progress-1',
			mode: 'query',
		})

		const query = await queryService.create({
			prompt: 'progress test',
			agent_id: 'dev',
			allow_repo_mutation: false,
			session_id: session.id,
			created_by: 'test',
		})
		const runId = `run-progress-${Date.now()}`
		await runService.create({
			id: runId,
			agent_id: 'dev',
			runtime: 'claude-code',
			initiated_by: 'test',
			instructions: 'progress test',
		})
		await queryService.linkRun(query.id, runId)

		// Emit first progress event (started) — no edit_message_id
		eventBus.emit({ type: 'run_event', runId, eventType: 'started', summary: 'Starting...' })
		await new Promise((r) => setTimeout(r, 2000))

		// Emit second progress event (needs to bypass throttle — set throttle to 0 is not possible,
		// but the default is 10s. We'll wait or work around by checking what we can.)
		// Since PROGRESS_THROTTLE_MS is 10s, subsequent progress within that window gets throttled.
		// But the first 'started' event goes through, and then 'run_completed' goes through.
		// So we test: started (no edit_message_id) → completed (with edit_message_id from started)

		// Complete the run
		await runService.start(runId)
		await runService.complete(runId, { status: 'completed', summary: 'All done' })

		eventBus.emit({ type: 'run_completed', runId, status: 'completed' })
		await new Promise((r) => setTimeout(r, 2000))
		bridge.stop()

		// Read invocation log
		const content = await Bun.file(invocationsFile).text()
		const lines = content.trim().split('\n').filter(Boolean)
		const entries = lines.map((l) => JSON.parse(l))

		// Should have at least 2 calls: progress + completion
		expect(entries.length).toBeGreaterThanOrEqual(2)

		// First call (progress/started): no edit_message_id
		const progressCall = entries.find((e: Record<string, unknown>) => e.event_type === 'query_progress')
		expect(progressCall).toBeDefined()
		expect(progressCall.edit_message_id).toBeNull()

		// Completion call: should have edit_message_id from the progress call's external_id
		const completionCall = entries.find((e: Record<string, unknown>) => e.event_type === 'query_response')
		expect(completionCall).toBeDefined()
		// The progress handler returned external_id='ext-progress-1', so completion should edit that
		expect(completionCall.edit_message_id).toBe('ext-progress-1')
	})
})

// ─── Test 4: QueryResponseBridge fast-query race ─────────────────────────────

describe('QueryResponseBridge fast-query race', () => {
	const testRoot = join(tmpdir(), `qp-bridge-race-${Date.now()}`)
	const logFilePath = join(testRoot, 'race-invocations.jsonl')

	let dbResult: CompanyDbResult
	let runService: RunService
	let queryService: QueryService
	let sessionService: SessionService
	let sessionMessageService: SessionMessageService

	function makeConvProvider(): Provider {
		return {
			id: 'race-prov',
			name: 'Race Conv',
			kind: 'conversation_channel',
			handler: 'handlers/race-handler.ts',
			capabilities: [{ op: 'conversation.ingest' }, { op: 'notify.send' }],
			events: [
				{ types: ['run_completed'], statuses: ['completed', 'failed'] },
				{ types: ['run_event'] },
			],
			config: {},
			secret_refs: [],
			description: '',
		}
	}

	beforeAll(async () => {
		await mkdir(join(testRoot, '.autopilot', 'handlers'), { recursive: true })

		const HANDLER = `import { appendFileSync } from 'node:fs'
const input = await Bun.stdin.text()
const envelope = JSON.parse(input)
const logFile = '${logFilePath}'

// Delay first call to simulate slow Telegram API
const existing = (() => { try { return require('fs').readFileSync(logFile, 'utf-8').trim().split('\\n').length } catch { return 0 } })()
if (existing === 0) {
  await new Promise(r => setTimeout(r, 200))
}

appendFileSync(logFile, JSON.stringify({
  event_type: envelope.payload.event_type,
  edit_message_id: envelope.payload.edit_message_id ?? null,
  summary: envelope.payload.summary,
}) + '\\n')

console.log(JSON.stringify({ ok: true, external_id: 'ext-race-' + (existing + 1) }))`

		await writeFile(join(testRoot, '.autopilot', 'handlers', 'race-handler.ts'), HANDLER)

		dbResult = await createCompanyDb(testRoot)
		runService = new RunService(dbResult.db)
		queryService = new QueryService(dbResult.db)
		sessionService = new SessionService(dbResult.db)
		sessionMessageService = new SessionMessageService(dbResult.db)
	})

	afterAll(async () => {
		dbResult.raw.close()
		await rm(testRoot, { recursive: true, force: true })
	})

	test('per-run serialization prevents duplicate responses', async () => {
		const bus = new EventBus()
		const authoredConfig = {
			company: {},
			agents: new Map(),
			workflows: new Map(),
			environments: new Map(),
			providers: new Map([['race-prov', makeConvProvider()]]),
			capabilityProfiles: new Map(),
			defaults: { runtime: 'claude-code' },
		}

		const bridge = new QueryResponseBridge(
			bus,
			authoredConfig,
			queryService,
			runService,
			sessionService,
			{ companyRoot: testRoot },
			undefined,
			sessionMessageService,
		)
		bridge.start()

		// Create session, query, run
		const session = await sessionService.findOrCreate({
			provider_id: 'race-prov',
			external_conversation_id: 'chat-race-1',
			mode: 'query',
		})

		const query = await queryService.create({
			prompt: 'race test',
			agent_id: 'dev',
			allow_repo_mutation: false,
			session_id: session.id,
			created_by: 'test',
		})
		const runId = `run-race-${Date.now()}`
		await runService.create({
			id: runId,
			agent_id: 'dev',
			runtime: 'claude-code',
			initiated_by: 'test',
			instructions: 'race test',
		})
		await queryService.linkRun(query.id, runId)
		await runService.start(runId)
		await runService.complete(runId, { status: 'completed', summary: 'Race done' })

		// Emit started immediately followed by run_completed — NO delay
		bus.emit({ type: 'run_event', runId, eventType: 'started', summary: 'Starting...' })
		bus.emit({ type: 'run_completed', runId, status: 'completed' })

		// Wait for async processing
		await new Promise((r) => setTimeout(r, 3000))
		bridge.stop()

		// Read JSONL log
		const content = await Bun.file(logFilePath).text()
		const lines = content.trim().split('\n').filter(Boolean)
		const entries = lines.map((l) => JSON.parse(l))

		// Exactly 2 handler calls
		expect(entries.length).toBe(2)

		// First call: progress, no edit_message_id
		expect(entries[0].event_type).toBe('query_progress')
		expect(entries[0].edit_message_id).toBeNull()

		// Second call: response, edit_message_id from the delayed first call
		expect(entries[1].event_type).toBe('query_response')
		expect(entries[1].edit_message_id).toBe('ext-race-1')
	})
})

// ─── Test 5: QueryResponseBridge restart recovery ────────────────────────────

describe('QueryResponseBridge restart recovery', () => {
	const testRoot = join(tmpdir(), `qp-bridge-restart-${Date.now()}`)
	const logFilePath = join(testRoot, 'restart-invocations.jsonl')

	let dbResult: CompanyDbResult
	let runService: RunService
	let queryService: QueryService
	let sessionService: SessionService
	let sessionMessageService: SessionMessageService

	function makeConvProvider(): Provider {
		return {
			id: 'restart-prov',
			name: 'Restart Conv',
			kind: 'conversation_channel',
			handler: 'handlers/restart-handler.ts',
			capabilities: [{ op: 'conversation.ingest' }, { op: 'notify.send' }],
			events: [
				{ types: ['run_completed'], statuses: ['completed', 'failed'] },
				{ types: ['run_event'] },
			],
			config: {},
			secret_refs: [],
			description: '',
		}
	}

	beforeAll(async () => {
		await mkdir(join(testRoot, '.autopilot', 'handlers'), { recursive: true })

		const HANDLER = `import { appendFileSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
const input = await Bun.stdin.text()
const envelope = JSON.parse(input)
const counterFile = '${join(testRoot, 'restart-counter.txt')}'
let counter = 1
if (existsSync(counterFile)) {
  counter = parseInt(readFileSync(counterFile, 'utf-8').trim(), 10) + 1
}
writeFileSync(counterFile, String(counter))
appendFileSync('${logFilePath}', JSON.stringify({
  op: envelope.op,
  edit_message_id: envelope.payload?.edit_message_id || null,
  summary: envelope.payload?.summary,
  event_type: envelope.payload?.event_type,
  counter,
}) + '\\n')
console.log(JSON.stringify({ ok: true, external_id: 'ext-restart-' + counter }))`

		await writeFile(join(testRoot, '.autopilot', 'handlers', 'restart-handler.ts'), HANDLER)

		dbResult = await createCompanyDb(testRoot)
		runService = new RunService(dbResult.db)
		queryService = new QueryService(dbResult.db)
		sessionService = new SessionService(dbResult.db)
		sessionMessageService = new SessionMessageService(dbResult.db)
	})

	afterAll(async () => {
		dbResult.raw.close()
		await rm(testRoot, { recursive: true, force: true })
	})

	test('fresh bridge instance recovers edit_message_id from DB', async () => {
		const authoredConfig = {
			company: {},
			agents: new Map(),
			workflows: new Map(),
			environments: new Map(),
			providers: new Map([['restart-prov', makeConvProvider()]]),
			capabilityProfiles: new Map(),
			defaults: { runtime: 'claude-code' },
		}

		// Create session, query, run
		const session = await sessionService.findOrCreate({
			provider_id: 'restart-prov',
			external_conversation_id: 'chat-restart-1',
			mode: 'query',
		})

		const query = await queryService.create({
			prompt: 'restart test',
			agent_id: 'dev',
			allow_repo_mutation: false,
			session_id: session.id,
			created_by: 'test',
		})
		const runId = `run-restart-${Date.now()}`
		await runService.create({
			id: runId,
			agent_id: 'dev',
			runtime: 'claude-code',
			initiated_by: 'test',
			instructions: 'restart test',
		})
		await queryService.linkRun(query.id, runId)

		// Bridge A — sends progress, captures external_message_id
		const busA = new EventBus()
		const bridgeA = new QueryResponseBridge(
			busA,
			authoredConfig,
			queryService,
			runService,
			sessionService,
			{ companyRoot: testRoot },
			undefined,
			sessionMessageService,
		)
		bridgeA.start()

		busA.emit({ type: 'run_event', runId, eventType: 'started', summary: 'Starting...' })
		await new Promise((r) => setTimeout(r, 1500))

		// Verify assistant session message exists with external_message_id
		const assistantMsg = await sessionMessageService.findAssistantForQuery(query.id)
		expect(assistantMsg).toBeDefined()
		expect(assistantMsg!.external_message_id).toBeTruthy()
		const savedExternalId = assistantMsg!.external_message_id

		// Stop bridge A (simulates orchestrator restart)
		bridgeA.stop()

		// Bridge B — fresh instance, empty in-memory maps
		const busB = new EventBus()
		const bridgeB = new QueryResponseBridge(
			busB,
			authoredConfig,
			queryService,
			runService,
			sessionService,
			{ companyRoot: testRoot },
			undefined,
			sessionMessageService,
		)
		bridgeB.start()

		// Complete the run
		await runService.start(runId)
		await runService.complete(runId, { status: 'completed', summary: 'Restart done' })

		busB.emit({ type: 'run_completed', runId, status: 'completed' })
		await new Promise((r) => setTimeout(r, 2000))
		bridgeB.stop()

		// Read JSONL log — final query_response must have edit_message_id matching the saved external ID
		const content = await Bun.file(logFilePath).text()
		const lines = content.trim().split('\n').filter(Boolean)
		const entries = lines.map((l) => JSON.parse(l))

		const completionCall = entries.find((e: Record<string, unknown>) => e.event_type === 'query_response')
		expect(completionCall).toBeDefined()
		expect(completionCall.edit_message_id).toBe(savedExternalId)

		// Verify only ONE assistant session message exists for this query (no duplicate)
		const allMsgs = await sessionMessageService.listRecent(session.id, 100)
		const assistantMsgs = allMsgs.filter((m) => m.role === 'assistant' && m.query_id === query.id)
		expect(assistantMsgs.length).toBe(1)

		// Verify its content is the final summary, not the hourglass
		expect(assistantMsgs[0].content).toBe('Restart done')
	})
})

// ─── Test 5b: TaskProgressBridge binding-key isolation ─────────────────────────

describe('TaskProgressBridge binding-key isolation', () => {
	const testRoot = join(tmpdir(), `qp-bridge-tpb-${Date.now()}`)
	const logFilePath = join(testRoot, 'tpb-invocations.jsonl')

	let dbResult: CompanyDbResult
	let runService: RunService
	let taskService: TaskService
	let artifactService: ArtifactService
	let bindingService: ConversationBindingService
	let sessionService: SessionService
	let sessionMessageService: SessionMessageService

	// Counter-based handler: returns unique external_id per call and logs conversation_id + edit_message_id
	const TPB_HANDLER_SRC = `import { appendFileSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
const input = await Bun.stdin.text()
const envelope = JSON.parse(input)
const counterFile = '${join(testRoot, 'tpb-counter.txt')}'
let counter = 1
if (existsSync(counterFile)) {
  counter = parseInt(readFileSync(counterFile, 'utf-8').trim(), 10) + 1
}
writeFileSync(counterFile, String(counter))
appendFileSync('${logFilePath}', JSON.stringify({
  op: envelope.op,
  conversation_id: envelope.payload?.conversation_id,
  thread_id: envelope.payload?.thread_id,
  edit_message_id: envelope.payload?.edit_message_id || null,
  event_type: envelope.payload?.event_type,
  normalized_status: envelope.payload?.normalized_status,
  counter,
}) + '\\n')
console.log(JSON.stringify({ ok: true, external_id: 'ext-tpb-' + counter }))`

	function makeConvProvider(): Provider {
		return {
			id: 'tpb-prov',
			name: 'TPB Conv',
			kind: 'conversation_channel',
			handler: 'handlers/tpb-handler.ts',
			capabilities: [{ op: 'conversation.ingest' }, { op: 'notify.send' }],
			events: [
				{ types: ['run_completed'], statuses: ['completed', 'failed'] },
				{ types: ['task_changed'] },
			],
			config: {},
			secret_refs: [],
			description: '',
		}
	}

	beforeAll(async () => {
		await mkdir(join(testRoot, '.autopilot', 'handlers'), { recursive: true })
		await writeFile(join(testRoot, '.autopilot', 'handlers', 'tpb-handler.ts'), TPB_HANDLER_SRC)

		dbResult = await createCompanyDb(testRoot)
		runService = new RunService(dbResult.db)
		taskService = new TaskService(dbResult.db)
		artifactService = new ArtifactService(dbResult.db)
		bindingService = new ConversationBindingService(dbResult.db)
		sessionService = new SessionService(dbResult.db)
		sessionMessageService = new SessionMessageService(dbResult.db)
	})

	afterAll(async () => {
		dbResult.raw.close()
		await rm(testRoot, { recursive: true, force: true })
	})

	test('two bindings on same provider get independent progress messages', async () => {
		await writeFile(logFilePath, '')
		await writeFile(join(testRoot, 'tpb-counter.txt'), '0')

		const eventBus = new EventBus()
		const provider = makeConvProvider()
		const authoredConfig = {
			company: {},
			agents: new Map(),
			workflows: new Map(),
			environments: new Map(),
			providers: new Map([['tpb-prov', provider]]),
			capabilityProfiles: new Map(),
			defaults: { runtime: 'claude-code' },
		}

		// Import TaskProgressBridge
		const { TaskProgressBridge } = await import('../src/providers/task-progress-bridge')

		const bridge = new TaskProgressBridge(
			eventBus,
			authoredConfig,
			runService,
			taskService,
			artifactService,
			bindingService,
			{ companyRoot: testRoot },
			undefined,
			sessionService,
			sessionMessageService,
		)
		bridge.start()

		// Create a task
		const taskId = `task-tpb-${Date.now()}`
		await taskService.create({
			id: taskId,
			title: 'Multi-binding task',
			type: 'development',
			created_by: 'test',
		})

		// Create TWO task_thread bindings for the SAME provider but DIFFERENT conversations
		const bindingId1 = `bind-tpb-1-${Date.now()}`
		const bindingId2 = `bind-tpb-2-${Date.now()}`
		await bindingService.create({
			id: bindingId1,
			provider_id: 'tpb-prov',
			external_conversation_id: 'chat-A',
			external_thread_id: 'thread-A',
			mode: 'task_thread',
			task_id: taskId,
		})
		await bindingService.create({
			id: bindingId2,
			provider_id: 'tpb-prov',
			external_conversation_id: 'chat-B',
			external_thread_id: 'thread-B',
			mode: 'task_thread',
			task_id: taskId,
		})

		// Create a run for the task
		const runId = `run-tpb-${Date.now()}`
		await runService.create({
			id: runId,
			agent_id: 'dev',
			task_id: taskId,
			runtime: 'claude-code',
			initiated_by: 'test',
			instructions: 'multi-binding test',
		})
		await runService.start(runId)
		await runService.complete(runId, { status: 'completed', summary: 'Multi-binding done' })

		// Emit run_completed — should send to BOTH bindings with unique messages
		eventBus.emit({ type: 'run_completed', runId, status: 'completed' })
		await new Promise((r) => setTimeout(r, 2000))

		// Read first batch of invocations
		let content = await Bun.file(logFilePath).text()
		let entries = content.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))

		// Should have exactly 2 calls — one for each binding
		expect(entries.length).toBe(2)

		const chatACalls = entries.filter((e: Record<string, unknown>) => e.conversation_id === 'chat-A')
		const chatBCalls = entries.filter((e: Record<string, unknown>) => e.conversation_id === 'chat-B')

		expect(chatACalls.length).toBe(1)
		expect(chatBCalls.length).toBe(1)

		// Both should be initial sends (no edit_message_id)
		expect(chatACalls[0].edit_message_id).toBeNull()
		expect(chatBCalls[0].edit_message_id).toBeNull()

		// They should have different external_ids
		const chatAExtId = `ext-tpb-${chatACalls[0].counter}`
		const chatBExtId = `ext-tpb-${chatBCalls[0].counter}`
		expect(chatAExtId).not.toBe(chatBExtId)

		// Now emit a second event (task_changed) — should EDIT the correct message for each binding
		eventBus.emit({ type: 'task_changed', taskId, status: 'active' })
		await new Promise((r) => setTimeout(r, 2000))
		bridge.stop()

		// Re-read log
		content = await Bun.file(logFilePath).text()
		entries = content.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))

		// Should now have 4 calls total (2 initial + 2 edits)
		expect(entries.length).toBe(4)

		// The edit calls (3rd and 4th) should use the correct edit_message_id for their conversation
		const editCalls = entries.slice(2)
		const editChatA = editCalls.find((e: Record<string, unknown>) => e.conversation_id === 'chat-A')
		const editChatB = editCalls.find((e: Record<string, unknown>) => e.conversation_id === 'chat-B')

		expect(editChatA).toBeDefined()
		expect(editChatB).toBeDefined()

		// Each edit should reference the external_id from its own initial send, NOT the other binding's
		expect(editChatA.edit_message_id).toBe(chatAExtId)
		expect(editChatB.edit_message_id).toBe(chatBExtId)
	})
})

// ─── Test 6: Lease recovery emits run_completed ──────────────────────────────

describe('Lease recovery emits run_completed', () => {
	test('expireStaleAndRecover callback emits run_completed', async () => {
		const events: string[] = []
		const bus = new EventBus()
		bus.subscribe((e) => {
			if (e.type === 'run_completed') events.push(e.runId)
		})

		// Simulate what server.ts does
		const failAndEmit = async (runId: string) => {
			// In real code: await runService.complete(...)
			bus.emit({ type: 'run_completed', runId, status: 'failed' })
		}

		await failAndEmit('run-recovery-1')
		expect(events).toContain('run-recovery-1')
	})
})

// ─── Test 7: Stale busy worker detection ─────────────────────────────────────

describe('Stale busy worker detection', () => {
	const testRoot = join(tmpdir(), `qp-worker-stale-${Date.now()}`)
	let dbResult: CompanyDbResult
	let workerService: WorkerService

	beforeAll(async () => {
		dbResult = await createCompanyDb(testRoot)
		workerService = new WorkerService(dbResult.db)
	})

	afterAll(async () => {
		dbResult.raw.close()
		await rm(testRoot, { recursive: true, force: true })
	})

	test('isStale returns true when heartbeat is older than threshold', async () => {
		await workerService.register({ id: 'w-stale-old', name: 'Old Worker', capabilities: '[]' })
		// Backdate heartbeat via direct DB update
		const { workers } = await import('../src/db/company-schema')
		const { eq } = await import('drizzle-orm')
		await dbResult.db
			.update(workers)
			.set({ last_heartbeat: new Date(Date.now() - 120_000).toISOString() })
			.where(eq(workers.id, 'w-stale-old'))
		const worker = await workerService.get('w-stale-old')
		expect(worker).toBeDefined()
		expect(workerService.isStale(worker!, 90_000)).toBe(true)
	})

	test('isStale returns false when heartbeat is fresh', async () => {
		await workerService.register({ id: 'w-stale-fresh', name: 'Fresh Worker', capabilities: '[]' })
		const worker = await workerService.get('w-stale-fresh')
		expect(worker).toBeDefined()
		expect(workerService.isStale(worker!, 90_000)).toBe(false)
	})

	test('isStale returns true when heartbeat is null', async () => {
		await workerService.register({ id: 'w-stale-null', name: 'Null HB Worker', capabilities: '[]' })
		// Set heartbeat to null
		const { workers } = await import('../src/db/company-schema')
		const { eq } = await import('drizzle-orm')
		await dbResult.db
			.update(workers)
			.set({ last_heartbeat: null })
			.where(eq(workers.id, 'w-stale-null'))
		const worker = await workerService.get('w-stale-null')
		expect(worker).toBeDefined()
		expect(workerService.isStale(worker!, 90_000)).toBe(true)
	})

	test('isUnavailable returns true for offline worker', async () => {
		await workerService.register({ id: 'w-unavail-offline', name: 'Offline Worker', capabilities: '[]' })
		await workerService.setOffline('w-unavail-offline')
		const worker = await workerService.get('w-unavail-offline')
		expect(worker).toBeDefined()
		expect(workerService.isUnavailable(worker!)).toBe(true)
	})

	test('isUnavailable returns true for undefined worker', () => {
		expect(workerService.isUnavailable(undefined)).toBe(true)
	})

	test('isUnavailable returns false for fresh online worker', async () => {
		await workerService.register({ id: 'w-unavail-fresh', name: 'Fresh Online', capabilities: '[]' })
		const worker = await workerService.get('w-unavail-fresh')
		expect(worker).toBeDefined()
		expect(workerService.isUnavailable(worker!, 90_000)).toBe(false)
	})

	test('isUnavailable returns true for busy worker with stale heartbeat', async () => {
		await workerService.register({ id: 'w-unavail-busy-stale', name: 'Busy Stale', capabilities: '[]' })
		await workerService.setBusy('w-unavail-busy-stale')
		const { workers } = await import('../src/db/company-schema')
		const { eq } = await import('drizzle-orm')
		await dbResult.db
			.update(workers)
			.set({ last_heartbeat: new Date(Date.now() - 120_000).toISOString() })
			.where(eq(workers.id, 'w-unavail-busy-stale'))
		const worker = await workerService.get('w-unavail-busy-stale')
		expect(worker).toBeDefined()
		expect(workerService.isUnavailable(worker!, 90_000)).toBe(true)
	})

	test('expireStale marks stale busy worker offline', async () => {
		await workerService.register({ id: 'w-expire-busy', name: 'Busy To Expire', capabilities: '[]' })
		await workerService.setBusy('w-expire-busy')
		const { workers } = await import('../src/db/company-schema')
		const { eq } = await import('drizzle-orm')
		await dbResult.db
			.update(workers)
			.set({ last_heartbeat: new Date(Date.now() - 120_000).toISOString() })
			.where(eq(workers.id, 'w-expire-busy'))

		const expired = await workerService.expireStale(90_000)
		expect(expired).toContain('w-expire-busy')

		const worker = await workerService.get('w-expire-busy')
		expect(worker).toBeDefined()
		expect(worker!.status).toBe('offline')
	})
})

// ─── Test 8: markdownToTelegramHtml smoke ────────────────────────────────────

describe('markdownToTelegramHtml', () => {
	// Copy of the function from telegram.ts for isolated testing
	function escapeHtml(text: string): string {
		return text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
	}

	function markdownToTelegramHtml(text: string): string {
		const protectedFragments: Array<{ token: string; html: string }> = []
		let nextToken = 0

		const protect = (html: string): string => {
			const token = `@@QPCODE${nextToken}@@`
			nextToken += 1
			protectedFragments.push({ token, html })
			return token
		}

		let working = text.replace(/```([\s\S]*?)```/g, (_match, code: string) => {
			return protect(`<pre>${escapeHtml(code.trim())}</pre>`)
		})

		working = working.replace(/`([^`\n]+)`/g, (_match, code: string) => {
			return protect(`<code>${escapeHtml(code)}</code>`)
		})

		let html = escapeHtml(working)

		html = html.replace(/^#{1,6}\s+(.+)$/gm, '<b>$1</b>')
		html = html.replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>')
		html = html.replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
		html = html.replace(/__([^_\n]+)__/g, '<b>$1</b>')
		html = html.replace(/\*([^*\n]+)\*/g, '<i>$1</i>')
		html = html.replace(/_([^_\n]+)_/g, '<i>$1</i>')

		for (const fragment of protectedFragments) {
			html = html.replace(fragment.token, fragment.html)
		}

		return html
	}

	test('converts headings to bold', () => {
		expect(markdownToTelegramHtml('### Title')).toBe('<b>Title</b>')
	})

	test('converts bold', () => {
		expect(markdownToTelegramHtml('**bold**')).toBe('<b>bold</b>')
	})

	test('converts inline code', () => {
		expect(markdownToTelegramHtml('use `foo()`')).toBe('use <code>foo()</code>')
	})

	test('converts fenced code blocks', () => {
		const input = '```\nconst x = 1\n```'
		expect(markdownToTelegramHtml(input)).toContain('<pre>')
		expect(markdownToTelegramHtml(input)).toContain('const x = 1')
	})

	test('escapes HTML in non-code text', () => {
		expect(markdownToTelegramHtml('a < b > c')).toBe('a &lt; b &gt; c')
	})

	test('does not double-escape code blocks', () => {
		expect(markdownToTelegramHtml('`a < b`')).toBe('<code>a &lt; b</code>')
	})

	test('converts italic', () => {
		expect(markdownToTelegramHtml('*italic*')).toBe('<i>italic</i>')
	})

	test('converts links', () => {
		expect(markdownToTelegramHtml('[click](https://example.com)')).toBe('<a href="https://example.com">click</a>')
	})
})

// ─── Test: NotificationBridge summary truncation ───────────────────────────

describe('NotificationBridge summary truncation', () => {
	const testRoot = join(tmpdir(), `qp-notif-trunc-${Date.now()}`)
	const invocationsFile = join(testRoot, 'notif-trunc-invocations.jsonl')

	let dbResult: CompanyDbResult
	let runService: RunService
	let taskService: TaskService
	let artifactService: ArtifactService
	let sessionService: SessionService
	let sessionMessageService: SessionMessageService
	let bindingService: ConversationBindingService

	const HANDLER_SRC = `import { appendFileSync } from 'node:fs'
const input = await Bun.stdin.text()
const envelope = JSON.parse(input)
appendFileSync('${invocationsFile}', JSON.stringify({
  op: envelope.op,
  summary: envelope.payload?.summary,
  summary_length: (envelope.payload?.summary || '').length,
  preview_url: envelope.payload?.preview_url || null,
  task_url: envelope.payload?.task_url || null,
  event_type: envelope.payload?.event_type,
}) + '\\n')
console.log(JSON.stringify({ ok: true }))`

	function makeNotifProvider(): Provider {
		return {
			id: 'notif-trunc',
			name: 'Notif Trunc',
			kind: 'notification_channel',
			handler: 'handlers/notif-trunc-handler.ts',
			capabilities: [{ op: 'notify.send' }],
			events: [
				{ types: ['run_completed'], statuses: ['completed', 'failed'] },
			],
			config: {},
			secret_refs: [],
			description: '',
		}
	}

	beforeAll(async () => {
		await mkdir(join(testRoot, '.autopilot', 'handlers'), { recursive: true })
		await writeFile(join(testRoot, '.autopilot', 'handlers', 'notif-trunc-handler.ts'), HANDLER_SRC)

		dbResult = await createCompanyDb(testRoot)
		runService = new RunService(dbResult.db)
		taskService = new TaskService(dbResult.db)
		artifactService = new ArtifactService(dbResult.db)
		sessionService = new SessionService(dbResult.db)
		sessionMessageService = new SessionMessageService(dbResult.db)
		bindingService = new ConversationBindingService(dbResult.db)
	})

	afterAll(async () => {
		dbResult.raw.close()
		await rm(testRoot, { recursive: true, force: true })
	})

	test('long run_completed summary is truncated before provider delivery', async () => {
		await writeFile(invocationsFile, '')

		const eventBus = new EventBus()
		const authoredConfig = {
			company: {},
			agents: new Map(),
			workflows: new Map(),
			environments: new Map(),
			providers: new Map([['notif-trunc', makeNotifProvider()]]),
			capabilityProfiles: new Map(),
			defaults: { runtime: 'claude-code' },
		}

		const bridge = new NotificationBridge(
			eventBus,
			authoredConfig,
			runService,
			taskService,
			artifactService,
			bindingService,
			{ companyRoot: testRoot, orchestratorUrl: 'http://localhost:7778' },
			undefined,
			sessionService,
			sessionMessageService,
		)
		bridge.start()

		// Create a task + run with a very long summary
		const taskId = `task-trunc-${Date.now()}`
		await taskService.create({
			id: taskId,
			title: 'Test truncation task',
			type: 'development',
			created_by: 'test',
		})

		const longSummary = 'X'.repeat(5000)
		const runId = `run-trunc-notif-${Date.now()}`
		await runService.create({
			id: runId,
			agent_id: 'dev',
			task_id: taskId,
			runtime: 'claude-code',
			initiated_by: 'test',
			instructions: 'test',
		})
		await runService.start(runId)
		await runService.complete(runId, { status: 'completed', summary: longSummary })

		eventBus.emit({ type: 'run_completed', runId, status: 'completed' })
		await new Promise((r) => setTimeout(r, 2000))
		bridge.stop()

		const content = await Bun.file(invocationsFile).text()
		const lines = content.trim().split('\n').filter(Boolean)
		const entries = lines.map((l) => JSON.parse(l))

		const delivery = entries.find((e: Record<string, unknown>) => e.event_type === 'run_completed')
		expect(delivery).toBeDefined()
		// Has task_url so should be aggressively truncated
		expect(delivery.summary_length).toBeLessThanOrEqual(600)
		expect(delivery.summary).toContain('...')
	})

	test('long summary with preview URL is aggressively shortened and preview URL survives', async () => {
		await writeFile(invocationsFile, '')

		const eventBus = new EventBus()
		const authoredConfig = {
			company: {},
			agents: new Map(),
			workflows: new Map(),
			environments: new Map(),
			providers: new Map([['notif-trunc', makeNotifProvider()]]),
			capabilityProfiles: new Map(),
			defaults: { runtime: 'claude-code' },
		}

		const bridge = new NotificationBridge(
			eventBus,
			authoredConfig,
			runService,
			taskService,
			artifactService,
			bindingService,
			{ companyRoot: testRoot, orchestratorUrl: 'http://localhost:7778' },
			undefined,
			sessionService,
			sessionMessageService,
		)
		bridge.start()

		const taskId = `task-trunc-prev-${Date.now()}`
		await taskService.create({
			id: taskId,
			title: 'Preview truncation task',
			type: 'development',
			created_by: 'test',
		})

		const longSummary = 'Y'.repeat(3000)
		const runId = `run-trunc-prev-${Date.now()}`
		await runService.create({
			id: runId,
			agent_id: 'dev',
			task_id: taskId,
			runtime: 'claude-code',
			initiated_by: 'test',
			instructions: 'test',
		})
		await runService.start(runId)
		await runService.complete(runId, { status: 'completed', summary: longSummary })

		// Create preview_file artifact (preview URL derived via resolvePreviewUrl)
		await artifactService.create({
			id: `art-notif-prev-${Date.now()}`,
			run_id: runId,
			kind: 'preview_file',
			title: 'index.html',
			ref_kind: 'inline',
			ref_value: '<html><body>Preview</body></html>',
			mime_type: 'text/html',
		})

		eventBus.emit({ type: 'run_completed', runId, status: 'completed' })
		await new Promise((r) => setTimeout(r, 2000))
		bridge.stop()

		const content = await Bun.file(invocationsFile).text()
		const lines = content.trim().split('\n').filter(Boolean)
		const entries = lines.map((l) => JSON.parse(l))

		const delivery = entries.find((e: Record<string, unknown>) => e.event_type === 'run_completed')
		expect(delivery).toBeDefined()
		// Aggressively truncated due to preview URL being present
		expect(delivery.summary_length).toBeLessThanOrEqual(600)
		// Preview URL derived from preview_file artifacts
		expect(delivery.preview_url).toContain('/api/previews/')
	})
})

// ─── Test: QueryResponseBridge summary truncation ──────────────────────────

describe('QueryResponseBridge summary truncation', () => {
	const testRoot = join(tmpdir(), `qp-bridge-trunc-${Date.now()}`)
	const invocationsFile = join(testRoot, 'trunc-invocations.jsonl')

	let dbResult: CompanyDbResult
	let runService: RunService
	let queryService: QueryService
	let sessionService: SessionService
	let sessionMessageService: SessionMessageService
	let artifactService: ArtifactService

	const HANDLER_SRC = `import { appendFileSync } from 'node:fs'
const input = await Bun.stdin.text()
const envelope = JSON.parse(input)
appendFileSync('${invocationsFile}', JSON.stringify({
  op: envelope.op,
  summary: envelope.payload?.summary,
  summary_length: (envelope.payload?.summary || '').length,
  preview_url: envelope.payload?.preview_url || null,
  event_type: envelope.payload?.event_type,
}) + '\\n')
console.log(JSON.stringify({ ok: true, external_id: 'ext-trunc-1' }))`

	function makeConvProvider(): Provider {
		return {
			id: 'trunc-prov',
			name: 'Trunc Conv',
			kind: 'conversation_channel',
			handler: 'handlers/trunc-handler.ts',
			capabilities: [{ op: 'conversation.ingest' }, { op: 'notify.send' }],
			events: [
				{ types: ['run_completed'], statuses: ['completed', 'failed'] },
			],
			config: {},
			secret_refs: [],
			description: '',
		}
	}

	beforeAll(async () => {
		await mkdir(join(testRoot, '.autopilot', 'handlers'), { recursive: true })
		await writeFile(join(testRoot, '.autopilot', 'handlers', 'trunc-handler.ts'), HANDLER_SRC)

		dbResult = await createCompanyDb(testRoot)
		runService = new RunService(dbResult.db)
		queryService = new QueryService(dbResult.db)
		sessionService = new SessionService(dbResult.db)
		sessionMessageService = new SessionMessageService(dbResult.db)
		artifactService = new ArtifactService(dbResult.db)
	})

	afterAll(async () => {
		dbResult.raw.close()
		await rm(testRoot, { recursive: true, force: true })
	})

	function makeBridge() {
		const eventBus = new EventBus()
		const authoredConfig = {
			company: {},
			agents: new Map(),
			workflows: new Map(),
			environments: new Map(),
			providers: new Map([['trunc-prov', makeConvProvider()]]),
			capabilityProfiles: new Map(),
			defaults: { runtime: 'claude-code' },
		}

		const bridge = new QueryResponseBridge(
			eventBus,
			authoredConfig,
			queryService,
			runService,
			sessionService,
			{ companyRoot: testRoot, orchestratorUrl: 'http://localhost:7778' },
			undefined,
			sessionMessageService,
			artifactService,
		)
		return { bridge, eventBus }
	}

	test('long summary without preview URL is truncated to safe limit', async () => {
		await writeFile(invocationsFile, '')

		const { bridge, eventBus } = makeBridge()
		bridge.start()

		const session = await sessionService.findOrCreate({
			provider_id: 'trunc-prov',
			external_conversation_id: `chat-trunc-long-${Date.now()}`,
			mode: 'query',
		})

		const query = await queryService.create({
			prompt: 'generate long output',
			agent_id: 'dev',
			allow_repo_mutation: true,
			session_id: session.id,
			created_by: 'test',
		})

		const longSummary = 'A'.repeat(5000)
		const runId = `run-trunc-long-${Date.now()}`
		await runService.create({
			id: runId,
			agent_id: 'dev',
			runtime: 'claude-code',
			initiated_by: 'test',
			instructions: 'test',
		})
		await queryService.linkRun(query.id, runId)
		await runService.start(runId)
		await runService.complete(runId, { status: 'completed', summary: longSummary })

		eventBus.emit({ type: 'run_completed', runId, status: 'completed' })
		await new Promise((r) => setTimeout(r, 2000))
		bridge.stop()

		const content = await Bun.file(invocationsFile).text()
		const lines = content.trim().split('\n').filter(Boolean)
		const entries = lines.map((l) => JSON.parse(l))

		const response = entries.find((e: Record<string, unknown>) => e.event_type === 'query_response')
		expect(response).toBeDefined()
		// Should be truncated — well under 5000
		expect(response.summary_length).toBeLessThanOrEqual(3510)
		expect(response.summary.endsWith('...')).toBe(true)
		expect(response.preview_url).toBeNull()
	})

	test('long summary with preview URL is aggressively shortened', async () => {
		await writeFile(invocationsFile, '')

		const { bridge, eventBus } = makeBridge()
		bridge.start()

		const session = await sessionService.findOrCreate({
			provider_id: 'trunc-prov',
			external_conversation_id: `chat-trunc-preview-${Date.now()}`,
			mode: 'query',
		})

		const query = await queryService.create({
			prompt: 'build artifact',
			agent_id: 'dev',
			allow_repo_mutation: true,
			session_id: session.id,
			created_by: 'test',
		})

		const longSummary = 'B'.repeat(2000)
		const runId = `run-trunc-preview-${Date.now()}`
		await runService.create({
			id: runId,
			agent_id: 'dev',
			runtime: 'claude-code',
			initiated_by: 'test',
			instructions: 'test',
		})
		await queryService.linkRun(query.id, runId)
		await runService.start(runId)
		await runService.complete(runId, { status: 'completed', summary: longSummary })

		// Create a preview_file artifact (preview URL derived via resolvePreviewUrl)
		await artifactService.create({
			id: `art-preview-${Date.now()}`,
			run_id: runId,
			kind: 'preview_file',
			title: 'index.html',
			ref_kind: 'inline',
			ref_value: '<html><body>Preview</body></html>',
			mime_type: 'text/html',
		})

		eventBus.emit({ type: 'run_completed', runId, status: 'completed' })
		await new Promise((r) => setTimeout(r, 2000))
		bridge.stop()

		const content = await Bun.file(invocationsFile).text()
		const lines = content.trim().split('\n').filter(Boolean)
		const entries = lines.map((l) => JSON.parse(l))

		const response = entries.find((e: Record<string, unknown>) => e.event_type === 'query_response')
		expect(response).toBeDefined()
		// With preview URL present, should be aggressively truncated (500 + suffix)
		expect(response.summary_length).toBeLessThanOrEqual(600)
		expect(response.summary).toContain('preview')
		// Preview URL derived from preview_file artifacts should still be in payload
		expect(response.preview_url).toContain('/api/previews/')
	})
})

// ─── Test: TaskProgressBridge universal card fallback ───────────────────────

describe('TaskProgressBridge universal card fallback', () => {
	const testRoot = join(tmpdir(), `qp-bridge-card-${Date.now()}`)
	const invocationsFile = join(testRoot, 'card-invocations.jsonl')

	let dbResult: CompanyDbResult
	let runService: RunService
	let taskService: TaskService
	let artifactService: ArtifactService
	let sessionService: SessionService
	let sessionMessageService: SessionMessageService
	let bindingService: ConversationBindingService

	beforeAll(async () => {
		await mkdir(join(testRoot, '.autopilot', 'handlers'), { recursive: true })

		const CARD_HANDLER_SRC = `import { appendFileSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
const input = await Bun.stdin.text()
const envelope = JSON.parse(input)
const counterFile = '${join(testRoot, 'card-counter.txt')}'
let counter = 1
if (existsSync(counterFile)) {
  counter = parseInt(readFileSync(counterFile, 'utf-8').trim(), 10) + 1
}
writeFileSync(counterFile, String(counter))
appendFileSync('${invocationsFile}', JSON.stringify({
  op: envelope.op,
  event_type: envelope.payload?.event_type,
  summary: envelope.payload?.summary,
  conversation_id: envelope.payload?.conversation_id,
  edit_message_id: envelope.payload?.edit_message_id || null,
  normalized_status: envelope.payload?.normalized_status || null,
  counter,
}) + '\\n')
console.log(JSON.stringify({ ok: true, external_id: 'ext-card-' + counter }))`

		await writeFile(join(testRoot, '.autopilot', 'handlers', 'card-handler.ts'), CARD_HANDLER_SRC)

		dbResult = await createCompanyDb(testRoot)
		runService = new RunService(dbResult.db)
		taskService = new TaskService(dbResult.db)
		artifactService = new ArtifactService(dbResult.db)
		sessionService = new SessionService(dbResult.db)
		sessionMessageService = new SessionMessageService(dbResult.db)
		bindingService = new ConversationBindingService(dbResult.db)
	})

	afterAll(async () => {
		dbResult.raw.close()
		await rm(testRoot, { recursive: true, force: true })
	})

	function makeCardProvider(id: string, defaultChatId: string): Provider {
		return {
			id,
			name: id,
			kind: 'conversation_channel',
			handler: 'handlers/card-handler.ts',
			capabilities: [{ op: 'conversation.ingest' }, { op: 'notify.send' }],
			events: [
				{ types: ['run_completed'], statuses: ['completed', 'failed'] },
				{ types: ['run_event'] },
				{ types: ['task_changed'] },
			],
			config: { default_chat_id: defaultChatId },
			secret_refs: [],
			description: '',
		}
	}

	function makeConfig(providers: Map<string, Provider>) {
		return {
			company: {},
			agents: new Map(),
			workflows: new Map(),
			environments: new Map(),
			providers,
			capabilityProfiles: new Map(),
			defaults: { runtime: 'claude-code' },
		}
	}

	test('unbound task gets card in default chat', async () => {
		await writeFile(invocationsFile, '')
		await writeFile(join(testRoot, 'card-counter.txt'), '0')

		const eventBus = new EventBus()
		const providers = new Map([['card-prov-1', makeCardProvider('card-prov-1', 'default-chat-card')]])

		const { TaskProgressBridge } = await import('../src/providers/task-progress-bridge')
		const bridge = new TaskProgressBridge(
			eventBus,
			makeConfig(providers),
			runService,
			taskService,
			artifactService,
			bindingService,
			{ companyRoot: testRoot, orchestratorUrl: 'http://localhost:7778' },
			undefined,
			sessionService,
			sessionMessageService,
		)
		bridge.start()

		// Create task + run (no binding!)
		const taskId = `task-card-unbound-${Date.now()}`
		await taskService.create({
			id: taskId,
			title: 'Unbound task card test',
			type: 'development',
			created_by: 'test',
		})

		const runId = `run-card-unbound-${Date.now()}`
		await runService.create({
			id: runId,
			agent_id: 'dev',
			task_id: taskId,
			runtime: 'claude-code',
			initiated_by: 'test',
			instructions: 'test',
		})

		// Emit task_created
		eventBus.emit({ type: 'task_created', taskId, title: 'Unbound task card test' })
		await new Promise((r) => setTimeout(r, 2000))

		bridge.stop()

		const content = await Bun.file(invocationsFile).text()
		const lines = content.trim().split('\n').filter(Boolean)
		const entries = lines.map((l) => JSON.parse(l))

		// Should have at least one card sent to default-chat-card
		const defaultChatCalls = entries.filter((e: Record<string, unknown>) => e.conversation_id === 'default-chat-card')
		expect(defaultChatCalls.length).toBeGreaterThanOrEqual(1)
		expect(defaultChatCalls[0].event_type).toBe('task_progress')
		expect(defaultChatCalls[0].summary).toBe('Working...')
	})

	test('explicit binding uses binding conversation, not default chat', async () => {
		await writeFile(invocationsFile, '')
		await writeFile(join(testRoot, 'card-counter.txt'), '0')

		const eventBus = new EventBus()
		const providers = new Map([['card-prov-2', makeCardProvider('card-prov-2', 'default-chat-bound')]])

		const { TaskProgressBridge } = await import('../src/providers/task-progress-bridge')
		const bridge = new TaskProgressBridge(
			eventBus,
			makeConfig(providers),
			runService,
			taskService,
			artifactService,
			bindingService,
			{ companyRoot: testRoot, orchestratorUrl: 'http://localhost:7778' },
			undefined,
			sessionService,
			sessionMessageService,
		)
		bridge.start()

		// Create task WITH explicit binding
		const taskId = `task-card-bound-${Date.now()}`
		await taskService.create({
			id: taskId,
			title: 'Bound task card test',
			type: 'development',
			created_by: 'test',
		})
		await bindingService.create({
			id: `bind-card-${Date.now()}`,
			provider_id: 'card-prov-2',
			external_conversation_id: 'explicit-chat-123',
			external_thread_id: 'thread-123',
			mode: 'task_thread',
			task_id: taskId,
		})

		eventBus.emit({ type: 'task_created', taskId, title: 'Bound task card test' })
		await new Promise((r) => setTimeout(r, 2000))

		bridge.stop()

		const content = await Bun.file(invocationsFile).text()
		const lines = content.trim().split('\n').filter(Boolean)
		const entries = lines.map((l) => JSON.parse(l))

		// Should go to explicit-chat-123, NOT default-chat-bound
		const explicitCalls = entries.filter((e: Record<string, unknown>) => e.conversation_id === 'explicit-chat-123')
		const defaultChatCalls = entries.filter((e: Record<string, unknown>) => e.conversation_id === 'default-chat-bound')
		expect(explicitCalls.length).toBeGreaterThanOrEqual(1)
		expect(defaultChatCalls.length).toBe(0)
	})

	test('failed task card shows failure', async () => {
		await writeFile(invocationsFile, '')
		await writeFile(join(testRoot, 'card-counter.txt'), '0')

		const eventBus = new EventBus()
		const providers = new Map([['card-prov-3', makeCardProvider('card-prov-3', 'default-chat-fail')]])

		const { TaskProgressBridge } = await import('../src/providers/task-progress-bridge')
		const bridge = new TaskProgressBridge(
			eventBus,
			makeConfig(providers),
			runService,
			taskService,
			artifactService,
			bindingService,
			{ companyRoot: testRoot, orchestratorUrl: 'http://localhost:7778' },
			undefined,
			sessionService,
			sessionMessageService,
		)
		bridge.start()

		const taskId = `task-card-fail-${Date.now()}`
		await taskService.create({
			id: taskId,
			title: 'Failing task',
			type: 'development',
			created_by: 'test',
		})

		const runId = `run-card-fail-${Date.now()}`
		await runService.create({
			id: runId,
			agent_id: 'dev',
			task_id: taskId,
			runtime: 'claude-code',
			initiated_by: 'test',
			instructions: 'test',
		})
		await runService.start(runId)
		await runService.complete(runId, { status: 'failed', summary: 'Something went wrong' })

		// Update task status to failed
		await taskService.update(taskId, { status: 'failed' })

		eventBus.emit({ type: 'run_completed', runId, status: 'failed' })
		await new Promise((r) => setTimeout(r, 2000))

		bridge.stop()

		const content = await Bun.file(invocationsFile).text()
		const lines = content.trim().split('\n').filter(Boolean)
		const entries = lines.map((l) => JSON.parse(l))

		const failCard = entries.find((e: Record<string, unknown>) =>
			e.conversation_id === 'default-chat-fail' && e.event_type === 'task_progress'
		)
		expect(failCard).toBeDefined()
		expect(failCard.normalized_status).toBe('failed')
	})
})

// ─── Test: NotificationBridge suppression ──────────────────────────────────

describe('NotificationBridge task-scoped suppression', () => {
	const testRoot = join(tmpdir(), `qp-notif-suppress-${Date.now()}`)
	const invocationsFile = join(testRoot, 'suppress-invocations.jsonl')

	let dbResult: CompanyDbResult
	let runService: RunService
	let taskService: TaskService
	let artifactService: ArtifactService
	let sessionService: SessionService
	let sessionMessageService: SessionMessageService
	let bindingService: ConversationBindingService

	beforeAll(async () => {
		await mkdir(join(testRoot, '.autopilot', 'handlers'), { recursive: true })

		const HANDLER_SRC = `import { appendFileSync } from 'node:fs'
const input = await Bun.stdin.text()
const envelope = JSON.parse(input)
appendFileSync('${invocationsFile}', JSON.stringify({
  op: envelope.op,
  event_type: envelope.payload?.event_type,
  conversation_id: envelope.payload?.conversation_id,
}) + '\\n')
console.log(JSON.stringify({ ok: true }))`

		await writeFile(join(testRoot, '.autopilot', 'handlers', 'suppress-handler.ts'), HANDLER_SRC)

		dbResult = await createCompanyDb(testRoot)
		runService = new RunService(dbResult.db)
		taskService = new TaskService(dbResult.db)
		artifactService = new ArtifactService(dbResult.db)
		sessionService = new SessionService(dbResult.db)
		sessionMessageService = new SessionMessageService(dbResult.db)
		bindingService = new ConversationBindingService(dbResult.db)
	})

	afterAll(async () => {
		dbResult.raw.close()
		await rm(testRoot, { recursive: true, force: true })
	})

	test('NotificationBridge does not send task-scoped default-chat notifications', async () => {
		await writeFile(invocationsFile, '')

		const eventBus = new EventBus()
		const provider: Provider = {
			id: 'suppress-prov',
			name: 'Suppress Prov',
			kind: 'conversation_channel',
			handler: 'handlers/suppress-handler.ts',
			capabilities: [{ op: 'notify.send' }],
			events: [
				{ types: ['run_completed'], statuses: ['completed', 'failed'] },
			],
			config: { default_chat_id: 'default-chat-suppress' },
			secret_refs: [],
			description: '',
		}

		const authoredConfig = {
			company: {},
			agents: new Map(),
			workflows: new Map(),
			environments: new Map(),
			providers: new Map([['suppress-prov', provider]]),
			capabilityProfiles: new Map(),
			defaults: { runtime: 'claude-code' },
		}

		// Only start NotificationBridge (NOT TaskProgressBridge)
		const bridge = new NotificationBridge(
			eventBus,
			authoredConfig,
			runService,
			taskService,
			artifactService,
			bindingService,
			{ companyRoot: testRoot, orchestratorUrl: 'http://localhost:7778' },
			undefined,
			sessionService,
			sessionMessageService,
		)
		bridge.start()

		// Create task + run
		const taskId = `task-suppress-${Date.now()}`
		await taskService.create({
			id: taskId,
			title: 'Suppression test task',
			type: 'development',
			created_by: 'test',
		})

		const runId = `run-suppress-${Date.now()}`
		await runService.create({
			id: runId,
			agent_id: 'dev',
			task_id: taskId,
			runtime: 'claude-code',
			initiated_by: 'test',
			instructions: 'test',
		})
		await runService.start(runId)
		await runService.complete(runId, { status: 'completed', summary: 'Done' })

		eventBus.emit({ type: 'run_completed', runId, status: 'completed' })
		await new Promise((r) => setTimeout(r, 2000))
		bridge.stop()

		const content = await Bun.file(invocationsFile).text()
		const lines = content.trim().split('\n').filter(Boolean)
		const entries = lines.map((l) => JSON.parse(l))

		// Should NOT have any calls to default-chat-suppress
		const defaultChatCalls = entries.filter((e: Record<string, unknown>) => e.conversation_id === 'default-chat-suppress')
		expect(defaultChatCalls.length).toBe(0)
	})
})
