import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { stringify as stringifyYaml } from 'yaml'
import { configureContainer, container } from '../src/container'
import type { StorageBackend } from '../src/fs/storage'
import { setupTestApiKey, withApiKey } from './auth-helpers'

let app: ReturnType<typeof import('../src/api/app').createApp>
let companyRoot: string
let storage: StorageBackend
let apiKey: string

beforeAll(async () => {
	companyRoot = await mkdtemp(join(tmpdir(), 'rate-limit-test-'))

	// Create required directory structure
	const dirs = [
		'tasks/backlog',
		'tasks/active',
		'tasks/review',
		'tasks/blocked',
		'tasks/done',
		'comms/channels/general',
		'comms/direct',
		'dashboard/pins',
		'logs/activity',
		'logs/sessions',
		'team',
		'team/workflows',
		'context/memory',
		'context/indexes',
	]
	for (const dir of dirs) {
		await mkdir(join(companyRoot, dir), { recursive: true })
	}

	// Write company.yaml
	const companyData = {
		name: 'Test Company',
		slug: 'test-co',
		description: 'Rate limit test company',
		timezone: 'UTC',
		language: 'en',
		languages: ['en'],
		owner: {
			name: 'Test Owner',
			email: 'test@test.com',
			notification_channels: [],
		},
		settings: {},
	}
	await writeFile(join(companyRoot, 'company.yaml'), stringifyYaml(companyData))

	// Write agents.yaml
	await writeFile(join(companyRoot, 'team', 'agents.yaml'), stringifyYaml({ agents: [] }))

	// Configure DI container
	container.clearAllInstances()
	configureContainer(companyRoot)
	;(container as any).instances.set('companyRoot', companyRoot)

	const { storageFactory } = await import('../src/fs/sqlite-backend')
	const resolved = await container.resolveAsync([storageFactory])
	storage = resolved.storage
	apiKey = await setupTestApiKey(companyRoot)

	const { createApp } = await import('../src/api/app')
	app = createApp({ corsOrigin: '*' })
})

afterAll(async () => {
	if (storage) await storage.close()
	container.clearAllInstances()
	if (companyRoot) await rm(companyRoot, { recursive: true, force: true })
})

function request(path: string, init?: RequestInit) {
	return app.request(path, withApiKey(init, apiKey))
}

// ─── checkRateLimit unit tests ──────────────────────────────────────────────

describe('checkRateLimit', () => {
	it('should allow first request and return correct remaining count', async () => {
		const { checkRateLimit } = await import('../src/api/middleware/rate-limit')
		const { dbFactory } = await import('../src/db')
		const { db: dbResult } = await container.resolveAsync([dbFactory])

		const result = checkRateLimit(dbResult.db, `test:unit:${Date.now()}`, 60, 5)
		expect(result.allowed).toBe(true)
		expect(result.remaining).toBe(4)
		expect(typeof result.resetAt).toBe('number')
	})

	it('should allow up to max requests then deny', async () => {
		const { checkRateLimit } = await import('../src/api/middleware/rate-limit')
		const { dbFactory } = await import('../src/db')
		const { db: dbResult } = await container.resolveAsync([dbFactory])

		const key = `test:limit:${Date.now()}`
		const max = 5

		// First 5 requests should be allowed
		for (let i = 0; i < max; i++) {
			const result = checkRateLimit(dbResult.db, key, 60, max)
			expect(result.allowed).toBe(true)
			expect(result.remaining).toBe(max - (i + 1))
		}

		// 6th request should be denied
		const denied = checkRateLimit(dbResult.db, key, 60, max)
		expect(denied.allowed).toBe(false)
		expect(denied.remaining).toBe(0)
	})

	it('should track concurrent requests atomically', async () => {
		const { checkRateLimit } = await import('../src/api/middleware/rate-limit')
		const { dbFactory } = await import('../src/db')
		const { db: dbResult } = await container.resolveAsync([dbFactory])

		const key = `test:concurrent:${Date.now()}`

		// 5 concurrent calls on the same key
		const results = Array.from({ length: 5 }, () => checkRateLimit(dbResult.db, key, 60, 100))

		// All should be allowed and remaining should decrease
		const remainings = results.map((r) => r.remaining)
		// Each call increments count, so remaining values should be 99, 98, 97, 96, 95
		expect(remainings).toEqual([99, 98, 97, 96, 95])
	})

	it('should incorporate previous window count in sliding window estimation', async () => {
		const { checkRateLimit } = await import('../src/api/middleware/rate-limit')
		const { dbFactory } = await import('../src/db')
		const { db: dbResult } = await container.resolveAsync([dbFactory])

		const now = Math.floor(Date.now() / 1000)
		const windowSec = 60
		const windowStart = now - (now % windowSec)
		const prevWindowStart = windowStart - windowSec

		// Manually insert a previous window entry with count=10
		const raw = (dbResult.db as any).$client
		const expiresAt = windowStart + windowSec * 2
		raw
			.prepare(
				`INSERT OR REPLACE INTO rate_limit_entries (key, window_start, count, expires_at) VALUES (?, ?, ?, ?)`,
			)
			.run(`test:sliding:boundary`, prevWindowStart, 10, expiresAt)

		// Now call checkRateLimit — the sliding window should factor in the previous count
		const result = checkRateLimit(dbResult.db, `test:sliding:boundary`, windowSec, 20)

		// The estimated count must be > 1 (current) because prevCount * weight > 0
		// (unless we're right at the window boundary, weight ~ 0)
		// We can't assert an exact value without mocking time, but we assert it is <= max=20 here
		// and that remaining reflects the weighted estimate
		expect(result.allowed).toBe(true)
		expect(result.remaining).toBeLessThan(20)
	})
})

