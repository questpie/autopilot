import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import type { AppEnv, Services } from '../src/api/app'
import { preferences } from '../src/api/routes/preferences'
import type { Actor } from '../src/auth/types'
import { type CompanyDbResult, createCompanyDb } from '../src/db'
import { user } from '../src/db/auth-schema'
import { UserPreferenceService } from '../src/services/user-preferences'

let testDir: string
let dbResult: CompanyDbResult
let service: UserPreferenceService
let app: Hono<AppEnv>

beforeAll(async () => {
	testDir = join(tmpdir(), `autopilot-user-preferences-${Date.now()}`)
	await mkdir(testDir, { recursive: true })
	dbResult = await createCompanyDb(testDir)
	service = new UserPreferenceService(dbResult.db)
	app = new Hono<AppEnv>()
	app.use('*', async (c, next) => {
		c.set('services', { userPreferenceService: service } as unknown as Services)
		c.set('actor', { id: 'local-dev-bypass', type: 'human', name: 'Local Dev' } as Actor)
		await next()
	})
	app.route('/api/preferences', preferences)
})

afterAll(async () => {
	dbResult.raw.close()
	await rm(testDir, { recursive: true, force: true })
})

describe('UserPreferenceService', () => {
	test('creates the local dev bypass user before storing preferences', async () => {
		const record = await service.set('local-dev-bypass', 'ui.theme', 'system')
		expect(record.user_id).toBe('local-dev-bypass')
		expect(record.value).toBe('system')

		const devUser = await dbResult.db
			.select()
			.from(user)
			.where(eq(user.id, 'local-dev-bypass'))
			.get()
		expect(devUser?.email).toBe('local-dev-bypass@localhost')

		const fetched = await service.get('local-dev-bypass', 'ui.theme')
		expect(fetched?.value).toBe('system')
	})

	test('preference route accepts local dev bypass actor', async () => {
		const res = await app.request('http://localhost/api/preferences/ui.developerMode', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ value: true }),
		})

		expect(res.status).toBe(200)
		const body = (await res.json()) as { user_id: string; key: string; value: boolean }
		expect(body.user_id).toBe('local-dev-bypass')
		expect(body.key).toBe('ui.developerMode')
		expect(body.value).toBe(true)
	})
})
