import { test, expect, describe, afterAll } from 'bun:test'
import type { WorkerEvent, ExternalAction, SecretRef } from '@questpie/autopilot-spec'
import { executeActions } from '../src/actions/webhook'

// Start a tiny test HTTP server to receive webhooks
const receivedRequests: Array<{
	method: string
	url: string
	headers: Record<string, string>
	body: string
}> = []

const server = Bun.serve({
	port: 0, // random port
	async fetch(req) {
		receivedRequests.push({
			method: req.method,
			url: req.url,
			headers: Object.fromEntries(req.headers.entries()),
			body: await req.text(),
		})
		return new Response(JSON.stringify({ ok: true }), { status: 200 })
	},
})

afterAll(() => {
	server.stop()
})

function collectEvents(fn: (emit: (e: WorkerEvent) => void) => Promise<void>): Promise<WorkerEvent[]> {
	const events: WorkerEvent[] = []
	return fn((e) => events.push(e)).then(() => events)
}

describe('Webhook Action', () => {
	test('successful webhook emits external_action event with status', async () => {
		const secrets: SecretRef[] = [
			{ name: 'test-url', source: 'env', key: '__WEBHOOK_URL' },
		]
		process.env.__WEBHOOK_URL = `http://localhost:${server.port}/test`

		const actions: ExternalAction[] = [
			{ kind: 'webhook', url_ref: 'test-url', method: 'POST', body: '{"msg":"hello"}' },
		]

		const events = await collectEvents((emit) => executeActions(actions, emit, secrets))
		expect(events.length).toBe(1)
		expect(events[0].type).toBe('external_action')
		expect(events[0].summary).toContain('200')
		expect(events[0].metadata?.action_kind).toBe('webhook')

		delete process.env.__WEBHOOK_URL
	})

	test('missing URL secret ref emits error event', async () => {
		const actions: ExternalAction[] = [
			{ kind: 'webhook', url_ref: 'nonexistent-url', method: 'POST' },
		]

		const events = await collectEvents((emit) => executeActions(actions, emit, []))
		expect(events.length).toBe(1)
		expect(events[0].type).toBe('external_action')
		expect(events[0].summary).toContain('failed')
		expect(events[0].summary).toContain('nonexistent-url')
	})

	test('idempotency key is set as request header', async () => {
		receivedRequests.length = 0
		const secrets: SecretRef[] = [
			{ name: 'idem-url', source: 'env', key: '__IDEM_URL' },
		]
		process.env.__IDEM_URL = `http://localhost:${server.port}/idem`

		const actions: ExternalAction[] = [
			{ kind: 'webhook', url_ref: 'idem-url', method: 'POST', idempotency_key: 'key-123' },
		]

		await collectEvents((emit) => executeActions(actions, emit, secrets))
		expect(receivedRequests.length).toBeGreaterThan(0)
		const last = receivedRequests[receivedRequests.length - 1]
		expect(last.headers['idempotency-key']).toBe('key-123')

		delete process.env.__IDEM_URL
	})

	test('headers from secret ref are applied to request', async () => {
		receivedRequests.length = 0
		process.env.__HDR_URL = `http://localhost:${server.port}/headers`
		process.env.__HDR_JSON = JSON.stringify({ Authorization: 'Bearer tok123' })

		const secrets: SecretRef[] = [
			{ name: 'hdr-url', source: 'env', key: '__HDR_URL' },
			{ name: 'hdr-headers', source: 'env', key: '__HDR_JSON' },
		]

		const actions: ExternalAction[] = [
			{ kind: 'webhook', url_ref: 'hdr-url', method: 'POST', headers_ref: 'hdr-headers' },
		]

		await collectEvents((emit) => executeActions(actions, emit, secrets))
		const last = receivedRequests[receivedRequests.length - 1]
		expect(last.headers['authorization']).toBe('Bearer tok123')

		delete process.env.__HDR_URL
		delete process.env.__HDR_JSON
	})

	test('secret resolution error is reported as event', async () => {
		delete process.env.__MISSING_WEBHOOK
		const secrets: SecretRef[] = [
			{ name: 'missing-secret', source: 'env', key: '__MISSING_WEBHOOK' },
		]

		const actions: ExternalAction[] = [
			{ kind: 'webhook', url_ref: 'some-url', method: 'POST' },
		]

		const events = await collectEvents((emit) => executeActions(actions, emit, secrets))
		// Should have at least a secret warning + action failure
		const warnings = events.filter((e) => e.summary.includes('Secret resolution'))
		expect(warnings.length).toBeGreaterThan(0)
	})
})
