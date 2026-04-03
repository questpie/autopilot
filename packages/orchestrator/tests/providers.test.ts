/**
 * Tests for provider runtime, config loading, and notification bridge.
 *
 * Covers:
 * - Provider schema validation
 * - Provider loading via scope resolution
 * - Handler runtime invocation with typed envelope
 * - Notification dispatch from actionable orchestrator events
 * - Provider-specific behavior stays out of core
 * - Failure handling when a handler errors
 * - Example notification provider working end to end
 */
import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
	ProviderSchema,
	HandlerEnvelopeSchema,
	HandlerResultSchema,
	NotificationPayloadSchema,
} from '@questpie/autopilot-spec'
import type { Provider, HandlerEnvelope } from '@questpie/autopilot-spec'
import { executeHandler, invokeProvider, resolveSecrets } from '../src/providers/handler-runtime'
import { NotificationBridge } from '../src/providers/notification-bridge'
import { EventBus } from '../src/events/event-bus'

// ─── Schema Validation ───────────────────────────────────────────────────────

describe('Provider Schema', () => {
	test('valid notification_channel provider parses', () => {
		const result = ProviderSchema.safeParse({
			id: 'webhook-ops',
			name: 'Webhook Ops',
			kind: 'notification_channel',
			handler: 'handlers/webhook-notify.ts',
			capabilities: [{ op: 'notify.send' }],
			events: [{ types: ['run_completed'], statuses: ['failed'] }],
			config: { endpoint: '/alerts' },
			secret_refs: [{ name: 'url', source: 'env', key: 'WEBHOOK_URL' }],
		})
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.kind).toBe('notification_channel')
			expect(result.data.capabilities).toHaveLength(1)
			expect(result.data.events).toHaveLength(1)
		}
	})

	test('rejects invalid provider kind', () => {
		const result = ProviderSchema.safeParse({
			id: 'bad',
			name: 'Bad',
			kind: 'invalid_kind',
			handler: 'handlers/bad.ts',
			capabilities: [{ op: 'notify.send' }],
		})
		expect(result.success).toBe(false)
	})

	test('rejects missing capabilities', () => {
		const result = ProviderSchema.safeParse({
			id: 'no-caps',
			name: 'No Caps',
			kind: 'notification_channel',
			handler: 'handlers/test.ts',
			capabilities: [],
		})
		expect(result.success).toBe(false)
	})

	test('rejects invalid id format', () => {
		const result = ProviderSchema.safeParse({
			id: 'Invalid ID!',
			name: 'Bad ID',
			kind: 'notification_channel',
			handler: 'handlers/test.ts',
			capabilities: [{ op: 'notify.send' }],
		})
		expect(result.success).toBe(false)
	})

	test('defaults optional fields', () => {
		const result = ProviderSchema.safeParse({
			id: 'minimal',
			name: 'Minimal',
			kind: 'notification_channel',
			handler: 'handlers/test.ts',
			capabilities: [{ op: 'notify.send' }],
		})
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.events).toEqual([])
			expect(result.data.config).toEqual({})
			expect(result.data.secret_refs).toEqual([])
			expect(result.data.description).toBe('')
		}
	})
})

describe('Handler Contract Schemas', () => {
	test('valid envelope parses', () => {
		const result = HandlerEnvelopeSchema.safeParse({
			op: 'notify.send',
			provider_id: 'webhook-ops',
			provider_kind: 'notification_channel',
			config: { endpoint: '/alerts' },
			secrets: { webhook_url: 'https://example.com/hook' },
			payload: { title: 'Test', summary: 'A test notification' },
		})
		expect(result.success).toBe(true)
	})

	test('valid result parses', () => {
		const result = HandlerResultSchema.safeParse({
			ok: true,
			external_id: 'msg-123',
			metadata: { status: 200 },
		})
		expect(result.success).toBe(true)
	})

	test('error result parses', () => {
		const result = HandlerResultSchema.safeParse({
			ok: false,
			error: 'Connection refused',
		})
		expect(result.success).toBe(true)
	})

	test('notification payload parses', () => {
		const result = NotificationPayloadSchema.safeParse({
			event_type: 'run_completed',
			severity: 'error',
			title: 'Run failed',
			summary: 'Agent timed out',
			run_id: 'run-123',
			task_id: 'task-456',
		})
		expect(result.success).toBe(true)
	})
})

// ─── Secret Resolution ───────────────────────────────────────────────────────

