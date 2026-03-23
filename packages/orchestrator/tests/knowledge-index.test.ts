import { describe, it, expect, afterEach } from 'bun:test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { createDb } from '../src/db'
import type { AutopilotDb } from '../src/db'
import { reindexKnowledge, reindexFile, searchKnowledge } from '../src/db/knowledge-index'
import { createTestCompany } from './helpers'

describe('knowledge-index', () => {
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
		await mkdir(join(knowledgeDir, 'brand'), { recursive: true })

		await Bun.write(
			join(knowledgeDir, 'technical', 'api-design.md'),
			'# API Design Guide\n\nUse REST endpoints with JSON bodies.\nAlways version your APIs: /v1/resource.\nAuthentication via Bearer tokens.\n',
		)
		await Bun.write(
			join(knowledgeDir, 'technical', 'database.md'),
			'# Database Best Practices\n\nUse SQLite for local storage.\nEnable WAL mode for concurrent reads.\nAlways add indexes for query patterns.\n',
		)
		await Bun.write(
			join(knowledgeDir, 'brand', 'guidelines.md'),
			'# Brand Guidelines\n\nQUESTPIE is always written in ALL CAPS.\nPrimary color: #B700FF (purple).\nDark theme with #0A0A0A background.\n',
		)

		db = await createDb(root)
	}

	it('should initialize FTS table via createDb migrations', async () => {
		await setup()
		// FTS5 is now initialized automatically by createDb via migrations + initSearchFts
		// Verify by doing a search (should not throw)
		const results = searchKnowledge(db, 'test')
		expect(results).toEqual([])
	})

	it('should reindex all knowledge files', async () => {
		await setup()
		const count = await reindexKnowledge(db, root)
		expect(count).toBe(3)
	})

	it('should search and find documents by content', async () => {
		await setup()
		await reindexKnowledge(db, root)

		const results = searchKnowledge(db, 'SQLite')
		expect(results.length).toBeGreaterThanOrEqual(1)
		expect(results[0]!.path).toBe('technical/database.md')
	})

	it('should search and return snippets', async () => {
		await setup()
		await reindexKnowledge(db, root)

		const results = searchKnowledge(db, 'REST endpoints')
		expect(results.length).toBeGreaterThanOrEqual(1)
		expect(results[0]!.snippet).toBeTruthy()
	})

	it('should extract titles from markdown headings', async () => {
		await setup()
		await reindexKnowledge(db, root)

		const results = searchKnowledge(db, 'brand')
		const brandResult = results.find((r) => r.path.includes('brand'))
		expect(brandResult).toBeDefined()
		expect(brandResult!.title).toBe('Brand Guidelines')
	})

	it('should incrementally reindex a single file', async () => {
		await setup()
		await reindexKnowledge(db, root)

		// Update a file
		const filePath = join(root, 'knowledge', 'technical', 'database.md')
		await Bun.write(
			filePath,
			'# Database Best Practices\n\nUse PostgreSQL for production.\nEnable connection pooling.\n',
		)

		await reindexFile(db, root, filePath)

		// Old content should not match
		const oldResults = searchKnowledge(db, 'WAL mode')
		expect(oldResults.length).toBe(0)

		// New content should match
		const newResults = searchKnowledge(db, 'PostgreSQL')
		expect(newResults.length).toBe(1)
	})

	it('should handle file deletion during reindex', async () => {
		await setup()
		await reindexKnowledge(db, root)

		// Remove the file from FS
		const filePath = join(root, 'knowledge', 'brand', 'guidelines.md')
		const { rm } = await import('node:fs/promises')
		await rm(filePath)

		await reindexFile(db, root, filePath)

		// Should no longer be searchable
		const results = searchKnowledge(db, 'QUESTPIE')
		expect(results.length).toBe(0)
	})

	it('should return empty results for non-matching query', async () => {
		await setup()
		await reindexKnowledge(db, root)

		const results = searchKnowledge(db, 'xyznonexistent')
		expect(results.length).toBe(0)
	})

	it('should respect max_results limit', async () => {
		await setup()
		await reindexKnowledge(db, root)

		const results = searchKnowledge(db, 'the', 1)
		expect(results.length).toBeLessThanOrEqual(1)
	})
})
