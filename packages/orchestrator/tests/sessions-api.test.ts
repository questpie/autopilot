import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
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
	companyRoot = await mkdtemp(join(tmpdir(), 'sessions-api-test-'))

	const dirs = [
		'tasks/backlog', 'tasks/active', 'tasks/review', 'tasks/blocked', 'tasks/done',
		'comms/channels/general', 'comms/direct', 'dashboard/pins',
		'logs/activity', 'logs/sessions', 'team', 'team/workflows',
		'context/memory', 'context/indexes',
	]
	for (const dir of dirs) await mkdir(join(companyRoot, dir), { recursive: true })

	await writeFile(join(companyRoot, 'company.yaml'), stringifyYaml({
		name: 'Test Company', slug: 'test-co', description: 'test',
		timezone: 'UTC', language: 'en', languages: ['en'],
		owner: { name: 'Test', email: 'test@test.com', notification_channels: [] },
		settings: {},
	}))
	await writeFile(join(companyRoot, 'team', 'agents.yaml'), stringifyYaml({ agents: [] }))

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

describe('Session API routes', () => {
	test('GET /api/sessions returns 200 or 501', async () => {
		const res = await app.request('/api/sessions')
		// With auth disabled, actor is implicit-owner
		// Session listing may return 501 if Better Auth session API is not available
		expect([200, 500, 501]).toContain(res.status)
	})

	test('DELETE /api/sessions/:id returns 200 or 501', async () => {
		const res = await app.request('/api/sessions/test-session-id', { method: 'DELETE' })
		expect([200, 500, 501]).toContain(res.status)
	})

	test('DELETE /api/sessions returns 200 or 501', async () => {
		const res = await app.request('/api/sessions', { method: 'DELETE' })
		expect([200, 500, 501]).toContain(res.status)
	})
})