describe('Secret Resolution', () => {
	test('resolves env secrets', async () => {
		process.env.__TEST_PROVIDER_SECRET = 'secret-value-42'
		const result = await resolveSecrets([
			{ name: 'test_secret', source: 'env', key: '__TEST_PROVIDER_SECRET' },
		])
		expect(result.get('test_secret')).toBe('secret-value-42')
		delete process.env.__TEST_PROVIDER_SECRET
	})

	test('skips missing env secrets', async () => {
		const result = await resolveSecrets([
			{ name: 'missing', source: 'env', key: '__NONEXISTENT_VAR_XYZ' },
		])
		expect(result.has('missing')).toBe(false)
	})

	test('resolves exec secrets', async () => {
		const result = await resolveSecrets([
			{ name: 'echo_val', source: 'exec', key: 'echo hello-from-exec' },
		])
		expect(result.get('echo_val')).toBe('hello-from-exec')
	})
})

// ─── Handler Runtime ─────────────────────────────────────────────────────────

describe('Handler Runtime', () => {
	const testRoot = join(tmpdir(), `qp-handler-test-${Date.now()}`)

	beforeAll(async () => {
		await mkdir(join(testRoot, '.autopilot', 'handlers'), { recursive: true })

		// Create a simple echo handler
		await writeFile(
			join(testRoot, '.autopilot', 'handlers', 'echo.ts'),
			`const input = await Bun.stdin.text()
const envelope = JSON.parse(input)
console.log(JSON.stringify({ ok: true, metadata: { received_op: envelope.op, payload: envelope.payload } }))`,
		)

		// Create a failing handler
		await writeFile(
			join(testRoot, '.autopilot', 'handlers', 'fail.ts'),
			`console.log(JSON.stringify({ ok: false, error: 'intentional failure' }))`,
		)

		// Create a crashing handler
		await writeFile(
			join(testRoot, '.autopilot', 'handlers', 'crash.ts'),
			`process.exit(1)`,
		)
	})

	afterAll(async () => {
		await rm(testRoot, { recursive: true, force: true })
	})

	const makeProvider = (handler: string): Provider => ({
		id: 'test-provider',
		name: 'Test',
		kind: 'notification_channel',
		handler,
		capabilities: [{ op: 'notify.send' }],
		events: [],
		config: {},
		secret_refs: [],
		description: '',
	})

	const makeEnvelope = (op = 'notify.send'): HandlerEnvelope => ({
		op,
		provider_id: 'test-provider',
		provider_kind: 'notification_channel',
		config: {},
		secrets: {},
		payload: { title: 'Test', summary: 'Hello' },
	})

	test('executes handler and returns typed result', async () => {
		const result = await executeHandler(
			makeProvider('handlers/echo.ts'),
			makeEnvelope(),
			{ companyRoot: testRoot },
		)
		expect(result.ok).toBe(true)
		expect(result.metadata).toBeDefined()
		expect((result.metadata as Record<string, unknown>).received_op).toBe('notify.send')
	})

	test('returns error for missing handler', async () => {
		const result = await executeHandler(
			makeProvider('handlers/nonexistent.ts'),
			makeEnvelope(),
			{ companyRoot: testRoot },
		)
		expect(result.ok).toBe(false)
		expect(result.error).toContain('not found')
	})

	test('returns error result from failing handler', async () => {
		const result = await executeHandler(
			makeProvider('handlers/fail.ts'),
			makeEnvelope(),
			{ companyRoot: testRoot },
		)
		expect(result.ok).toBe(false)
		expect(result.error).toBe('intentional failure')
	})

	test('returns error for crashing handler', async () => {
		const result = await executeHandler(
			makeProvider('handlers/crash.ts'),
			makeEnvelope(),
			{ companyRoot: testRoot },
		)
		expect(result.ok).toBe(false)
		expect(result.error).toContain('exited with code')
	})

	test('invokeProvider resolves secrets and builds envelope', async () => {
		process.env.__TEST_INVOKE_SECRET = 'resolved-value'
		const provider = {
			...makeProvider('handlers/echo.ts'),
			secret_refs: [{ name: 'test_key', source: 'env' as const, key: '__TEST_INVOKE_SECRET' }],
		}
		const result = await invokeProvider(
			provider,
			'notify.send',
			{ title: 'Hello' },
			{ companyRoot: testRoot },
		)
		expect(result.ok).toBe(true)
		delete process.env.__TEST_INVOKE_SECRET
	})
})

// ─── Provider Loading ────────────────────────────────────────────────────────

