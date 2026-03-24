import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { stringify as stringifyYaml } from 'yaml'
import { container, configureContainer } from '../src/container'
import type { StorageBackend } from '../src/fs/storage'

let app: ReturnType<typeof import('../src/api/app').createApp>
let companyRoot: string
let storage: StorageBackend

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

	const { createApp } = await import('../src/api/app')
	app = createApp({ authEnabled: false, corsOrigin: '*' })
})

afterAll(async () => {
	if (storage) await storage.close()
	container.clearAllInstances()
	if (companyRoot) await rm(companyRoot, { recursive: true, force: true })
})

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
		const results = Array.from({ length: 5 }, () =>
			checkRateLimit(dbResult.db, key, 60, 100),
		)

		// All should be allowed and remaining should decrease
		const remainings = results.map((r) => r.remaining)
		// Each call increments count, so remaining values should be 99, 98, 97, 96, 95
		expect(remainings).toEqual([99, 98, 97, 96, 95])
	})
})

// ─── ipRateLimit e2e tests ──────────────────────────────────────────────────

describe('ipRateLimit', () => {
	it('should allow requests up to limit and return rate limit headers', async () => {
		// Use a unique IP per test to avoid interference
		const testIp = '10.0.0.1'

		const res = await app.request('/api/tasks', {
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
			const res = await app.request('/api/tasks', {
				headers: { 'X-Forwarded-For': testIp },
			})
			expect(res.status).not.toBe(429)
		}

		// 21st request should be rate limited
		const res = await app.request('/api/tasks', {
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
			const res = await app.request('/hooks/test', {
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
			const res = await app.request('/api/status', {
				headers: { 'X-Forwarded-For': testIp },
			})
			expect(res.status).not.toBe(429)
		}
	})

	it('should set decreasing X-RateLimit-Remaining header', async () => {
		const testIp = '10.55.55.55'

		const res1 = await app.request('/api/tasks', {
			headers: { 'X-Forwarded-For': testIp },
		})
		const remaining1 = parseInt(res1.headers.get('X-RateLimit-Remaining')!, 10)

		const res2 = await app.request('/api/tasks', {
			headers: { 'X-Forwarded-For': testIp },
		})
		const remaining2 = parseInt(res2.headers.get('X-RateLimit-Remaining')!, 10)

		expect(remaining2).toBe(remaining1 - 1)
	})
})

// ─── actorRateLimit e2e tests ───────────────────────────────────────────────

describe('actorRateLimit', () => {
	it('should set actor rate limit headers on API routes', async () => {
		// With authEnabled: false, the auth middleware creates a default owner actor
		// Use a unique IP to avoid ipRateLimit interference
		const testIp = '10.20.0.1'

		const res = await app.request('/api/tasks', {
			headers: { 'X-Forwarded-For': testIp },
		})

		// actorRateLimit headers should override/complement ipRateLimit headers
		// The last middleware to set them wins in Hono
		const limit = res.headers.get('X-RateLimit-Limit')
		expect(limit).toBeTruthy()
	})

	it('should apply lower limits on /api/search', async () => {
		const testIp = '10.20.0.2'

		const res = await app.request('/api/search?q=test', {
			headers: { 'X-Forwarded-For': testIp },
		})

		// Search limit is 10/min
		const limit = res.headers.get('X-RateLimit-Limit')
		expect(limit).toBe('10')
	})
})
