/**
 * D27+D31: Functional Indexer end-to-end tests.
 *
 * Tests the Indexer class with real files, real DB, and verifies:
 * - Multi-format file detection and extraction (md, html, json, code)
 * - Chunks are created in the chunks table
 * - Batching doesn't lose data
 * - Search finds indexed content via FTS
 */
import { describe, it, expect, afterEach } from 'bun:test'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { eq, and } from 'drizzle-orm'
import { createDb, schema } from '../src/db'
import type { AutopilotDb } from '../src/db'
import { Indexer } from '../src/db/indexer'
import { searchFts, searchChunksFts } from '../src/db/search-index'
import { createTestCompany } from './helpers'

describe('D27: Indexer multi-format (functional)', () => {
	let cleanup: () => Promise<void>
	let db: AutopilotDb
	let root: string

	afterEach(async () => {
		if (cleanup) await cleanup()
	})

	async function setup() {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup
		const result = await createDb(root)
		db = result.db
		// Create knowledge directory
		await mkdir(join(root, 'knowledge'), { recursive: true })
	}

	it('indexes a markdown file and creates search entry', async () => {
		await setup()
		await writeFile(join(root, 'knowledge', 'readme.md'), '# Getting Started\n\nWelcome to the platform.')

		const indexer = new Indexer(db, root)
		const count = await indexer.indexKnowledge()

		expect(count).toBe(1)

		// Verify FTS search finds it
		const results = await searchFts(db, 'platform')
		expect(results.length).toBe(1)
		expect(results[0]!.entityId).toBe('readme.md')
	})

	it('indexes a TypeScript file', async () => {
		await setup()
		await writeFile(join(root, 'knowledge', 'utils.ts'), 'export function calculateTotal(items: number[]): number {\n  return items.reduce((a, b) => a + b, 0)\n}')

		const indexer = new Indexer(db, root)
		const count = await indexer.indexKnowledge()

		expect(count).toBe(1)
		const results = await searchFts(db, 'calculateTotal')
		expect(results.length).toBe(1)
	})

	it('indexes a JSON file with pretty-printed content', async () => {
		await setup()
		await writeFile(join(root, 'knowledge', 'config.json'), '{"database":"sqlite","port":3000}')

		const indexer = new Indexer(db, root)
		const count = await indexer.indexKnowledge()

		expect(count).toBe(1)
		const results = await searchFts(db, 'database')
		expect(results.length).toBe(1)
	})

	it('indexes an HTML file with tags stripped', async () => {
		await setup()
		await writeFile(join(root, 'knowledge', 'guide.html'), '<html><body><h1>API Guide</h1><p>Use the REST endpoint to query data.</p><script>alert(1)</script></body></html>')

		const indexer = new Indexer(db, root)
		const count = await indexer.indexKnowledge()

		expect(count).toBe(1)
		// Search for content (not tags)
		const results = await searchFts(db, 'REST endpoint')
		expect(results.length).toBe(1)
		// Script content should NOT be indexed
		const scriptResults = await searchFts(db, 'alert')
		expect(scriptResults.length).toBe(0)
	})

	it('indexes a YAML config file', async () => {
		await setup()
		await writeFile(join(root, 'knowledge', 'settings.yaml'), 'database:\n  host: localhost\n  port: 5432')

		const indexer = new Indexer(db, root)
		const count = await indexer.indexKnowledge()

		expect(count).toBe(1)
		const results = await searchFts(db, 'localhost')
		expect(results.length).toBe(1)
	})

	it('indexes files in subdirectories', async () => {
		await setup()
		await mkdir(join(root, 'knowledge', 'docs'), { recursive: true })
		await writeFile(join(root, 'knowledge', 'docs', 'setup.md'), '# Setup\n\nInstall dependencies with npm.')

		const indexer = new Indexer(db, root)
		const count = await indexer.indexKnowledge()

		expect(count).toBe(1)
		const results = await searchFts(db, 'dependencies')
		expect(results.length).toBe(1)
		expect(results[0]!.entityId).toContain('docs')
	})

	it('skips binary/unsupported files', async () => {
		await setup()
		await writeFile(join(root, 'knowledge', 'image.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
		await writeFile(join(root, 'knowledge', 'data.bin'), Buffer.from([0x00, 0x01, 0x02]))

		const indexer = new Indexer(db, root)
		const count = await indexer.indexKnowledge()

		// PNG might be detected as image (D30) if embedding service exists,
		// but with no embedding service, only indexable text files are counted
		// .bin is not in any extension set
		expect(count).toBe(0)
	})

	it('indexes multiple files in one pass', async () => {
		await setup()
		await writeFile(join(root, 'knowledge', 'a.md'), '# Alpha\n\nFirst document.')
		await writeFile(join(root, 'knowledge', 'b.txt'), 'Second plain text document about beta testing.')
		await writeFile(join(root, 'knowledge', 'c.py'), 'def gamma():\n    return "third"')

		const indexer = new Indexer(db, root)
		const count = await indexer.indexKnowledge()

		expect(count).toBe(3)
	})

	it('incremental reindex skips unchanged files', async () => {
		await setup()
		await writeFile(join(root, 'knowledge', 'doc.md'), '# Stable\n\nThis does not change.')

		const indexer = new Indexer(db, root)
		const first = await indexer.indexKnowledge()
		expect(first).toBe(1)

		// Re-index without changes
		const second = await indexer.indexKnowledge()
		expect(second).toBe(0) // no changes detected
	})

	it('detects changed content on reindex', async () => {
		await setup()
		await writeFile(join(root, 'knowledge', 'evolving.md'), '# Version 1\n\nOriginal content.')

		const indexer = new Indexer(db, root)
		await indexer.indexKnowledge()

		// Modify the file
		await writeFile(join(root, 'knowledge', 'evolving.md'), '# Version 2\n\nUpdated content about PostgreSQL.')

		const count = await indexer.indexKnowledge()
		expect(count).toBe(1) // detected change

		const results = await searchFts(db, 'PostgreSQL')
		expect(results.length).toBe(1)
	})
})

describe('D25+D26: Chunks created by indexer', () => {
	let cleanup: () => Promise<void>
	let db: AutopilotDb
	let root: string

	afterEach(async () => {
		if (cleanup) await cleanup()
	})

	async function setup() {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup
		const result = await createDb(root)
		db = result.db
		await mkdir(join(root, 'knowledge'), { recursive: true })
	}

	it('creates chunks in chunks table for indexed knowledge', async () => {
		await setup()
		await writeFile(join(root, 'knowledge', 'doc.md'), '# Title\n\nSome content about autopilot.')

		const indexer = new Indexer(db, root)
		await indexer.indexKnowledge()

		// Verify chunks table has entries
		const chunks = await db.select().from(schema.chunks)
			.where(and(eq(schema.chunks.entityType, 'knowledge'), eq(schema.chunks.entityId, 'doc.md')))
			.all()

		expect(chunks.length).toBeGreaterThanOrEqual(1)
		expect(chunks[0]!.content).toContain('autopilot')
	})

	it('chunks are searchable via chunks_fts', async () => {
		await setup()
		await writeFile(join(root, 'knowledge', 'chunked.md'), '# Architecture\n\nThe system uses microservices.')

		const indexer = new Indexer(db, root)
		await indexer.indexKnowledge()

		const results = await searchChunksFts(db, 'microservices')
		expect(results.length).toBeGreaterThanOrEqual(1)
		expect(results[0]!.entityId).toBe('chunked.md')
	})

	it('long document creates multiple chunks', async () => {
		await setup()
		// Create a document long enough to require multiple chunks (>2048 chars)
		const sections = Array.from({ length: 15 }, (_, i) =>
			`## Section ${i}\n\n${'Lorem ipsum dolor sit amet. '.repeat(20)}`
		).join('\n\n')
		await writeFile(join(root, 'knowledge', 'long.md'), `# Long Document\n\n${sections}`)

		const indexer = new Indexer(db, root)
		await indexer.indexKnowledge()

		const chunks = await db.select().from(schema.chunks)
			.where(eq(schema.chunks.entityId, 'long.md'))
			.all()

		expect(chunks.length).toBeGreaterThan(1)
		// Chunks should have sequential indices
		const indices = chunks.map((c) => c.chunkIndex).sort((a, b) => a - b)
		expect(indices[0]).toBe(0)
	})

	it('re-indexing replaces old chunks', async () => {
		await setup()
		await writeFile(join(root, 'knowledge', 'replace.md'), '# V1\n\nOriginal chunk content.')

		const indexer = new Indexer(db, root)
		await indexer.indexKnowledge()

		const v1Chunks = await db.select().from(schema.chunks)
			.where(eq(schema.chunks.entityId, 'replace.md'))
			.all()
		expect(v1Chunks.length).toBeGreaterThanOrEqual(1)

		// Update file
		await writeFile(join(root, 'knowledge', 'replace.md'), '# V2\n\nReplaced chunk content about Kubernetes.')
		await indexer.indexKnowledge()

		const v2Chunks = await db.select().from(schema.chunks)
			.where(eq(schema.chunks.entityId, 'replace.md'))
			.all()
		expect(v2Chunks.length).toBeGreaterThanOrEqual(1)
		// Old content gone, new content present
		expect(v2Chunks.some((c) => c.content.includes('Kubernetes'))).toBe(true)
		expect(v2Chunks.some((c) => c.content.includes('Original'))).toBe(false)
	})
})
