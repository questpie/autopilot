import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Hono } from 'hono'
import type { AppEnv, Services } from '../src/api/app'
import { configRoute } from '../src/api/routes/config'
import type { Actor } from '../src/auth/types'
import { ConfigService } from '../src/config/config-service'
import { type CompanyDbResult, createCompanyDb } from '../src/db'

let testDir: string
let dbResult: CompanyDbResult
let configService: ConfigService
let currentActor: Actor | null = null
let app: Hono<AppEnv>

function makeActor(role: Actor['role'], id = `test-${role}`): Actor {
	return { id, type: 'human', name: `Test ${role}`, role, source: 'api' }
}

beforeAll(async () => {
	testDir = join(tmpdir(), `autopilot-config-api-${Date.now()}`)
	await mkdir(testDir, { recursive: true })
	dbResult = await createCompanyDb(testDir)
	configService = new ConfigService(dbResult.db)

	app = new Hono<AppEnv>()
	app.use('*', async (c, next) => {
		c.set('services', { configService } as unknown as Services)
		c.set('actor', currentActor)
		await next()
	})
	app.route('/api/config', configRoute)
})

afterAll(async () => {
	dbResult.raw.close()
	await rm(testDir, { recursive: true, force: true })
})

function req(method: string, path: string, body?: unknown) {
	const init: RequestInit = { method, headers: { 'Content-Type': 'application/json' } }
	if (body) init.body = JSON.stringify(body)
	return app.request(`http://localhost/api/config${path}`, init)
}

async function withActor<T>(actor: Actor | null, fn: () => Promise<T>): Promise<T> {
	const prev = currentActor
	currentActor = actor
	try {
		return await fn()
	} finally {
		currentActor = prev
	}
}

describe('config API', () => {
	test('owner can create and read company config', async () => {
		await withActor(makeActor('owner'), async () => {
			const postRes = await req('POST', '/company', {
				data: { name: 'ConfigCo', slug: 'config-co', defaults: { runtime: 'claude-code' } },
			})
			expect(postRes.status).toBe(200)

			const getRes = await req('GET', '/company/company')
			expect(getRes.status).toBe(200)
			const company = (await getRes.json()) as { name: string; slug: string }
			expect(company.name).toBe('ConfigCo')
			expect(company.slug).toBe('config-co')
		})
	})

	test('admin can CRUD agent config records', async () => {
		await withActor(makeActor('admin'), async () => {
			const createRes = await req('PUT', '/agents/dev', {
				data: { id: 'dev', name: 'Developer', role: 'developer', description: '' },
			})
			expect(createRes.status).toBe(200)

			const listRes = await req('GET', '/agents')
			expect(listRes.status).toBe(200)
			const agents = (await listRes.json()) as Array<{ id: string }>
			expect(agents.some((agent) => agent.id === 'dev')).toBe(true)

			const deleteRes = await req('DELETE', '/agents/dev')
			expect(deleteRes.status).toBe(200)

			const getRes = await req('GET', '/agents/dev')
			expect(getRes.status).toBe(404)
		})
	})

	describe('mutation guards', () => {
		test('member cannot POST', async () => {
			await withActor(makeActor('member'), async () => {
				const res = await req('POST', '/agents', {
					data: { id: 'researcher', name: 'Researcher', role: 'researcher' },
				})
				expect(res.status).toBe(403)
			})
		})

		test('member cannot PUT', async () => {
			await withActor(makeActor('member'), async () => {
				const res = await req('PUT', '/agents/researcher', {
					data: { id: 'researcher', name: 'Researcher', role: 'researcher' },
				})
				expect(res.status).toBe(403)
			})
		})

		test('member cannot DELETE', async () => {
			await withActor(makeActor('member'), async () => {
				const res = await req('DELETE', '/agents/dev')
				expect(res.status).toBe(403)
			})
		})

		test('viewer cannot mutate', async () => {
			await withActor(makeActor('viewer'), async () => {
				const post = await req('POST', '/agents', {
					data: { id: 'reviewer', name: 'Reviewer', role: 'reviewer' },
				})
				expect(post.status).toBe(403)

				const put = await req('PUT', '/agents/reviewer', {
					data: { id: 'reviewer', name: 'Reviewer', role: 'reviewer' },
				})
				expect(put.status).toBe(403)

				const del = await req('DELETE', '/agents/reviewer')
				expect(del.status).toBe(403)
			})
		})

		test('member can read', async () => {
			// Seed a record as owner first
			await withActor(makeActor('owner'), async () => {
				const seed = await req('PUT', '/agents/reader-seed', {
					data: { id: 'reader-seed', name: 'Reader Seed', role: 'developer' },
				})
				expect(seed.status).toBe(200)
			})

			await withActor(makeActor('member'), async () => {
				const list = await req('GET', '/agents')
				expect(list.status).toBe(200)

				const get = await req('GET', '/agents/reader-seed')
				expect(get.status).toBe(200)
			})
		})

		test('viewer can read', async () => {
			await withActor(makeActor('viewer'), async () => {
				const list = await req('GET', '/agents')
				expect(list.status).toBe(200)
			})
		})

		test('unauthenticated mutation returns 401', async () => {
			await withActor(null, async () => {
				const res = await req('POST', '/agents', {
					data: { id: 'anon', name: 'Anon', role: 'developer' },
				})
				expect(res.status).toBe(401)
			})
		})
	})
})