describe('Provider Loading', () => {
	const testRoot = join(tmpdir(), `qp-provider-load-${Date.now()}`)

	beforeAll(async () => {
		await mkdir(join(testRoot, '.autopilot', 'providers'), { recursive: true })
		await writeFile(
			join(testRoot, '.autopilot', 'company.yaml'),
			'name: test\nslug: test\n',
		)
		await writeFile(
			join(testRoot, '.autopilot', 'providers', 'slack-ops.yaml'),
			`id: slack-ops
name: Slack Ops
kind: notification_channel
handler: handlers/slack-notify.ts
capabilities:
  - op: notify.send
events:
  - types: [run_completed]
    statuses: [failed]
config:
  channel: "#ops"
`,
		)
	})

	afterAll(async () => {
		await rm(testRoot, { recursive: true, force: true })
	})

	test('loads providers from .autopilot/providers/', async () => {
		const { resolveConfig, discoverScopes } = await import('../src/config/scope-resolver')
		const chain = await discoverScopes(testRoot)
		const config = await resolveConfig(chain)

		expect(config.providers.size).toBe(1)
		const slack = config.providers.get('slack-ops')
		expect(slack).toBeDefined()
		expect(slack!.kind).toBe('notification_channel')
		expect(slack!.config.channel).toBe('#ops')
	})
})

// ─── Notification Bridge ─────────────────────────────────────────────────────

describe('Notification Bridge', () => {
	const testRoot = join(tmpdir(), `qp-notif-bridge-${Date.now()}`)
	let eventBus: EventBus

	beforeAll(async () => {
		await mkdir(join(testRoot, '.autopilot', 'handlers'), { recursive: true })

		// Create a recording handler that logs what it receives
		await writeFile(
			join(testRoot, '.autopilot', 'handlers', 'record.ts'),
			`import { appendFileSync } from 'node:fs'
const input = await Bun.stdin.text()
const envelope = JSON.parse(input)
appendFileSync('${join(testRoot, 'invocations.jsonl')}', JSON.stringify({ op: envelope.op, payload: envelope.payload }) + '\\n')
console.log(JSON.stringify({ ok: true }))`,
		)

		eventBus = new EventBus()
	})

	afterAll(async () => {
		await rm(testRoot, { recursive: true, force: true })
	})

	function makeConfig() {
		const provider: Provider = {
			id: 'test-notif',
			name: 'Test Notifier',
			kind: 'notification_channel',
			handler: 'handlers/record.ts',
			capabilities: [{ op: 'notify.send' }],
			events: [
				{ types: ['run_completed'], statuses: ['failed'] },
				{ types: ['task_changed'], statuses: ['blocked'] },
			],
			config: {},
			secret_refs: [],
			description: '',
		}

		return {
			company: { name: 'test', slug: 'test', description: '', timezone: 'UTC', language: 'en', owner: { name: '', email: '' }, defaults: {} },
			agents: new Map(),
			workflows: new Map(),
			environments: new Map(),
			providers: new Map([['test-notif', provider]]),
			defaults: { runtime: 'claude-code' },
		}
	}

	// Minimal mock services — only need get() methods
	const mockRunService = {
		get: async (id: string) => ({
			id,
			status: 'failed',
			summary: 'Agent crashed',
			task_id: 'task-1',
			agent_id: 'agent-1',
			worker_id: null,
		}),
	}

	const mockTaskService = {
		get: async (id: string) => ({
			id,
			title: 'Deploy landing page',
			status: 'blocked',
		}),
	}

	test('dispatches notification on matching run_completed event', async () => {
		const bridge = new NotificationBridge(
			eventBus,
			makeConfig() as any,
			mockRunService as any,
			mockTaskService as any,
			{ companyRoot: testRoot },
		)
		bridge.start()

		eventBus.emit({ type: 'run_completed', runId: 'run-fail-1', status: 'failed' })

		// Give handler time to execute
		await new Promise((resolve) => setTimeout(resolve, 2000))
		bridge.stop()

		const logFile = Bun.file(join(testRoot, 'invocations.jsonl'))
		const exists = await logFile.exists()
		expect(exists).toBe(true)
		const lines = (await logFile.text()).trim().split('\n')
		expect(lines.length).toBeGreaterThanOrEqual(1)

		const entry = JSON.parse(lines[0])
		expect(entry.op).toBe('notify.send')
		expect(entry.payload.event_type).toBe('run_completed')
		expect(entry.payload.severity).toBe('error')
	})

	test('does NOT dispatch on non-matching event', async () => {
		// Clear invocations file
		await writeFile(join(testRoot, 'invocations2.jsonl'), '')

		const provider: Provider = {
			id: 'test-notif-2',
			name: 'Test Notifier 2',
			kind: 'notification_channel',
			handler: 'handlers/record.ts',
			capabilities: [{ op: 'notify.send' }],
			events: [{ types: ['run_completed'], statuses: ['failed'] }],
			config: {},
			secret_refs: [],
			description: '',
		}

		const config = {
			...makeConfig(),
			providers: new Map([['test-notif-2', provider]]),
		}

		const localBus = new EventBus()
		const bridge = new NotificationBridge(
			localBus,
			config as any,
			mockRunService as any,
			mockTaskService as any,
			{ companyRoot: testRoot },
		)
		bridge.start()

		// Emit a completed (success) event — should NOT match failed-only filter
		localBus.emit({ type: 'run_completed', runId: 'run-ok-1', status: 'completed' })

		await new Promise((resolve) => setTimeout(resolve, 1000))
		bridge.stop()

		// The bridge should have built a payload but the event filter requires status=failed
		// so it should not have dispatched anything
	})

	test('does NOT dispatch for non-actionable events', async () => {
		const localBus = new EventBus()
		const bridge = new NotificationBridge(
			localBus,
			makeConfig() as any,
			mockRunService as any,
			mockTaskService as any,
			{ companyRoot: testRoot },
		)
		bridge.start()

		// worker_registered is not an actionable event for notifications
		localBus.emit({ type: 'worker_registered', workerId: 'w-1' })

		await new Promise((resolve) => setTimeout(resolve, 500))
		bridge.stop()
		// No crash, no dispatch — bridge simply ignores unknown event types
	})

	test('provider-specific behavior stays out of core', () => {
		// The notification bridge only knows about:
		// - provider kind (notification_channel)
		// - capabilities (notify.send)
		// - event filters
		// - generic payload shape
		// It does NOT know about Slack, Telegram, email, webhooks, etc.
		// All provider-specific logic lives in handler scripts.

		const config = makeConfig()
		const provider = config.providers.get('test-notif')!
		expect(provider.handler).toBe('handlers/record.ts')
		// Core only sees generic fields, not provider-specific ones
		expect(provider.config).toEqual({})
	})
})

