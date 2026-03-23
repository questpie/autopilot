import { describe, it, expect, afterEach } from 'bun:test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { createDb } from '../src/db'
import type { AutopilotDb } from '../src/db'
import { Indexer } from '../src/db/indexer'
import { searchFts } from '../src/db/search-index'
import { createTestCompany } from './helpers'

describe('Indexer', () => {
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

		// Create knowledge directory with test files
		const knowledgeDir = join(root, 'knowledge')
		await mkdir(knowledgeDir, { recursive: true })
		await mkdir(join(knowledgeDir, 'technical'), { recursive: true })

		await Bun.write(
			join(knowledgeDir, 'technical', 'api-design.md'),
			'# API Design Guide\n\nUse REST endpoints with JSON bodies.\nAlways version your APIs.\n',
		)
		await Bun.write(
			join(knowledgeDir, 'technical', 'database.md'),
			'# Database Best Practices\n\nUse SQLite for local storage.\nEnable WAL mode.\n',
		)

		// Create pin files
		const pinsDir = join(root, 'dashboard', 'pins')
		await mkdir(pinsDir, { recursive: true })
		await Bun.write(
			join(pinsDir, 'important.yaml'),
			'title: Important Pin\ncontent: This is an important pinned item\n',
		)

		const result = await createDb(root)
		db = result.db
	}

	it('should reindex all entity types', async () => {
		await setup()
		const indexer = new Indexer(db, root)
		const counts = await indexer.reindexAll()

		expect(counts.knowledge).toBe(2)
		expect(counts.pins).toBe(1)
		// tasks and messages are 0 since no rows in DB
		expect(counts.tasks).toBe(0)
		expect(counts.messages).toBe(0)
	})

	it('should make knowledge searchable after reindex', async () => {
		await setup()
		const indexer = new Indexer(db, root)
		await indexer.reindexAll()

		const results = await searchFts(db, 'SQLite')
		expect(results.length).toBeGreaterThanOrEqual(1)
		expect(results[0]!.entityType).toBe('knowledge')
	})

	it('should make pins searchable after reindex', async () => {
		await setup()
		const indexer = new Indexer(db, root)
		await indexer.reindexAll()

		const results = await searchFts(db, 'important pinned')
		expect(results.length).toBeGreaterThanOrEqual(1)
		expect(results[0]!.entityType).toBe('pin')
	})

	it('should do incremental reindex (skip unchanged)', async () => {
		await setup()
		const indexer = new Indexer(db, root)

		// First reindex
		const first = await indexer.reindexAll()
		expect(first.knowledge).toBe(2)

		// Second reindex — nothing changed, so 0 updated
		const second = await indexer.reindexAll()
		expect(second.knowledge).toBe(0)
	})

	it('should detect changed content on reindex', async () => {
		await setup()
		const indexer = new Indexer(db, root)
		await indexer.reindexAll()

		// Modify a file
		await Bun.write(
			join(root, 'knowledge', 'technical', 'database.md'),
			'# Database Best Practices\n\nUse PostgreSQL for production.\n',
		)

		const counts = await indexer.reindexAll()
		expect(counts.knowledge).toBe(1) // only the changed file

		// New content should be searchable
		const results = await searchFts(db, 'PostgreSQL')
		expect(results.length).toBe(1)
	})
})
