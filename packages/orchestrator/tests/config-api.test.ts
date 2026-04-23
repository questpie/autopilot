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
let app: Hono<AppEnv>

beforeAll(async () => {
	testDir = join(tmpdir(), `autopilot-config-api-${Date.now()}`)
	await mkdir(testDir, { recursive: true })
	dbResult = await createCompanyDb(testDir)
	configService = new ConfigService(dbResult.db)

	app = new Hono<AppEnv>()
	app.use('*', async (c, next) => {
		c.set('services', { configService } as unknown as Services)
		c.set('actor', { type: 'user', id: 'test-user' } as Actor)
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

describe('config API', () => {
	test('creates and reads company config', async () => {
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

	test('CRUDs agent config records', async () => {
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