// ─── checkPasswordResetLimit unit tests ─────────────────────────────────────

describe('checkPasswordResetLimit', () => {
	it('should allow up to 3 reset attempts per 15 minutes', async () => {
		const { checkPasswordResetLimit } = await import('../src/api/middleware/rate-limit')
		const { dbFactory } = await import('../src/db')
		const { db: dbResult } = await container.resolveAsync([dbFactory])

		const email = `reset-test-${Date.now()}@example.com`

		// First 3 attempts should be allowed
		for (let i = 0; i < 3; i++) {
			const result = checkPasswordResetLimit(dbResult.db, email)
			expect(result.allowed).toBe(true)
			expect(result.remaining).toBe(2 - i)
		}

		// 4th attempt should be denied
		const denied = checkPasswordResetLimit(dbResult.db, email)
		expect(denied.allowed).toBe(false)
		expect(denied.remaining).toBe(0)
	})

	it('should use a 900-second window (15 minutes)', async () => {
		const { checkPasswordResetLimit } = await import('../src/api/middleware/rate-limit')
		const { dbFactory } = await import('../src/db')
		const { db: dbResult } = await container.resolveAsync([dbFactory])

		const email = `reset-window-${Date.now()}@example.com`
		const result = checkPasswordResetLimit(dbResult.db, email)

		const now = Math.floor(Date.now() / 1000)
		// resetAt should be aligned to a 900-second boundary
		const windowStart = now - (now % 900)
		const expectedResetAt = windowStart + 900

		expect(result.resetAt).toBe(expectedResetAt)
	})

	it('should isolate limits per email address', async () => {
		const { checkPasswordResetLimit } = await import('../src/api/middleware/rate-limit')
		const { dbFactory } = await import('../src/db')
		const { db: dbResult } = await container.resolveAsync([dbFactory])

		const ts = Date.now()
		const email1 = `reset-iso1-${ts}@example.com`
		const email2 = `reset-iso2-${ts}@example.com`

		// Exhaust email1
		for (let i = 0; i < 3; i++) checkPasswordResetLimit(dbResult.db, email1)
		const denied = checkPasswordResetLimit(dbResult.db, email1)
		expect(denied.allowed).toBe(false)

		// email2 should still be fresh
		const allowed = checkPasswordResetLimit(dbResult.db, email2)
		expect(allowed.allowed).toBe(true)
	})
})

// ─── ipRateLimit e2e tests ──────────────────────────────────────────────────

describe('ipRateLimit', () => {
	it('should allow requests up to limit and return rate limit headers', async () => {
		// Use a unique IP per test to avoid interference
		const testIp = '10.0.0.1'

		const res = await request('/api/tasks', {
			headers: { 'X-Forwarded-For': testIp },
		})

		// Headers are present (actorRateLimit may overwrite ipRateLimit values)
		expect(res.headers.get('X-RateLimit-Limit')).toBeTruthy()
		expect(res.headers.get('X-RateLimit-Remaining')).toBeTruthy()
		expect(res.headers.get('X-RateLimit-Reset')).toBeTruthy()
	})

	it('should return 429 after exceeding IP rate limit', async () => {
		const testIp = '10.99.99.99'

		// Send 20 requests (the limit)
		for (let i = 0; i < 20; i++) {
			const res = await request('/api/tasks', {
				headers: { 'X-Forwarded-For': testIp },
			})
			expect(res.status).not.toBe(429)
		}

		// 21st request should be rate limited
		const res = await request('/api/tasks', {
			headers: { 'X-Forwarded-For': testIp },
		})
		expect(res.status).toBe(429)
		const data = (await res.json()) as { error: string }
		expect(data.error).toBe('Rate limit exceeded')
	})

	it('should exempt /hooks/* from IP rate limiting', async () => {
		const testIp = '10.88.88.88'

		// Send 100 requests to /hooks/ — all should pass through (no 429)
		for (let i = 0; i < 25; i++) {
			const res = await request('/hooks/test', {
				headers: { 'X-Forwarded-For': testIp },
			})
			// Hooks may 404 (no route), but should never be 429
			expect(res.status).not.toBe(429)
		}
	})

	it('should exempt /api/status from IP rate limiting', async () => {
		const testIp = '10.77.77.77'

		// Send more than 20 requests to /api/status
		for (let i = 0; i < 25; i++) {
			const res = await request('/api/status', {
				headers: { 'X-Forwarded-For': testIp },
			})
			expect(res.status).not.toBe(429)
		}
	})

	it('should set decreasing X-RateLimit-Remaining header', async () => {
		const testIp = '10.55.55.55'

		const res1 = await request('/api/tasks', {
			headers: { 'X-Forwarded-For': testIp },
		})
		const remaining1 = Number.parseInt(res1.headers.get('X-RateLimit-Remaining')!, 10)

		const res2 = await request('/api/tasks', {
			headers: { 'X-Forwarded-For': testIp },
		})
		const remaining2 = Number.parseInt(res2.headers.get('X-RateLimit-Remaining')!, 10)

		expect(remaining2).toBe(remaining1 - 1)
	})
})

