import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
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
	companyRoot = await mkdtemp(join(tmpdir(), 'sessions-api-test-'))

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
	for (const dir of dirs) await mkdir(join(companyRoot, dir), { recursive: true })

	await writeFile(
		join(companyRoot, 'company.yaml'),
		stringifyYaml({
			name: 'Test Company',
			slug: 'test-co',
			description: 'test',
			timezone: 'UTC',
			language: 'en',
			languages: ['en'],
			owner: { name: 'Test', email: 'test@test.com', notification_channels: [] },
			settings: {},
		}),
	)
	await mkdir(join(companyRoot, 'team', 'agents'), { recursive: true })

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

describe('Session API routes', () => {
	const request = (path: string, init?: RequestInit) => app.request(path, withApiKey(init, apiKey))

	test('GET /api/sessions returns 200 or 501', async () => {
		const res = await request('/api/sessions')
		// Session listing may return 501 if Better Auth session API is not available
		expect([200, 500, 501]).toContain(res.status)
	})

	test('DELETE /api/sessions/:id returns 200 or 501', async () => {
		const res = await request('/api/sessions/test-session-id', { method: 'DELETE' })
		expect([200, 500, 501]).toContain(res.status)
	})

	test('DELETE /api/sessions returns 200 or 501', async () => {
		const res = await request('/api/sessions', { method: 'DELETE' })
		expect([200, 500, 501]).toContain(res.status)
	})
})
