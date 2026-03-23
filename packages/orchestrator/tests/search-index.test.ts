import { describe, it, expect, afterEach } from 'bun:test'
import { createDb } from '../src/db'
import type { AutopilotDb } from '../src/db'
import { indexEntity, removeEntity, searchFts, searchHybrid } from '../src/db/search-index'
import { createTestCompany } from './helpers'

describe('search-index', () => {
	let cleanup: () => Promise<void>
	let root: string
	let db: AutopilotDb

	afterEach(async () => {
		if (cleanup) await cleanup()
	})

	async function setup() {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup
		db = await createDb(root)
	}

	it('should index an entity and find it via FTS', async () => {
		await setup()
		await indexEntity(db, 'task', 'task-1', 'Fix login bug', 'The login form crashes when submitting empty credentials')

		const results = await searchFts(db, 'login')
		expect(results.length).toBe(1)
		expect(results[0]!.entityType).toBe('task')
		expect(results[0]!.entityId).toBe('task-1')
	})

	it('should update an entity when content changes', async () => {
		await setup()
		const first = await indexEntity(db, 'task', 'task-1', 'Fix bug', 'Old content about login')
		expect(first).toBe(true)

		const second = await indexEntity(db, 'task', 'task-1', 'Fix bug', 'New content about dashboard')
		expect(second).toBe(true)

		// Old content should not match
		const oldResults = await searchFts(db, 'login')
		expect(oldResults.length).toBe(0)

		// New content should match
		const newResults = await searchFts(db, 'dashboard')
		expect(newResults.length).toBe(1)
	})

	it('should skip indexing when content hash is unchanged', async () => {
		await setup()
		const content = 'Some stable content for testing'
		const first = await indexEntity(db, 'knowledge', 'doc.md', 'My Doc', content)
		expect(first).toBe(true)

		const second = await indexEntity(db, 'knowledge', 'doc.md', 'My Doc', content)
		expect(second).toBe(false)
	})

	it('should remove an entity', async () => {
		await setup()
		await indexEntity(db, 'task', 'task-1', 'Test', 'Content to be removed')

		await removeEntity(db, 'task', 'task-1')

		const results = await searchFts(db, 'removed')
		expect(results.length).toBe(0)
	})

	it('should filter by entity type', async () => {
		await setup()
		await indexEntity(db, 'task', 'task-1', 'API task', 'Implement REST API endpoints')
		await indexEntity(db, 'knowledge', 'api.md', 'API Guide', 'REST API design guidelines')

		const taskResults = await searchFts(db, 'API', { type: 'task' })
		expect(taskResults.length).toBe(1)
		expect(taskResults[0]!.entityType).toBe('task')

		const knowledgeResults = await searchFts(db, 'API', { type: 'knowledge' })
		expect(knowledgeResults.length).toBe(1)
		expect(knowledgeResults[0]!.entityType).toBe('knowledge')
	})

	it('should return empty results for non-matching query', async () => {
		await setup()
		await indexEntity(db, 'task', 'task-1', 'Test', 'Some content')

		const results = await searchFts(db, 'xyznonexistent')
		expect(results.length).toBe(0)
	})

	it('should respect limit', async () => {
		await setup()
		for (let i = 0; i < 5; i++) {
			await indexEntity(db, 'task', `task-${i}`, `Task ${i}`, `Common keyword testing task number ${i}`)
		}

		const results = await searchFts(db, 'keyword', { limit: 2 })
		expect(results.length).toBeLessThanOrEqual(2)
	})

	it('searchHybrid should work with FTS-only (null embedding)', async () => {
		await setup()
		await indexEntity(db, 'task', 'task-1', 'Deploy', 'Deploy the application to production server')
		await indexEntity(db, 'knowledge', 'deploy.md', 'Deploy Guide', 'How to deploy applications')

		const results = await searchHybrid(db, 'deploy', null, { limit: 10 })
		expect(results.length).toBe(2)
	})
})
