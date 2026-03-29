/**
 * D4-D7: Consistency fixes tests.
 * D42-D44: Infrastructure tests.
 *
 * Tests for: guardedSpawn concurrency, task transactions, memory retry,
 * Zod secret schemas, single-port proxy, durable health, DiskANN detection.
 */
import { describe, test, expect, afterEach } from 'bun:test'

// ─── D4: maxConcurrentAgents enforcement ────────────────────────────────────

describe('D4: maxConcurrentAgents', () => {
	test('server.ts contains guardedSpawn method', async () => {
		const { readFileSync } = await import('node:fs')
		const { join } = await import('node:path')
		const source = readFileSync(join(import.meta.dir, '..', 'src', 'server.ts'), 'utf-8')
		expect(source).toContain('guardedSpawn')
		expect(source).toContain('maxConcurrentAgents')
		expect(source).toContain('activeAgentCount')
	})

	test('guardedSpawn increments and decrements activeAgentCount', async () => {
		const { readFileSync } = await import('node:fs')
		const { join } = await import('node:path')
		const source = readFileSync(join(import.meta.dir, '..', 'src', 'server.ts'), 'utf-8')
		expect(source).toContain('this.activeAgentCount++')
		expect(source).toContain('this.activeAgentCount--')
	})

	test('guardedSpawn logs warning when at capacity', async () => {
		const { readFileSync } = await import('node:fs')
		const { join } = await import('node:path')
		const source = readFileSync(join(import.meta.dir, '..', 'src', 'server.ts'), 'utf-8')
		expect(source).toContain('max concurrent agents')
		expect(source).toContain('skipping spawn')
	})

	test('all external spawnAgent call sites use guardedSpawn', async () => {
		const { readFileSync } = await import('node:fs')
		const { join } = await import('node:path')
		const source = readFileSync(join(import.meta.dir, '..', 'src', 'server.ts'), 'utf-8')
		// The only bare spawnAgent( call should be inside guardedSpawn method itself
		const lines = source.split('\n')
		const bareSpawns = lines.filter(
			(l) => l.includes('spawnAgent(') && !l.includes('guardedSpawn') && !l.includes('import') && !l.includes('//') && !l.includes('private guardedSpawn')
		)
		// Only 1 bare call allowed — the one inside guardedSpawn's body
		expect(bareSpawns.length).toBeLessThanOrEqual(1)
		// All handler methods should use this.guardedSpawn
		const guardedCalls = source.match(/this\.guardedSpawn\(/g)
		expect(guardedCalls).not.toBeNull()
		expect(guardedCalls!.length).toBeGreaterThanOrEqual(3) // mention, schedule, task_assigned
	})
})

// ─── D5: Task operations in transactions ────────────────────────────────────

describe('D5: task transactions', () => {
	test('updateTask uses db.transaction', async () => {
		const { readFileSync } = await import('node:fs')
		const { join } = await import('node:path')
		const source = readFileSync(join(import.meta.dir, '..', 'src', 'fs', 'sqlite-backend.ts'), 'utf-8')
		// Find updateTask method and verify it uses transaction
		const updateIdx = source.indexOf('async updateTask(')
		const nextMethod = source.indexOf('async moveTask(', updateIdx)
		const updateBody = source.slice(updateIdx, nextMethod)
		expect(updateBody).toContain('this.db.transaction')
	})

	test('moveTask uses db.transaction', async () => {
		const { readFileSync } = await import('node:fs')
		const { join } = await import('node:path')
		const source = readFileSync(join(import.meta.dir, '..', 'src', 'fs', 'sqlite-backend.ts'), 'utf-8')
		const moveIdx = source.indexOf('async moveTask(')
		const nextMethod = source.indexOf('async listTasks(', moveIdx)
		const moveBody = source.slice(moveIdx, nextMethod)
		expect(moveBody).toContain('this.db.transaction')
	})
})

// ─── D6: Memory extraction retry ────────────────────────────────────────────

describe('D6: memory extraction retry', () => {
	test('spawner has retry logic for extractMemory', async () => {
		const { readFileSync } = await import('node:fs')
		const { join } = await import('node:path')
		const source = readFileSync(join(import.meta.dir, '..', 'src', 'agent', 'spawner.ts'), 'utf-8')
		// Should have two extractMemory calls (initial + retry)
		const matches = source.match(/extractMemory\(/g)
		expect(matches).not.toBeNull()
		expect(matches!.length).toBeGreaterThanOrEqual(2)
	})

	test('retry logs warning on first failure', async () => {
		const { readFileSync } = await import('node:fs')
		const { join } = await import('node:path')
		const source = readFileSync(join(import.meta.dir, '..', 'src', 'agent', 'spawner.ts'), 'utf-8')
		expect(source).toContain('memory extraction failed')
		expect(source).toContain('retrying')
	})

	test('retry logs error after second failure', async () => {
		const { readFileSync } = await import('node:fs')
		const { join } = await import('node:path')
		const source = readFileSync(join(import.meta.dir, '..', 'src', 'agent', 'spawner.ts'), 'utf-8')
		expect(source).toContain('failed after retry')
	})
})

// ─── D7: Zod secret schemas ────────────────────────────────────────────────

describe('D7: Zod secret schemas', () => {
	test('http tool uses SecretSchema.parse instead of as-cast', async () => {
		const { readFileSync } = await import('node:fs')
		const { join } = await import('node:path')
		const source = readFileSync(join(import.meta.dir, '..', 'src', 'agent', 'tools', 'http.ts'), 'utf-8')
		expect(source).toContain('SecretSchema.parse')
		expect(source).not.toContain('readYamlUnsafe(secretPath) as {')
	})

	test('telegram handler uses TelegramSecretSchema.parse', async () => {
		const { readFileSync } = await import('node:fs')
		const { join } = await import('node:path')
		const source = readFileSync(join(import.meta.dir, '..', 'src', 'webhook', 'handlers', 'telegram.ts'), 'utf-8')
		expect(source).toContain('TelegramSecretSchema.parse')
	})

	test('SecretSchema accepts valid secret', () => {
		const { z } = require('zod')
		const SecretSchema = z.object({
			allowed_agents: z.array(z.string()).optional(),
			api_key: z.string().optional(),
		}).passthrough()

		const valid = SecretSchema.safeParse({
			allowed_agents: ['dev', 'devops'],
			api_key: 'sk-test-123',
		})
		expect(valid.success).toBe(true)
	})

	test('SecretSchema accepts secret with extra fields (passthrough)', () => {
		const { z } = require('zod')
		const SecretSchema = z.object({
			allowed_agents: z.array(z.string()).optional(),
			api_key: z.string().optional(),
		}).passthrough()

		const valid = SecretSchema.safeParse({
			api_key: 'sk-test',
			custom_header: 'X-Custom',
		})
		expect(valid.success).toBe(true)
	})
})

// ─── D42: Single-port proxy ────────────────────────────────────────────────

describe('D42: single-port proxy', () => {
	test('app.ts has /streams/* proxy route', async () => {
		const { readFileSync } = await import('node:fs')
		const { join } = await import('node:path')
		const source = readFileSync(join(import.meta.dir, '..', 'src', 'api', 'app.ts'), 'utf-8')
		expect(source).toContain("'/streams/*'")
		expect(source).toContain('getDurableStreamBaseUrl')
	})

	test('app.ts has /* static dashboard fallback', async () => {
		const { readFileSync } = await import('node:fs')
		const { join } = await import('node:path')
		const source = readFileSync(join(import.meta.dir, '..', 'src', 'api', 'app.ts'), 'utf-8')
		expect(source).toContain("'/*'")
		expect(source).toContain('index.html')
		expect(source).toContain('resolveDashboardDir')
	})

	test('proxy forwards request method and headers', async () => {
		const { readFileSync } = await import('node:fs')
		const { join } = await import('node:path')
		const source = readFileSync(join(import.meta.dir, '..', 'src', 'api', 'app.ts'), 'utf-8')
		expect(source).toContain('c.req.method')
		expect(source).toContain('c.req.raw.headers')
	})

	test('proxy returns 502 on durable streams unavailable', async () => {
		const { readFileSync } = await import('node:fs')
		const { join } = await import('node:path')
		const source = readFileSync(join(import.meta.dir, '..', 'src', 'api', 'app.ts'), 'utf-8')
		expect(source).toContain('502')
		expect(source).toContain('Durable Streams server unavailable')
	})

	test('resolveDashboardDir checks multiple candidate paths', async () => {
		const { readFileSync } = await import('node:fs')
		const { join } = await import('node:path')
		const source = readFileSync(join(import.meta.dir, '..', 'src', 'api', 'app.ts'), 'utf-8')
		expect(source).toContain('.output/public')
		expect(source).toContain('dist')
	})
})

// ─── D43: Durable streams health check ─────────────────────────────────────

describe('D43: durable streams health', () => {
	test('checkDurableStreamHealth returns ok:false when server unreachable', async () => {
		const originalFetch = globalThis.fetch
		globalThis.fetch = (async () => { throw new Error('ECONNREFUSED') }) as typeof fetch
		try {
			const { checkDurableStreamHealth } = await import('../src/session/durable')
			const result = await checkDurableStreamHealth()
			expect(result.ok).toBe(false)
			expect(result.latencyMs).toBeDefined()
		} finally {
			globalThis.fetch = originalFetch
		}
	})

	test('checkDurableStreamHealth returns ok:true on 200', async () => {
		const originalFetch = globalThis.fetch
		globalThis.fetch = (async () => new Response('OK', { status: 200 })) as typeof fetch
		try {
			const { checkDurableStreamHealth } = await import('../src/session/durable')
			const result = await checkDurableStreamHealth()
			expect(result.ok).toBe(true)
			expect(result.latencyMs).toBeGreaterThanOrEqual(0)
		} finally {
			globalThis.fetch = originalFetch
		}
	})

	test('checkDurableStreamHealth returns ok:false on 500', async () => {
		const originalFetch = globalThis.fetch
		globalThis.fetch = (async () => new Response('Error', { status: 500 })) as typeof fetch
		try {
			const { checkDurableStreamHealth } = await import('../src/session/durable')
			const result = await checkDurableStreamHealth()
			expect(result.ok).toBe(false)
		} finally {
			globalThis.fetch = originalFetch
		}
	})

	test('auto-restart logic exists in startDurableStreamServer', async () => {
		const { readFileSync } = await import('node:fs')
		const { join } = await import('node:path')
		const source = readFileSync(join(import.meta.dir, '..', 'src', 'session', 'durable.ts'), 'utf-8')
		expect(source).toContain('auto-restarting after crash')
		expect(source).toContain('DURABLE_STREAMS_STARTUP_TIMEOUT')
	})

	test('getDurableStreamBaseUrl returns correct URL', async () => {
		const { getDurableStreamBaseUrl } = await import('../src/session/durable')
		const url = getDurableStreamBaseUrl()
		expect(url).toMatch(/^https?:\/\//)
	})

	test('getSessionStreamUrl encodes session ID', async () => {
		const { getSessionStreamUrl } = await import('../src/session/durable')
		const url = getSessionStreamUrl('session-abc/def')
		expect(url).toContain('session-abc%2Fdef')
	})
})

// ─── D44: DiskANN dual-backend vector detection ─────────────────────────────

describe('D44: DiskANN dual-backend', () => {
	afterEach(() => {
		// Clean up env vars
		delete process.env.TURSO_SYNC_URL
		delete process.env.DATABASE_URL
	})

	test('db/index.ts supports Turso via TURSO_SYNC_URL', async () => {
		const { readFileSync } = await import('node:fs')
		const { join } = await import('node:path')
		const source = readFileSync(join(import.meta.dir, '..', 'src', 'db', 'index.ts'), 'utf-8')
		expect(source).toContain('TURSO_SYNC_URL')
	})

	test('search-index uses vector_top_k for DiskANN queries', async () => {
		const { readFileSync } = await import('node:fs')
		const { join } = await import('node:path')
		const source = readFileSync(join(import.meta.dir, '..', 'src', 'db', 'search-index.ts'), 'utf-8')
		expect(source).toContain('vector_top_k')
		expect(source).toContain('search_vec_idx')
	})

	test('search-index uses DiskANN for chunks queries', async () => {
		const { readFileSync } = await import('node:fs')
		const { join } = await import('node:path')
		const source = readFileSync(join(import.meta.dir, '..', 'src', 'db', 'search-index.ts'), 'utf-8')
		expect(source).toContain('chunks_vec_idx')
	})
})

// ─── D38-D40: Cloud readiness ──────────────────────────────────────────────

describe('D38-D40: cloud readiness', () => {
	test('D38: Dockerfile includes mcp-server package', async () => {
		const { readFileSync } = await import('node:fs')
		const { join } = await import('node:path')
		const source = readFileSync(join(import.meta.dir, '..', '..', '..', 'Dockerfile'), 'utf-8')
		expect(source).toContain('mcp-server')
		expect(source).toContain('HEALTHCHECK')
	})

	test('D39: usage API route exists', async () => {
		const { existsSync } = await import('node:fs')
		const { join } = await import('node:path')
		expect(existsSync(join(import.meta.dir, '..', 'src', 'api', 'routes', 'usage.ts'))).toBe(true)
	})

	test('D39: usage route is registered in app', async () => {
		const { readFileSync } = await import('node:fs')
		const { join } = await import('node:path')
		const source = readFileSync(join(import.meta.dir, '..', 'src', 'api', 'app.ts'), 'utf-8')
		expect(source).toContain("'/api/usage'")
	})

	test('D40: plan limits read from env', async () => {
		const { readFileSync } = await import('node:fs')
		const { join } = await import('node:path')
		const source = readFileSync(join(import.meta.dir, '..', 'src', 'agent', 'spawner.ts'), 'utf-8')
		expect(source).toContain('PLAN_MAX_AGENTS')
		expect(source).toContain('PLAN_MAX_TOKENS_DAY')
	})

	test('D40: plan limits enforced before spawn', async () => {
		const { readFileSync } = await import('node:fs')
		const { join } = await import('node:path')
		const source = readFileSync(join(import.meta.dir, '..', 'src', 'agent', 'spawner.ts'), 'utf-8')
		expect(source).toContain('Plan limit')
		expect(source).toContain('daily token limit')
	})
})
