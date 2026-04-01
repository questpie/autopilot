/**
 * Durable streams module tests — URL builders, health check, stream CRUD.
 * Uses mocked fetch for HTTP calls.
 */
import { describe, test, expect, afterEach } from 'bun:test'
import {
	getDurableStreamBaseUrl,
	getSessionStreamUrl,
	checkDurableStreamHealth,
	createSessionStream,
	appendToSessionStream,
} from '../src/session/durable'

const originalFetch = globalThis.fetch

afterEach(() => {
	globalThis.fetch = originalFetch
})

// ─── URL builders ───────────────────────────────────────────────────────────

describe('URL builders', () => {
	test('getDurableStreamBaseUrl returns http URL', () => {
		const url = getDurableStreamBaseUrl()
		expect(url).toMatch(/^https?:\/\//)
	})

	test('getSessionStreamUrl includes encoded session ID', () => {
		const url = getSessionStreamUrl('session-abc-dev')
		expect(url).toContain('session-abc-dev')
		expect(url).toContain('/v1/stream/sessions/')
	})

	test('getSessionStreamUrl encodes special chars', () => {
		const url = getSessionStreamUrl('session/with spaces&special')
		expect(url).toContain('session%2Fwith%20spaces%26special')
	})

	test('getSessionStreamUrl builds on base URL', () => {
		const base = getDurableStreamBaseUrl()
		const url = getSessionStreamUrl('s1')
		expect(url.startsWith(base)).toBe(true)
	})
})

// ─── Health check ───────────────────────────────────────────────────────────

describe('checkDurableStreamHealth', () => {
	test('returns ok:true on 200 response', async () => {
		globalThis.fetch = (async () => new Response('OK', { status: 200 })) as typeof fetch
		const result = await checkDurableStreamHealth()
		expect(result.ok).toBe(true)
		expect(result.latencyMs).toBeGreaterThanOrEqual(0)
	})

	test('returns ok:false on 500 response', async () => {
		globalThis.fetch = (async () => new Response('Error', { status: 500 })) as typeof fetch
		const result = await checkDurableStreamHealth()
		expect(result.ok).toBe(false)
	})

	test('returns ok:false on network error', async () => {
		globalThis.fetch = (async () => { throw new Error('ECONNREFUSED') }) as typeof fetch
		const result = await checkDurableStreamHealth()
		expect(result.ok).toBe(false)
		expect(result.latencyMs).toBeDefined()
	})

	test('returns latencyMs in all cases', async () => {
		globalThis.fetch = (async () => new Response('OK', { status: 200 })) as typeof fetch
		const result = await checkDurableStreamHealth()
		expect(typeof result.latencyMs).toBe('number')
	})
})

// ─── Stream CRUD ────────────────────────────────────────────────────────────

describe('createSessionStream', () => {
	test('sends PUT request to session URL', async () => {
		let capturedMethod: string | undefined
		let capturedUrl: string | undefined
		globalThis.fetch = (async (url: unknown, opts: unknown) => {
			capturedUrl = url as string
			capturedMethod = (opts as RequestInit).method
			return new Response('', { status: 201 })
		}) as typeof fetch

		await createSessionStream('s-123')
		expect(capturedMethod).toBe('PUT')
		expect(capturedUrl).toContain('s-123')
	})

	test('does not throw on 409 conflict', async () => {
		globalThis.fetch = (async () => new Response('Conflict', { status: 409 })) as typeof fetch
		await createSessionStream('s-existing') // should not throw
	})

	test('does not throw on network error', async () => {
		globalThis.fetch = (async () => { throw new Error('ECONNREFUSED') }) as typeof fetch
		await createSessionStream('s-fail') // graceful degradation
	})
})

describe('appendToSessionStream', () => {
	test('sends POST with JSON chunk', async () => {
		let capturedBody: string | undefined
		let capturedMethod: string | undefined
		globalThis.fetch = (async (_: unknown, opts: unknown) => {
			capturedMethod = (opts as RequestInit).method
			capturedBody = (opts as RequestInit).body as string
			return new Response('', { status: 200 })
		}) as typeof fetch

		await appendToSessionStream('s-1', { type: 'text_delta', content: 'hello' })
		expect(capturedMethod).toBe('POST')
		expect(JSON.parse(capturedBody!)).toEqual({ type: 'text_delta', content: 'hello' })
	})

	test('does not throw on network error', async () => {
		globalThis.fetch = (async () => { throw new Error('timeout') }) as typeof fetch
		await appendToSessionStream('s-1', { type: 'text' }) // fire-and-forget
	})
})
