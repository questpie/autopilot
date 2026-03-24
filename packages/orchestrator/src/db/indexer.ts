import { readdir } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { PATHS } from '@questpie/autopilot-spec'
import type { AutopilotDb } from './index'
import { eq, and } from 'drizzle-orm'
import { Database } from 'bun:sqlite'
import { indexEntity, removeEntity, type EntityType } from './search-index'
import { schema } from './index'
import { container, companyRootFactory } from '../container'
import { dbFactory } from './index'
import { embeddingServiceFactory } from '../embeddings'
import type { EmbeddingService } from '../embeddings'

/**
 * Unified indexer that populates the search_index table from all entity sources.
 * Uses content hashing for incremental reindexing — only changed entities are updated.
 *
 * When an {@link EmbeddingService} is provided, embeddings are generated for
 * each indexed entity and stored in the `search_vec` virtual table. If
 * embedding generation fails the entity is still indexed for FTS-only search.
 */
export class Indexer {
	private embeddingService: EmbeddingService | null

	constructor(
		private db: AutopilotDb,
		private companyRoot: string,
		embeddingService?: EmbeddingService | null,
	) {
		this.embeddingService = embeddingService ?? null
	}

	/**
	 * Reindex all entity types. Returns counts per type.
	 */
	async reindexAll(): Promise<{ tasks: number; messages: number; knowledge: number; pins: number }> {
		const [tasks, messages, knowledge, pins] = await Promise.all([
			this.indexTasks(),
			this.indexMessages(),
			this.indexKnowledge(),
			this.indexPins(),
		])
		return { tasks, messages, knowledge, pins }
	}

	/**
	 * Index all tasks from the database.
	 */
	async indexTasks(): Promise<number> {
		let count = 0
		try {
			const rows = this.db.select().from(schema.tasks).all()
			for (const row of rows) {
				const content = [row.title, row.description, row.status, row.type]
					.filter(Boolean)
					.join('\n')
				const changed = await this.indexEntitySafe('task', row.id, row.title, content)
				if (changed) count++
			}
		} catch {
			// Tasks table may not exist yet
		}
		return count
	}

	/**
	 * Index all messages from the database.
	 */
	async indexMessages(): Promise<number> {
		let count = 0
		try {
			const rows = this.db.select().from(schema.messages).all()
			for (const row of rows) {
				const title = row.channel ? `#${row.channel}` : `DM from ${row.from_id}`
				const changed = await this.indexEntitySafe('message', row.id, title, row.content)
				if (changed) count++
			}
		} catch {
			// Messages table may not exist yet
		}
		return count
	}

	/**
	 * Index all markdown files from the knowledge directory.
	 */
	async indexKnowledge(): Promise<number> {
		const knowledgeDir = join(this.companyRoot, PATHS.KNOWLEDGE_DIR.replace(/^\/company/, ''))
		let count = 0

		const indexDir = async (dir: string): Promise<void> => {
			let entries: import('node:fs').Dirent[]
			try {
				entries = await readdir(dir, { withFileTypes: true })
			} catch {
				return
			}

			for (const entry of entries) {
				const fullPath = join(dir, entry.name)
				if (entry.isDirectory()) {
					await indexDir(fullPath)
				} else if (entry.name.endsWith('.md')) {
					try {
						const content = await Bun.file(fullPath).text()
						const relPath = relative(knowledgeDir, fullPath)
						const title = this.extractTitle(content, entry.name)
						const changed = await this.indexEntitySafe('knowledge', relPath, title, content)
						if (changed) count++
					} catch {
						// Skip unreadable files
					}
				}
			}
		}

		await indexDir(knowledgeDir)
		return count
	}

	/**
	 * Index all pin files from the dashboard/pins directory.
	 */
	async indexPins(): Promise<number> {
		const pinsDir = join(this.companyRoot, PATHS.PINS_DIR.replace(/^\/company/, ''))
		let count = 0

		try {
			const entries = await readdir(pinsDir, { withFileTypes: true })
			for (const entry of entries) {
				if (!entry.isFile() || !entry.name.endsWith('.yaml')) continue
				try {
					const fullPath = join(pinsDir, entry.name)
					const content = await Bun.file(fullPath).text()
					const pinId = entry.name.replace(/\.yaml$/, '')
					const changed = await this.indexEntitySafe('pin', pinId, pinId, content)
					if (changed) count++
				} catch {
					// Skip unreadable files
				}
			}
		} catch {
			// Pins directory may not exist
		}

		return count
	}

	/**
	 * Index a single entity, comparing content hash. Returns true if content changed.
	 * When an embedding service is available, also generates and stores a vector embedding.
	 */
	private async indexEntitySafe(
		type: EntityType,
		id: string,
		title: string | null,
		content: string,
	): Promise<boolean> {
		try {
			const changed = await indexEntity(this.db, type, id, title, content)
			if (changed && this.embeddingService) {
				await this.storeEmbedding(type, id, title, content)
			}
			return changed
		} catch {
			return false
		}
	}

	/**
	 * Generate an embedding for the entity content and store it in search_vec.
	 * Failures are silently ignored — the entity remains searchable via FTS.
	 */
	private async storeEmbedding(
		type: EntityType,
		id: string,
		title: string | null,
		content: string,
	): Promise<void> {
		try {
			const text = [title, content].filter(Boolean).join('\n')
			const embedding = await this.embeddingService!.embedText(text)
			if (!embedding) return

			// Get the search_index row id for this entity
			const row = this.db
				.select({ id: schema.searchIndex.id })
				.from(schema.searchIndex)
				.where(and(eq(schema.searchIndex.entityType, type), eq(schema.searchIndex.entityId, id)))
				.get()

			if (!row) return

			const raw = (this.db as unknown as { $client: Database }).$client
			const embeddingBuffer = Buffer.from(embedding.buffer)

			// Delete existing vector for this search_id, then insert
			try {
				raw.prepare('DELETE FROM search_vec WHERE search_id = ?').run(row.id)
			} catch {
				// search_vec might not exist
			}
			try {
				raw.prepare('INSERT INTO search_vec (search_id, embedding) VALUES (?, ?)').run(row.id, embeddingBuffer)
			} catch {
				// search_vec not available — skip silently
			}
		} catch {
			// Embedding storage failed — entity is still indexed for FTS
		}
	}

	/**
	 * Extract a title from markdown content by finding the first heading.
	 */
	private extractTitle(content: string, fallback: string): string {
		const match = content.match(/^#\s+(.+)$/m)
		if (match?.[1]) return match[1].trim()
		return fallback.replace(/\.md$/, '')
	}
}

export const indexerFactory = container.registerAsync('indexer', async (c) => {
	const { db, embeddingService, companyRoot } = await c.resolveAsync([
		dbFactory, embeddingServiceFactory, companyRootFactory
	])
	const indexer = new Indexer(db.db, companyRoot, embeddingService)
	await indexer.reindexAll()
	return indexer
})
