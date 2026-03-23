import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { join } from 'node:path'
import { ApiServer } from '../src/api/server'
import { createTestCompany } from './helpers'
import { writeYaml } from '../src/fs/yaml'
import { createDb } from '../src/db'
import { indexEntity } from '../src/db/search-index'

describe('Search API', () => {
	let companyRoot: string
	let cleanup: () => Promise<void>
	let port: number
	let server: ApiServer

	beforeEach(async () => {
		const tc = await createTestCompany()
		companyRoot = tc.root
		cleanup = tc.cleanup
		port = 10000 + Math.floor(Math.random() * 50000)

		await writeYaml(join(companyRoot, 'company.yaml'), {
			name: 'TestCorp',
			slug: 'testcorp',
			description: 'A test company',
			owner: { name: 'Tester', email: 'test@test.com' },
		})

		await writeYaml(join(companyRoot, 'team', 'agents.yaml'), {
			agents: [],
		})

		// Index some test data
		const db = await createDb(companyRoot)
		await indexEntity(db, 'task', 'task-001', 'Implement pricing page', 'Build the pricing page with Stripe integration')
		await indexEntity(db, 'task', 'task-002', 'Fix login bug', 'The login form crashes when submitting empty credentials')
		await indexEntity(db, 'knowledge', 'api-design.md', 'API Design Guide', 'REST API design guidelines and best practices')
		await indexEntity(db, 'pin', 'pin-001', 'Deploy alert', 'Production deployment completed successfully')

		server = new ApiServer({ companyRoot, port })
		await server.start()
	})

	afterEach(async () => {
		server.stop()
		await cleanup()
	})

	test('GET /api/search returns results for matching query', async () => {
		const res = await fetch(`http://localhost:${port}/api/search?q=pricing`)
		expect(res.status).toBe(200)

		const body = await res.json()
		expect(body.query).toBe('pricing')
		expect(body.mode).toBe('hybrid')
		expect(body.results.length).toBeGreaterThan(0)
		expect(body.results[0].entityType).toBe('task')
		expect(body.results[0].entityId).toBe('task-001')
		expect(body.total).toBeGreaterThan(0)
	})

	test('GET /api/search filters by type', async () => {
		const res = await fetch(`http://localhost:${port}/api/search?q=design&type=knowledge`)
		expect(res.status).toBe(200)

		const body = await res.json()
		expect(body.results.length).toBeGreaterThan(0)
		for (const r of body.results) {
			expect(r.entityType).toBe('knowledge')
		}
	})

	test('GET /api/search respects limit', async () => {
		const res = await fetch(`http://localhost:${port}/api/search?q=the&limit=1`)
		expect(res.status).toBe(200)

		const body = await res.json()
		expect(body.results.length).toBeLessThanOrEqual(1)
	})

	test('GET /api/search returns 400 without q parameter', async () => {
		const res = await fetch(`http://localhost:${port}/api/search`)
		expect(res.status).toBe(400)

		const body = await res.json()
		expect(body.error).toBe('q parameter is required')
	})

	test('GET /api/search returns empty results for non-matching query', async () => {
		const res = await fetch(`http://localhost:${port}/api/search?q=xyznonexistent`)
		expect(res.status).toBe(200)

		const body = await res.json()
		expect(body.results).toEqual([])
		expect(body.total).toBe(0)
	})

	test('GET /api/search supports fts mode', async () => {
		const res = await fetch(`http://localhost:${port}/api/search?q=login&mode=fts`)
		expect(res.status).toBe(200)

		const body = await res.json()
		expect(body.mode).toBe('fts')
		expect(body.results.length).toBeGreaterThan(0)
	})

	test('GET /api/search supports multiple type filters', async () => {
		const res = await fetch(`http://localhost:${port}/api/search?q=the&type=task,knowledge`)
		expect(res.status).toBe(200)

		const body = await res.json()
		for (const r of body.results) {
			expect(['task', 'knowledge']).toContain(r.entityType)
		}
	})
})
