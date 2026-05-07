/**
 * Default skill catalog seed tests.
 *
 * Verifies idempotency, presence of required catalog entries (skill-creator,
 * skill-installer), and the read-only listing endpoint.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Hono } from 'hono'
import type { AppEnv, Services } from '../src/api/app'
import { configRoute } from '../src/api/routes/config'
import type { Actor } from '../src/auth/types'
import { ConfigService } from '../src/config/config-service'
import { listDefaultSkills, seedDefaultSkills } from '../src/config/default-skills'
import { type CompanyDbResult, createCompanyDb } from '../src/db'

let testDir: string
let dbResult: CompanyDbResult
let configService: ConfigService
let currentActor: Actor | null = null
let app: Hono<AppEnv>

function makeActor(role: Actor['role']): Actor {
	return { id: `test-${role}`, type: 'human', name: `Test ${role}`, role, source: 'api' }
}

beforeAll(async () => {
	testDir = join(tmpdir(), `autopilot-default-skills-${Date.now()}`)
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

describe('default skill catalog', () => {
	test('contains skill-creator and skill-installer', () => {
		const ids = listDefaultSkills().map((s) => s.id)
		expect(ids).toContain('skill-creator')
		expect(ids).toContain('skill-installer')
	})

	test('plugin-backed entries are marked, not pretended-installed', () => {
		const github = listDefaultSkills().find((s) => s.id === 'github')
		expect(github?.availability).toBe('plugin_backed')

		const skillCreator = listDefaultSkills().find((s) => s.id === 'skill-creator')
		expect(skillCreator?.availability).toBe('built_in')
	})

	test('first seed inserts every catalog entry', async () => {
		const result = await seedDefaultSkills(configService)
		const expectedIds = listDefaultSkills().map((s) => s.id)
		expect(result.inserted.sort()).toEqual([...expectedIds].sort())
		expect(result.skipped).toEqual([])

		const stored = await configService.list('skills', null)
		expect(stored).toHaveLength(expectedIds.length)
	})

	test('second seed is a no-op (idempotent)', async () => {
		const result = await seedDefaultSkills(configService)
		expect(result.inserted).toEqual([])
		expect(result.skipped.length).toBe(listDefaultSkills().length)
	})

	test('seed does not overwrite operator-edited records', async () => {
		// Operator edits an existing skill
		await configService.set(
			'skills',
			'skill-creator',
			{
				id: 'skill-creator',
				manifest: {
					name: 'skill-creator',
					description: 'OPERATOR EDITED',
					version: '',
					tags: ['custom'],
					roles: ['developer'],
					scripts: [],
				},
				body: '# operator edited body',
				path: 'db://skills/skill-creator/SKILL.md',
			},
			null,
		)

		const result = await seedDefaultSkills(configService)
		expect(result.inserted).toEqual([])
		expect(result.skipped).toContain('skill-creator')

		const stored = (await configService.get('skills', 'skill-creator', null)) as {
			body: string
			manifest: { description: string }
		} | null
		expect(stored?.body).toContain('operator edited')
		expect(stored?.manifest.description).toBe('OPERATOR EDITED')
	})
})

describe('config skills route', () => {
	test('GET /api/config/skills/_defaults returns catalog without auth role check', async () => {
		currentActor = makeActor('viewer')
		const res = await app.request('http://localhost/api/config/skills/_defaults')
		expect(res.status).toBe(200)
		const body = (await res.json()) as Array<{ id: string; availability: string }>
		expect(body.find((s) => s.id === 'skill-creator')?.availability).toBe('built_in')
	})

	test('POST /api/config/skills/_seed-defaults requires owner/admin', async () => {
		currentActor = makeActor('member')
		const memberRes = await app.request('http://localhost/api/config/skills/_seed-defaults', {
			method: 'POST',
		})
		expect(memberRes.status).toBe(403)

		currentActor = makeActor('admin')
		const adminRes = await app.request('http://localhost/api/config/skills/_seed-defaults', {
			method: 'POST',
		})
		expect(adminRes.status).toBe(200)
	})
})