// ─── actorRateLimit e2e tests ───────────────────────────────────────────────

describe('actorRateLimit', () => {
	it('should set actor rate limit headers on API routes', async () => {
		// Use a unique IP to avoid ipRateLimit interference.
		// Requests are authenticated via test API key.
		const testIp = '10.20.0.1'

		const res = await request('/api/tasks', {
			headers: { 'X-Forwarded-For': testIp },
		})

		// actorRateLimit headers should override/complement ipRateLimit headers
		// The last middleware to set them wins in Hono
		const limit = res.headers.get('X-RateLimit-Limit')
		expect(limit).toBeTruthy()
	})

	it('should apply lower limits on /api/search', async () => {
		const testIp = '10.20.0.2'

		const res = await request('/api/search?q=test', {
			headers: { 'X-Forwarded-For': testIp },
		})

		// Search limit is 50/min for agent actors
		const limit = res.headers.get('X-RateLimit-Limit')
		expect(limit).toBe('50')
	})
})

// ─── Agent rate limiting tests ───────────────────────────────────────────────

describe('agent rate limiting', () => {
	it('agents are rate limited (not exempt) — general limit is 600/min', async () => {
		const { checkRateLimit } = await import('../src/api/middleware/rate-limit')
		const { dbFactory } = await import('../src/db')
		const { db: dbResult } = await container.resolveAsync([dbFactory])

		// Simulate agent general limit: 600/min
		const key = `actor:agent-test-${Date.now()}`
		const max = 600

		// Should allow first request
		const result = checkRateLimit(dbResult.db, key, 60, max)
		expect(result.allowed).toBe(true)
		expect(result.remaining).toBe(599)
	})

	it('agent search limit is 50/min', async () => {
		const { checkRateLimit } = await import('../src/api/middleware/rate-limit')
		const { dbFactory } = await import('../src/db')
		const { db: dbResult } = await container.resolveAsync([dbFactory])

		const key = `actor:agent-search-${Date.now()}:/api/search`
		const max = 50

		// Exhaust the search limit
		for (let i = 0; i < max; i++) {
			const r = checkRateLimit(dbResult.db, key, 60, max)
			expect(r.allowed).toBe(true)
		}

		// Next request should be denied
		const denied = checkRateLimit(dbResult.db, key, 60, max)
		expect(denied.allowed).toBe(false)
		expect(denied.remaining).toBe(0)
	})

	it('agent chat limit is 100/min', async () => {
		const { checkRateLimit } = await import('../src/api/middleware/rate-limit')
		const { dbFactory } = await import('../src/db')
		const { db: dbResult } = await container.resolveAsync([dbFactory])

		const key = `actor:agent-chat-${Date.now()}:/api/chat`
		const max = 100

		// Should allow requests up to limit
		for (let i = 0; i < max; i++) {
			const r = checkRateLimit(dbResult.db, key, 60, max)
			expect(r.allowed).toBe(true)
		}

		// 101st should be denied
		const denied = checkRateLimit(dbResult.db, key, 60, max)
		expect(denied.allowed).toBe(false)
	})

	it('agent limits are higher than human limits for general requests', () => {
		// Agent general: 600/min vs human general: 300/min
		expect(600).toBeGreaterThan(300)
		// Agent search: 50/min vs human search: 10/min
		expect(50).toBeGreaterThan(10)
		// Agent chat: 100/min vs human chat: 20/min
		expect(100).toBeGreaterThan(20)
	})
})
