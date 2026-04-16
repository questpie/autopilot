/**
 * Tests for bound conversation loop V1 — outbound delivery.
 *
 * Covers:
 * - Bound task events dispatch to the bound conversation provider
 * - conversation_id / thread_id reach the handler correctly
 * - run_completed with preview_file artifacts reaches the bound conversation payload
 * - Unbound tasks do not trigger conversation delivery
 * - Existing notification_channel behavior remains unchanged
 * - Example conversation provider handles both conversation.ingest and notify.send
 */
import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { mkdir, rm, writeFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { Provider } from '@questpie/autopilot-spec'
import { NotificationBridge } from '../src/providers/notification-bridge'
import { EventBus } from '../src/events/event-bus'
import { invokeProvider } from '../src/providers/handler-runtime'

// ─── Bound Conversation Delivery ─────────────────────────────────────────────

describe('Bound Conversation Outbound', () => {
	const testRoot = join(tmpdir(), `qp-conv-loop-${Date.now()}`)
	const invocationsFile = join(testRoot, 'conv-invocations.jsonl')

	// Handler that records what it receives
	const RECORD_HANDLER = `import { appendFileSync } from 'node:fs'
const input = await Bun.stdin.text()
const envelope = JSON.parse(input)
if (envelope.op === 'notify.send') {
  appendFileSync('${invocationsFile}', JSON.stringify({
    op: envelope.op,
    conversation_id: envelope.payload.conversation_id,
    thread_id: envelope.payload.thread_id,
    title: envelope.payload.title,
    preview_url: envelope.payload.preview_url,
    task_id: envelope.payload.task_id,
    binding_mode: envelope.payload.binding_mode,
  }) + '\\n')
}
console.log(JSON.stringify({ ok: true }))`

	const NOTIF_RECORD_HANDLER = `import { appendFileSync } from 'node:fs'
const input = await Bun.stdin.text()
const envelope = JSON.parse(input)
appendFileSync('${join(testRoot, 'notif-invocations.jsonl')}', JSON.stringify({
  op: envelope.op,
  title: envelope.payload.title,
  conversation_id: envelope.payload.conversation_id,
}) + '\\n')
console.log(JSON.stringify({ ok: true }))`

	beforeAll(async () => {
		await mkdir(join(testRoot, '.autopilot', 'handlers'), { recursive: true })
		await writeFile(join(testRoot, '.autopilot', 'handlers', 'conv-record.ts'), RECORD_HANDLER)
		await writeFile(join(testRoot, '.autopilot', 'handlers', 'notif-record.ts'), NOTIF_RECORD_HANDLER)
	})

	afterAll(async () => {
		await rm(testRoot, { recursive: true, force: true })
	})

	function makeConvProvider(id: string): Provider {
		return {
			id,
			name: id,
			kind: 'conversation_channel',
			handler: 'handlers/conv-record.ts',
			capabilities: [{ op: 'conversation.ingest' }, { op: 'notify.send' }],
			events: [
				{ types: ['run_completed'], statuses: ['failed', 'completed'] },
				{ types: ['task_changed'], statuses: ['blocked'] },
			],
			config: {},
			secret_refs: [],
			description: '',
		}
	}

	function makeNotifProvider(): Provider {
		return {
			id: 'webhook-notif',
			name: 'Webhook',
			kind: 'notification_channel',
			handler: 'handlers/notif-record.ts',
			capabilities: [{ op: 'notify.send' }],
			events: [{ types: ['run_completed'], statuses: ['failed'] }],
			config: {},
			secret_refs: [],
			description: '',
		}
	}

	const mockRunService = {
		get: async (id: string) => ({
			id,
			status: 'failed',
			summary: 'Agent crashed',
			task_id: 'task-bound-1',
			agent_id: 'dev',
		}),
	}

	const mockTaskService = {
		get: async (id: string) => ({
			id,
			title: 'Build landing page',
			status: 'blocked',
		}),
	}

	const mockArtifactService = {
		listForRun: async (runId: string) => {
			if (runId === 'run-with-preview') {
				return [{ kind: 'preview_file', title: 'index.html', ref_kind: 'inline', ref_value: '<html><body>Hello</body></html>' }]
			}
			return []
		},
		resolvePreviewUrl: async (runId: string, orchestratorUrl?: string) => {
			if (runId === 'run-with-preview') {
				const base = orchestratorUrl ?? ''
				return `${base}/api/previews/run-with-preview/index.html`
			}
			return null
		},
	}

	test('bound task event dispatches to conversation provider with conversation context', async () => {
		const eventBus = new EventBus()
		const convProvider = makeConvProvider('conv-loop-1')

		const mockBindingService = {
			listForTask: async (taskId: string) => {
				if (taskId === 'task-bound-1') {
					return [{
						id: 'bind-1',
						provider_id: 'conv-loop-1',
						external_conversation_id: 'tg-chat-42',
						external_thread_id: 'tg-thread-7',
						mode: 'task_thread',
						task_id: 'task-bound-1',
					}]
				}
				return []
			},
		}

		const config = {
			company: {} as any,
			agents: new Map(),
			workflows: new Map(),
			environments: new Map(),
			providers: new Map([['conv-loop-1', convProvider]]),
			capabilityProfiles: new Map(),
			defaults: { runtime: 'claude-code' },
		}

		const bridge = new NotificationBridge(
			eventBus,
			config as any,
			mockRunService as any,
			mockTaskService as any,
			mockArtifactService as any,
			mockBindingService as any,
			{ companyRoot: testRoot },
		)
		bridge.start()

		eventBus.emit({ type: 'run_completed', runId: 'run-1', status: 'failed' })

		await new Promise((resolve) => setTimeout(resolve, 2000))
		bridge.stop()

		const logFile = Bun.file(invocationsFile)
		expect(await logFile.exists()).toBe(true)
		const lines = (await logFile.text()).trim().split('\n')
		expect(lines.length).toBeGreaterThanOrEqual(1)

		const entry = JSON.parse(lines[0])
		expect(entry.op).toBe('notify.send')
		expect(entry.conversation_id).toBe('tg-chat-42')
		expect(entry.thread_id).toBe('tg-thread-7')
		expect(entry.task_id).toBe('task-bound-1')
		expect(entry.binding_mode).toBe('task_thread')

		// Clean up for next test
		await writeFile(invocationsFile, '')
	})

	test('unbound task does NOT trigger conversation delivery', async () => {
		const eventBus = new EventBus()
		const convProvider = makeConvProvider('conv-loop-2')

		const mockBindingService = {
			listForTask: async () => [],
		}

		const config = {
			company: {} as any,
			agents: new Map(),
			workflows: new Map(),
			environments: new Map(),
			providers: new Map([['conv-loop-2', convProvider]]),
			capabilityProfiles: new Map(),
			defaults: { runtime: 'claude-code' },
		}

		const bridge = new NotificationBridge(
			eventBus,
			config as any,
			mockRunService as any,
			mockTaskService as any,
			mockArtifactService as any,
			mockBindingService as any,
			{ companyRoot: testRoot },
		)
		bridge.start()

		eventBus.emit({ type: 'run_completed', runId: 'run-unbound', status: 'failed' })

		await new Promise((resolve) => setTimeout(resolve, 1000))
		bridge.stop()

		// The conv-record handler should not have been invoked
		const logFile = Bun.file(invocationsFile)
		const content = await logFile.exists() ? (await logFile.text()).trim() : ''
		expect(content).toBe('')
	})

	test('preview_file artifact derives preview URL in bound conversation payload', async () => {
		const eventBus = new EventBus()
		const convProvider = makeConvProvider('conv-loop-3')

		const previewRunService = {
			get: async () => ({
				id: 'run-with-preview',
				status: 'completed',
				summary: 'Built homepage',
				task_id: 'task-preview-bound',
				agent_id: 'dev',
			}),
		}

		const mockBindingService = {
			listForTask: async (taskId: string) => {
				if (taskId === 'task-preview-bound') {
					return [{
						id: 'bind-preview',
						provider_id: 'conv-loop-3',
						external_conversation_id: 'slack-channel-1',
						external_thread_id: null,
						mode: 'task_thread',
						task_id: 'task-preview-bound',
					}]
				}
				return []
			},
		}

		const config = {
			company: {} as any,
			agents: new Map(),
			workflows: new Map(),
			environments: new Map(),
			providers: new Map([['conv-loop-3', convProvider]]),
			capabilityProfiles: new Map(),
			defaults: { runtime: 'claude-code' },
		}

		const bridge = new NotificationBridge(
			eventBus,
			config as any,
			previewRunService as any,
			mockTaskService as any,
			mockArtifactService as any,
			mockBindingService as any,
			{ companyRoot: testRoot },
		)
		bridge.start()

		eventBus.emit({ type: 'run_completed', runId: 'run-with-preview', status: 'completed' })

		await new Promise((resolve) => setTimeout(resolve, 2000))
		bridge.stop()

		const logFile = Bun.file(invocationsFile)
		const content = (await logFile.text()).trim()
		const lines = content.split('\n').filter(Boolean)
		const entry = JSON.parse(lines[lines.length - 1])
		expect(entry.conversation_id).toBe('slack-channel-1')
		expect(entry.preview_url).toBe('/api/previews/run-with-preview/index.html')

		await writeFile(invocationsFile, '')
	})

	test('notification_channel still receives events (no regression)', async () => {
		const notifFile = join(testRoot, 'notif-invocations.jsonl')
		await writeFile(notifFile, '')

		const eventBus = new EventBus()
		const notifProvider = makeNotifProvider()

		const mockBindingService = { listForTask: async () => [] }

		const config = {
			company: {} as any,
			agents: new Map(),
			workflows: new Map(),
			environments: new Map(),
			providers: new Map([['webhook-notif', notifProvider]]),
			capabilityProfiles: new Map(),
			defaults: { runtime: 'claude-code' },
		}

		const bridge = new NotificationBridge(
			eventBus,
			config as any,
			mockRunService as any,
			mockTaskService as any,
			mockArtifactService as any,
			mockBindingService as any,
			{ companyRoot: testRoot },
		)
		bridge.start()

		eventBus.emit({ type: 'run_completed', runId: 'run-notif-1', status: 'failed' })

		await new Promise((resolve) => setTimeout(resolve, 2000))
		bridge.stop()

		const logFile = Bun.file(notifFile)
		expect(await logFile.exists()).toBe(true)
		const lines = (await logFile.text()).trim().split('\n')
		expect(lines.length).toBeGreaterThanOrEqual(1)

		const entry = JSON.parse(lines[0])
		expect(entry.op).toBe('notify.send')
		// notification_channel should NOT have conversation_id
		expect(entry.conversation_id).toBeUndefined()
	})

	test('both notification_channel and conversation_channel receive events for same task', async () => {
		const notifFile = join(testRoot, 'notif-invocations.jsonl')
		await writeFile(notifFile, '')
		await writeFile(invocationsFile, '')

		const eventBus = new EventBus()
		const notifProvider = makeNotifProvider()
		const convProvider = makeConvProvider('conv-loop-both')

		const mockBindingService = {
			listForTask: async (taskId: string) => {
				if (taskId === 'task-bound-1') {
					return [{
						id: 'bind-both',
						provider_id: 'conv-loop-both',
						external_conversation_id: 'chat-both',
						external_thread_id: null,
						mode: 'task_thread',
						task_id: 'task-bound-1',
					}]
				}
				return []
			},
		}

		const config = {
			company: {} as any,
			agents: new Map(),
			workflows: new Map(),
			environments: new Map(),
			providers: new Map([
				['webhook-notif', notifProvider],
				['conv-loop-both', convProvider],
			]),
			capabilityProfiles: new Map(),
			defaults: { runtime: 'claude-code' },
		}

		const bridge = new NotificationBridge(
			eventBus,
			config as any,
			mockRunService as any,
			mockTaskService as any,
			mockArtifactService as any,
			mockBindingService as any,
			{ companyRoot: testRoot },
		)
		bridge.start()

		eventBus.emit({ type: 'run_completed', runId: 'run-both', status: 'failed' })

		await new Promise((resolve) => setTimeout(resolve, 2000))
		bridge.stop()

		// notification_channel should have received
		const notifContent = (await Bun.file(notifFile).text()).trim()
		expect(notifContent.length).toBeGreaterThan(0)
		const notifEntry = JSON.parse(notifContent.split('\n')[0])
		expect(notifEntry.conversation_id).toBeUndefined()

		// conversation_channel should have received with conversation context
		const convContent = (await Bun.file(invocationsFile).text()).trim()
		expect(convContent.length).toBeGreaterThan(0)
		const convEntry = JSON.parse(convContent.split('\n')[0])
		expect(convEntry.conversation_id).toBe('chat-both')
	})
})

// ─── Example Handler Dual-Op E2E ─────────────────────────────────────────────

describe('Text Conversation Handler — notify.send', () => {
	const testRoot = join(tmpdir(), `qp-conv-notify-e2e-${Date.now()}`)

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
		capabilities: [{ op: 'conversation.ingest' }, { op: 'notify.send' }],
		events: [],
		config: {},
		secret_refs: [],
		description: '',
	}

	test('notify.send with conversation context is delivered', async () => {
		const result = await invokeProvider(
			provider,
			'notify.send',
			{
				event_type: 'run_completed',
				severity: 'error',
				title: 'Run failed: run-123',
				summary: 'Agent crashed',
				conversation_id: 'tg-chat-99',
				thread_id: 'tg-thread-5',
				preview_url: '/api/previews/run-123/index.html',
				task_url: 'http://localhost:7778/api/tasks/task-1',
			},
			{ companyRoot: testRoot },
		)

		expect(result.ok).toBe(true)
		expect(result.metadata).toBeDefined()
		const meta = result.metadata as Record<string, unknown>
		expect(meta.delivered).toBe(true)
		expect(meta.conversation_id).toBe('tg-chat-99')
		expect(meta.thread_id).toBe('tg-thread-5')
		expect(meta.title).toBe('Run failed: run-123')
		expect(meta.preview_url).toBe('/api/previews/run-123/index.html')
	})

	test('notify.send without conversation_id is skipped', async () => {
		const result = await invokeProvider(
			provider,
			'notify.send',
			{ event_type: 'run_completed', severity: 'info', title: 'Test', summary: 'Test' },
			{ companyRoot: testRoot },
		)

		expect(result.ok).toBe(true)
		const meta = result.metadata as Record<string, unknown>
		expect(meta.skipped).toBe(true)
	})

	test('conversation.ingest still works on same handler', async () => {
		const result = await invokeProvider(
			provider,
			'conversation.ingest',
			{ conversation_id: 'c1', text: '/approve' },
			{ companyRoot: testRoot },
		)

		expect(result.ok).toBe(true)
		const meta = result.metadata as Record<string, unknown>
		expect(meta.action).toBe('task.approve')
	})
})
