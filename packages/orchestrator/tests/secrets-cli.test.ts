/**
 * Tests for `autopilot secrets` CLI commands via the secrets API routes.
 *
 * Covers:
 * - POST /api/secrets (set) — creates and updates secrets
 * - GET /api/secrets (list) — returns metadata, never raw values
 * - DELETE /api/secrets/:name — removes a secret
 * - Missing master key returns 503
 * - Scope validation
 */
import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { randomBytes } from 'node:crypto'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Hono } from 'hono'
import type { AppEnv, Services } from '../src/api/app'
import type { Actor } from '../src/auth/types'
import { secrets } from '../src/api/routes/secrets'
import { SecretService } from '../src/services/secrets'
import { createCompanyDb, type CompanyDbResult } from '../src/db'

let testDir: string
let dbResult: CompanyDbResult
let secretService: SecretService
let app: Hono<AppEnv>

const TEST_MASTER_KEY = randomBytes(32).toString('hex')

beforeAll(async () => {
	testDir = join(tmpdir(), `autopilot-secrets-cli-test-${Date.now()}`)
	await mkdir(testDir, { recursive: true })
	process.env.AUTOPILOT_MASTER_KEY = TEST_MASTER_KEY

	dbResult = await createCompanyDb(testDir)
	secretService = new SecretService(dbResult.db)

	// Minimal Hono app with secrets routes and stubbed context
	app = new Hono<AppEnv>()
	app.use('*', async (c, next) => {
		c.set('services', { secretService } as unknown as Services)
		c.set('actor', { type: 'user', id: 'test-user' } as Actor)
		await next()
	})
	app.route('/api/secrets', secrets)
})

afterAll(async () => {
	dbResult.raw.close()
	await rm(testDir, { recursive: true, force: true })
	delete process.env.AUTOPILOT_MASTER_KEY
})

function req(method: string, path: string, body?: unknown) {
	const init: RequestInit = { method, headers: { 'Content-Type': 'application/json' } }
	if (body) init.body = JSON.stringify(body)
	return app.request(`http://localhost/api/secrets${path}`, init)
}

// ─── SET ─────────────────────────────────────────────────────────────────────

describe('POST /api/secrets (set)', () => {
	test('creates a new secret', async () => {
		const res = await req('POST', '', {
			name: 'CLI_TEST_TOKEN',
			scope: 'worker',
			value: 'secret-value-123',
			description: 'Test token',
		})
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.name).toBe('CLI_TEST_TOKEN')
		expect(body.scope).toBe('worker')
		expect(body.description).toBe('Test token')
		expect(body.value).toBeUndefined()
		expect(body.encrypted_value).toBeUndefined()
	})

	test('updates an existing secret', async () => {
		await req('POST', '', { name: 'UPDATE_VIA_CLI', scope: 'provider', value: 'v1' })
		const res = await req('POST', '', { name: 'UPDATE_VIA_CLI', scope: 'orchestrator_only', value: 'v2' })
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.scope).toBe('orchestrator_only')
	})

	test('rejects invalid scope', async () => {
		const res = await req('POST', '', { name: 'BAD_SCOPE', scope: 'everyone', value: 'x' })
		expect(res.status).toBe(400)
	})

	test('rejects name with spaces', async () => {
		const res = await req('POST', '', { name: 'bad name', scope: 'worker', value: 'x' })
		expect(res.status).toBe(400)
	})

	test('rejects missing value', async () => {
		const res = await req('POST', '', { name: 'NO_VALUE', scope: 'worker' })
		expect(res.status).toBe(400)
	})

	test('returns 503 when master key is missing', async () => {
		const saved = process.env.AUTOPILOT_MASTER_KEY
		delete process.env.AUTOPILOT_MASTER_KEY
		try {
			const res = await req('POST', '', { name: 'FAIL', scope: 'worker', value: 'x' })
			expect(res.status).toBe(503)
			const body = await res.json()
			expect(body.error).toContain('AUTOPILOT_MASTER_KEY')
		} finally {
			process.env.AUTOPILOT_MASTER_KEY = saved
		}
	})
})

// ─── LIST ────────────────────────────────────────────────────────────────────

describe('GET /api/secrets (list)', () => {
	test('lists secrets with metadata only', async () => {
		await req('POST', '', { name: 'LIST_A', scope: 'worker', value: 'a-secret' })
		await req('POST', '', { name: 'LIST_B', scope: 'provider', value: 'b-secret', description: 'B desc' })

		const res = await req('GET', '')
		expect(res.status).toBe(200)
		const body = await res.json() as Array<Record<string, unknown>>

		const names = body.map((s) => s.name)
		expect(names).toContain('LIST_A')
		expect(names).toContain('LIST_B')

		// No raw values leaked in list output
		for (const item of body) {
			expect(item.value).toBeUndefined()
			expect(item.encrypted_value).toBeUndefined()
			expect(item.iv).toBeUndefined()
			expect(item.auth_tag).toBeUndefined()
			// Only expected fields
			expect(item).toHaveProperty('name')
			expect(item).toHaveProperty('scope')
			expect(item).toHaveProperty('created_at')
			expect(item).toHaveProperty('updated_at')
		}
	})

	test('returns empty array when no secrets exist', async () => {
		// Use a fresh DB
		const freshDir = join(tmpdir(), `autopilot-secrets-empty-${Date.now()}`)
		await mkdir(freshDir, { recursive: true })
		const freshDb = await createCompanyDb(freshDir)
		const freshService = new SecretService(freshDb.db)

		const freshApp = new Hono<AppEnv>()
		freshApp.use('*', async (c, next) => {
			c.set('services', { secretService: freshService } as unknown as Services)
			c.set('actor', { type: 'user', id: 'test' } as Actor)
			await next()
		})
		freshApp.route('/api/secrets', secrets)

		const res = await freshApp.request('http://localhost/api/secrets', { method: 'GET' })
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body).toEqual([])

		freshDb.raw.close()
		await rm(freshDir, { recursive: true, force: true })
	})
})

// ─── DELETE ──────────────────────────────────────────────────────────────────

describe('DELETE /api/secrets/:name (delete)', () => {
	test('deletes an existing secret', async () => {
		await req('POST', '', { name: 'DELETE_CLI', scope: 'worker', value: 'bye' })

		const res = await req('DELETE', '/DELETE_CLI')
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.ok).toBe(true)
		expect(body.deleted).toBe('DELETE_CLI')

		// Verify it's gone
		const listRes = await req('GET', '')
		const list = await listRes.json() as Array<Record<string, unknown>>
		expect(list.map((s) => s.name)).not.toContain('DELETE_CLI')
	})

	test('returns 404 for non-existent secret', async () => {
		const res = await req('DELETE', '/DOES_NOT_EXIST')
		expect(res.status).toBe(404)
	})
})
