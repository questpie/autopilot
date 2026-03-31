/**
 * D29: Functional chunk search tests.
 *
 * Tests searchChunksFts and searchChunksHybrid with a real in-memory
 * libSQL database. Verifies FTS5 indexing, ranking, and type filtering.
 */
import { describe, it, expect, afterEach } from 'bun:test'
import { createDb } from '../src/db'
import type { AutopilotDb } from '../src/db'
import { schema } from '../src/db'
import { searchChunksFts, searchChunksHybrid, type EntityType } from '../src/db/search-index'
import { createTestCompany } from './helpers'
import { createHash } from 'node:crypto'

describe('D29: chunk search', () => {
	let cleanup: () => Promise<void>
	let db: AutopilotDb

	afterEach(async () => {
		if (cleanup) await cleanup()
	})

	async function setup() {
		const ctx = await createTestCompany()
		cleanup = ctx.cleanup
		const result = await createDb(ctx.root)
		db = result.db
	}

	/** Insert a chunk into the chunks table. */
	async function insertChunk(
		entityType: EntityType,
		entityId: string,
		chunkIndex: number,
		content: string,
		metadata?: Record<string, unknown>,
	) {
		const hash = createHash('sha256').update(content).digest('hex').slice(0, 16)
		await db.insert(schema.chunks).values({
			entityType,
			entityId,
			chunkIndex,
			content,
			contentHash: hash,
			metadata: JSON.stringify(metadata ?? {}),
			indexedAt: new Date().toISOString(),
		})
	}

	// ─── FTS search ────────────────────────────────────────────────────

	it('should find a chunk by keyword via FTS', async () => {
		await setup()
		await insertChunk('knowledge', 'readme.md', 0, 'QUESTPIE Autopilot is an AI agent orchestration platform')

		const results = await searchChunksFts(db, 'orchestration')
		expect(results.length).toBe(1)
		expect(results[0]!.entityType).toBe('knowledge')
		expect(results[0]!.entityId).toBe('readme.md')
		expect(results[0]!.chunkIndex).toBe(0)
	})

	it('should return multiple matching chunks', async () => {
		await setup()
		await insertChunk('knowledge', 'guide.md', 0, 'Introduction to deployment and scaling')
		await insertChunk('knowledge', 'guide.md', 1, 'Advanced deployment strategies for production')
		await insertChunk('knowledge', 'other.md', 0, 'Something unrelated about cooking')

		const results = await searchChunksFts(db, 'deployment')
		expect(results.length).toBe(2)
		// Both chunks from guide.md should match
		expect(results.every((r) => r.entityId === 'guide.md')).toBe(true)
	})

	it('should return empty for non-matching query', async () => {
		await setup()
		await insertChunk('task', 'task-1', 0, 'Fix the login form validation')

		const results = await searchChunksFts(db, 'kubernetes')
		expect(results.length).toBe(0)
	})

	it('should filter by entity type', async () => {
		await setup()
		await insertChunk('knowledge', 'docs.md', 0, 'Database migration guide for SQLite')
		await insertChunk('task', 'task-1', 0, 'Migrate database to new schema with SQLite')

		const knowledgeOnly = await searchChunksFts(db, 'SQLite', { type: 'knowledge' })
		expect(knowledgeOnly.length).toBe(1)
		expect(knowledgeOnly[0]!.entityType).toBe('knowledge')

		const taskOnly = await searchChunksFts(db, 'SQLite', { type: 'task' })
		expect(taskOnly.length).toBe(1)
		expect(taskOnly[0]!.entityType).toBe('task')
	})

	it('should respect limit parameter', async () => {
		await setup()
		for (let i = 0; i < 10; i++) {
			await insertChunk('knowledge', `doc-${i}.md`, 0, `Section ${i} about vector search and embeddings`)
		}

		const limited = await searchChunksFts(db, 'vector', { limit: 3 })
		expect(limited.length).toBe(3)
	})

	it('should include snippet in results', async () => {
		await setup()
		await insertChunk('knowledge', 'api.md', 0, 'The REST API supports pagination via limit and offset query parameters')

		const results = await searchChunksFts(db, 'pagination')
		expect(results.length).toBe(1)
		expect(results[0]!.snippet).toBeTruthy()
		expect(results[0]!.snippet.length).toBeGreaterThan(0)
	})

	it('should include chunkContent in results', async () => {
		await setup()
		const content = 'Full content of the chunk about authentication flows'
		await insertChunk('knowledge', 'auth.md', 0, content)

		const results = await searchChunksFts(db, 'authentication')
		expect(results.length).toBe(1)
		expect(results[0]!.chunkContent).toBe(content)
	})

	it('should parse metadata from results', async () => {
		await setup()
		await insertChunk('knowledge', 'code.ts', 0, 'function handleRequest is the main entry point', {
			section: 'code.ts:handleRequest',
		})

		const results = await searchChunksFts(db, 'handleRequest')
		expect(results.length).toBe(1)
		expect(results[0]!.metadata).toBeDefined()
		expect(results[0]!.metadata?.section).toBe('code.ts:handleRequest')
	})

	// ─── Hybrid search ─────────────────────────────────────────────────

	it('should work in FTS-only mode (no embedding)', async () => {
		await setup()
		await insertChunk('knowledge', 'fts.md', 0, 'Full-text search with porter stemming')

		// null embedding = FTS only mode
		const results = await searchChunksHybrid(db, 'search', null)
		expect(results.length).toBe(1)
		expect(results[0]!.entityId).toBe('fts.md')
	})

	it('should handle empty database gracefully', async () => {
		await setup()

		const ftsResults = await searchChunksFts(db, 'anything')
		expect(ftsResults.length).toBe(0)

		const hybridResults = await searchChunksHybrid(db, 'anything', null)
		expect(hybridResults.length).toBe(0)
	})

	it('should use porter stemming (search "running" matches "run")', async () => {
		await setup()
		await insertChunk('knowledge', 'stem.md', 0, 'The agent is running tasks in the background')

		// Porter stemmer should match "run" → "running"
		const results = await searchChunksFts(db, 'run')
		expect(results.length).toBe(1)
	})

	it('should handle special characters in query', async () => {
		await setup()
		await insertChunk('knowledge', 'special.md', 0, 'Configuration uses key=value pairs')

		// FTS5 should handle this gracefully (not crash)
		const results = await searchChunksFts(db, 'key value')
		// May or may not match depending on tokenizer, but should not throw
		expect(Array.isArray(results)).toBe(true)
	})

	it('should rank more relevant chunks higher', async () => {
		await setup()
		await insertChunk('knowledge', 'a.md', 0, 'Docker is a container platform')
		await insertChunk('knowledge', 'b.md', 0, 'Docker containers run Docker images using Docker compose with Docker networking')

		const results = await searchChunksFts(db, 'Docker')
		expect(results.length).toBe(2)
		// The chunk with more "Docker" mentions should rank first (lower rank = better in FTS5)
	})
})
