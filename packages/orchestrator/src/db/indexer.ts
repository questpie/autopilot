import { readdir } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { createHash } from 'node:crypto'
import { PATHS } from '@questpie/autopilot-spec'
import type { AutopilotDb } from './index'
import { eq, and } from 'drizzle-orm'
import type { Client } from '@libsql/client'
import { indexEntity, removeEntity, type EntityType } from './search-index'
import { chunkText, chunkCode } from './chunker'
import { schema } from './index'
import { container, companyRootFactory } from '../container'
import { dbFactory } from './index'
import { logger } from '../logger'
import { embeddingServiceFactory } from '../embeddings'
import type { EmbeddingService } from '../embeddings'
import { loadAgents } from '../fs'
import { loadSkillCatalog } from '../skills/loader'
import type { StorageBackend } from '../fs/storage'

/** D31: Batch size for reindexAll processing. */
const BATCH_SIZE = 100

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
	 * Index a single entity (used for real-time indexing after writes).
	 */
	async indexOne(type: EntityType, id: string, title: string, content: string): Promise<void> {
		await this.indexEntitySafe(type, id, title, content)
	}

	/**
	 * Remove a single entity from the index.
	 */
	async removeOne(type: EntityType, id: string): Promise<void> {
		try {
			await removeEntity(this.db, type, id)
		} catch {
			// Silently ignore removal errors
		}
	}

	/**
	 * Reindex all entity types. Returns counts per type.
	 */
	async reindexAll(storage?: StorageBackend): Promise<{
		tasks: number; messages: number; knowledge: number; pins: number
		agents: number; channels: number; skills: number
	}> {
		const [tasks, messages, knowledge, pins] = await Promise.all([
			this.indexTasks(),
			this.indexMessages(),
			this.indexKnowledge(),
			this.indexPins(),
		])

		// Index agents and skills from YAML config
		const agents = await this.indexAgents()
		const skills = await this.indexSkills()

		// Index channels from storage if available
		let channels = 0
		if (storage) {
			channels = await this.indexChannels(storage)
		}

		return { tasks, messages, knowledge, pins, agents, channels, skills }
	}

	/**
	 * Index all tasks from the database. D31: processes in batches.
	 */
	async indexTasks(): Promise<number> {
		let count = 0
		try {
			const rows = await this.db.select().from(schema.tasks).all()
			for (let i = 0; i < rows.length; i += BATCH_SIZE) {
				const batch = rows.slice(i, i + BATCH_SIZE)
				for (const row of batch) {
					const content = [row.title, row.description, row.status, row.type]
						.filter(Boolean)
						.join('\n')
					const changed = await this.indexEntitySafe('task', row.id, row.title, content)
					if (changed) count++
				}
				// Yield between batches to avoid blocking
				if (i + BATCH_SIZE < rows.length) await new Promise((r) => setTimeout(r, 0))
			}
		} catch {
			// Tasks table may not exist yet
		}
		return count
	}

	/**
	 * Index all messages from the database. D31: processes in batches.
	 */
	async indexMessages(): Promise<number> {
		let count = 0
		try {
			const rows = await this.db.select().from(schema.messages).all()
			for (let i = 0; i < rows.length; i += BATCH_SIZE) {
				const batch = rows.slice(i, i + BATCH_SIZE)
				for (const row of batch) {
					const title = row.channel ? `#${row.channel}` : `DM from ${row.from_id}`
					const changed = await this.indexEntitySafe('message', row.id, title, row.content)
					if (changed) count++
				}
				if (i + BATCH_SIZE < rows.length) await new Promise((r) => setTimeout(r, 0))
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
	 * Index all agents from agents.yaml.
	 */
	async indexAgents(): Promise<number> {
		let count = 0
		try {
			const agents = await loadAgents(this.companyRoot)
			for (const agent of agents) {
				const content = [agent.name, agent.role, agent.description, agent.tools?.join(' ') ?? '']
					.filter(Boolean)
					.join('\n')
				const changed = await this.indexEntitySafe('agent', agent.id, agent.name, content)
				if (changed) count++
			}
		} catch {
			// agents.yaml may not exist
		}
		return count
	}

	/**
	 * Index all channels from storage.
	 */
	async indexChannels(storage: StorageBackend): Promise<number> {
		let count = 0
		try {
			const channels = await storage.listChannels()
			for (const ch of channels) {
				const content = [ch.name, ch.description ?? '', ch.type]
					.filter(Boolean)
					.join('\n')
				const changed = await this.indexEntitySafe('channel', ch.id, ch.name, content)
				if (changed) count++
			}
		} catch {
			// Channels may not be available
		}
		return count
	}

	/**
	 * Index all skills from the skills catalog.
	 */
	async indexSkills(): Promise<number> {
		let count = 0
		try {
			const catalog = await loadSkillCatalog(this.companyRoot)
			for (const skill of catalog.skills) {
				const content = [skill.name, skill.description, skill.roles?.join(' ') ?? '']
					.filter(Boolean)
					.join('\n')
				const changed = await this.indexEntitySafe('skill', skill.id, skill.name, content)
				if (changed) count++
			}
		} catch {
			// Skills may not exist
		}
		return count
	}

	/**
	 * Index a single entity, comparing content hash. Returns true if content changed.
	 * When an embedding service is available, also generates and stores a vector embedding.
	 * D26: Also stores paragraph-level chunks in the chunks table.
	 */
	private async indexEntitySafe(
		type: EntityType,
		id: string,
		title: string | null,
		content: string,
	): Promise<boolean> {
		try {
			const changed = await indexEntity(this.db, type, id, title, content)
			if (changed) {
				// D26: Store chunks
				await this.storeChunks(type, id, content)
				// Generate embedding for each chunk
				if (this.embeddingService) {
					await this.storeEmbedding(type, id, title, content)
				}
			}
			return changed
		} catch {
			return false
		}
	}

	/** Code file extensions for D28 code-aware chunking. */
	private static CODE_EXTENSIONS = new Set([
		'ts', 'tsx', 'js', 'jsx', 'mts', 'mjs', 'py', 'go', 'rs', 'java', 'kt', 'rb', 'php',
	])

	/**
	 * D26: Split content into chunks and store in the chunks table.
	 * D28: Uses code-aware chunking for code files.
	 */
	private async storeChunks(
		type: EntityType,
		id: string,
		content: string,
	): Promise<void> {
		try {
			// D28: Use code-aware chunking for code files
			const ext = id.split('.').pop()?.toLowerCase() ?? ''
			const isCode = Indexer.CODE_EXTENSIONS.has(ext)
			const textChunks = isCode ? chunkCode(content, id) : chunkText(content)
			const now = new Date().toISOString()

			// Delete existing chunks for this entity
			await this.db.delete(schema.chunks)
				.where(and(eq(schema.chunks.entityType, type), eq(schema.chunks.entityId, id)))

			// Insert new chunks
			for (const chunk of textChunks) {
				const hash = createHash('sha256').update(chunk.content).digest('hex').slice(0, 16)
				await this.db.insert(schema.chunks).values({
					entityType: type,
					entityId: id,
					chunkIndex: chunk.index,
					content: chunk.content,
					contentHash: hash,
					metadata: JSON.stringify({ section: chunk.section }),
					indexedAt: now,
				})
			}

			// Store chunk embeddings if available
			if (this.embeddingService) {
				await this.storeChunkEmbeddings(type, id, textChunks.map((c) => c.content))
			}
		} catch {
			// Chunk storage failed — entity is still indexed for FTS
		}
	}

	/**
	 * D26: Generate and store embeddings for each chunk in chunks_vec.
	 */
	private async storeChunkEmbeddings(
		type: EntityType,
		id: string,
		contents: string[],
	): Promise<void> {
		try {
			const raw = (this.db as unknown as { $client: Client }).$client

			// Get chunk IDs
			const chunkRows = await this.db
				.select({ id: schema.chunks.id })
				.from(schema.chunks)
				.where(and(eq(schema.chunks.entityType, type), eq(schema.chunks.entityId, id)))
				.all()

			for (let i = 0; i < Math.min(chunkRows.length, contents.length); i++) {
				const embedding = await this.embeddingService!.embedText(contents[i]!)
				if (!embedding) continue

				const chunkId = chunkRows[i]!.id
				const embeddingBuffer = Buffer.from(embedding.buffer)

				try {
					await raw.execute({ sql: 'DELETE FROM chunks_vec WHERE chunk_id = ?', args: [chunkId] })
				} catch { /* chunks_vec might not exist */ }
				try {
					await raw.execute({ sql: 'INSERT INTO chunks_vec (chunk_id, embedding) VALUES (?, ?)', args: [chunkId, embeddingBuffer] })
				} catch { /* chunks_vec not available */ }
			}
		} catch {
			// Embedding storage failed — chunks are still searchable via FTS
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
			const row = await this.db
				.select({ id: schema.searchIndex.id })
				.from(schema.searchIndex)
				.where(and(eq(schema.searchIndex.entityType, type), eq(schema.searchIndex.entityId, id)))
				.get()

			if (!row) return

			const raw = (this.db as unknown as { $client: Client }).$client
			const embeddingBuffer = Buffer.from(embedding.buffer)

			// Delete existing vector for this search_id, then insert
			try {
				await raw.execute({ sql: 'DELETE FROM search_vec WHERE search_id = ?', args: [row.id] })
			} catch {
				// search_vec might not exist
			}
			try {
				await raw.execute({ sql: 'INSERT INTO search_vec (search_id, embedding) VALUES (?, ?)', args: [row.id, embeddingBuffer] })
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

import { storageFactory } from '../fs/sqlite-backend'

export const indexerFactory = container.registerAsync('indexer', async (c) => {
	const { db, embeddingService, companyRoot, storage } = await c.resolveAsync([
		dbFactory, embeddingServiceFactory, companyRootFactory, storageFactory
	])
	const indexer = new Indexer(db.db, companyRoot, embeddingService)
	// Don't await — run in background so server starts immediately
	indexer.reindexAll(storage).then(() => {
		logger.info('db', 'startup reindex complete')
	}).catch((err) => {
		logger.error('db', 'startup reindex failed', { error: err instanceof Error ? err.message : String(err) })
	})
	return indexer
})
