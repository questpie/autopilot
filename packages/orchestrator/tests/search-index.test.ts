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
		const result = await createDb(root)
		db = result.db
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

	// ── Additional coverage ─────────────────────────────────────────────

	it('removeEntity is idempotent (removing twice does not throw)', async () => {
		await setup()
		await indexEntity(db, 'task', 'task-1', 'Test', 'Content')
		await removeEntity(db, 'task', 'task-1')
		await removeEntity(db, 'task', 'task-1') // second remove — no throw
	})

	it('removeEntity for non-existent entity does not throw', async () => {
		await setup()
		await removeEntity(db, 'task', 'ghost-task') // never existed
	})

	it('FTS uses porter stemming (searching → search)', async () => {
		await setup()
		await indexEntity(db, 'knowledge', 'k1', 'Search', 'The searching algorithm finds results quickly')
		const results = await searchFts(db, 'search')
		expect(results.length).toBe(1)
	})

	it('indexes multiple entity types independently', async () => {
		await setup()
		await indexEntity(db, 'task', 't1', 'Task', 'Fix the database connection issue')
		await indexEntity(db, 'message', 'm1', 'Message', 'The database needs attention')
		await indexEntity(db, 'knowledge', 'k1', 'Knowledge', 'Database administration guide')
		await indexEntity(db, 'agent', 'a1', 'Agent', 'Database specialist agent')

		const all = await searchFts(db, 'database')
		expect(all.length).toBe(4)
	})

	it('result includes entityType, entityId, title, snippet, score', async () => {
		await setup()
		await indexEntity(db, 'knowledge', 'guide.md', 'Setup Guide', 'How to configure the application')

		const results = await searchFts(db, 'configure')
		expect(results.length).toBe(1)
		const r = results[0]!
		expect(r.entityType).toBe('knowledge')
		expect(r.entityId).toBe('guide.md')
		expect(r.title).toBe('Setup Guide')
		expect(r.snippet).toBeTruthy()
		expect(typeof r.score).toBe('number')
	})

	it('searchHybrid with type filter narrows results', async () => {
		await setup()
		await indexEntity(db, 'task', 't1', 'API', 'Build REST API')
		await indexEntity(db, 'knowledge', 'k1', 'API', 'API documentation')

		const tasksOnly = await searchHybrid(db, 'API', null, { type: 'task' })
		expect(tasksOnly.length).toBe(1)
		expect(tasksOnly[0]!.entityType).toBe('task')
	})

	it('handles empty database gracefully', async () => {
		await setup()
		const fts = await searchFts(db, 'anything')
		expect(fts.length).toBe(0)
		const hybrid = await searchHybrid(db, 'anything', null)
		expect(hybrid.length).toBe(0)
	})

	it('title can be null', async () => {
		await setup()
		const indexed = await indexEntity(db, 'message', 'm1', null, 'A message without a title')
		expect(indexed).toBe(true)
		const results = await searchFts(db, 'message')
		expect(results.length).toBe(1)
		expect(results[0]!.title).toBeNull()
	})
})