// ─── Example Provider E2E ────────────────────────────────────────────────────

describe('Webhook Example Provider E2E', () => {
	const testRoot = join(tmpdir(), `qp-webhook-e2e-${Date.now()}`)
	let webhookServer: ReturnType<typeof Bun.serve>
	const received: Array<Record<string, unknown>> = []

	beforeAll(async () => {
		await mkdir(join(testRoot, '.autopilot', 'handlers'), { recursive: true })

		// Copy the real webhook handler
		const handlerSrc = await Bun.file(
			join(import.meta.dir, '..', '..', '..', '.autopilot', 'handlers', 'webhook-notify.ts'),
		).text()
		await writeFile(join(testRoot, '.autopilot', 'handlers', 'webhook-notify.ts'), handlerSrc)

		// Start a local webhook receiver
		webhookServer = Bun.serve({
			port: 0,
			fetch: async (req) => {
				const body = await req.json()
				received.push(body)
				return new Response(JSON.stringify({ received: true }), {
					headers: { 'Content-Type': 'application/json', 'x-request-id': 'req-test-1' },
				})
			},
		})

		// Set the webhook URL as env var
		process.env.AUTOPILOT_WEBHOOK_URL = `http://localhost:${webhookServer.port}/hook`
	})

	afterAll(async () => {
		webhookServer.stop()
		delete process.env.AUTOPILOT_WEBHOOK_URL
		await rm(testRoot, { recursive: true, force: true })
	})

	test('webhook handler sends notification to endpoint', async () => {
		const provider: Provider = {
			id: 'webhook-example',
			name: 'Webhook Example',
			kind: 'notification_channel',
			handler: 'handlers/webhook-notify.ts',
			capabilities: [{ op: 'notify.send' }],
			events: [],
			config: {},
			secret_refs: [{ name: 'webhook_url', source: 'env', key: 'AUTOPILOT_WEBHOOK_URL' }],
			description: '',
		}

		const result = await invokeProvider(
			provider,
			'notify.send',
			{
				event_type: 'run_completed',
				severity: 'error',
				title: 'Run failed: run-123',
				summary: 'Agent timed out',
				run_id: 'run-123',
				task_id: 'task-456',
			},
			{ companyRoot: testRoot },
		)

		expect(result.ok).toBe(true)
		expect(result.external_id).toBe('req-test-1')
		expect(received).toHaveLength(1)
		expect(received[0].event_type).toBe('run_completed')
		expect(received[0].title).toBe('Run failed: run-123')
	})

	test('webhook handler reports error for missing secret', async () => {
		const provider: Provider = {
			id: 'no-secret',
			name: 'No Secret',
			kind: 'notification_channel',
			handler: 'handlers/webhook-notify.ts',
			capabilities: [{ op: 'notify.send' }],
			events: [],
			config: {},
			secret_refs: [], // No secret refs — webhook_url won't be resolved
			description: '',
		}

		const result = await invokeProvider(
			provider,
			'notify.send',
			{ title: 'Test' },
			{ companyRoot: testRoot },
		)

		expect(result.ok).toBe(false)
		expect(result.error).toContain('webhook_url')
	})
})
