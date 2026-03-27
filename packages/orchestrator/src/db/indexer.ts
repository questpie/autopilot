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
import { loadAgents } from '../fs'
import { loadSkillCatalog } from '../skills/loader'
import type { StorageBackend } from '../fs/storage'

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

import { storageFactory } from '../fs/sqlite-backend'

export const indexerFactory = container.registerAsync('indexer', async (c) => {
	const { db, embeddingService, companyRoot, storage } = await c.resolveAsync([
		dbFactory, embeddingServiceFactory, companyRootFactory, storageFactory
	])
	const indexer = new Indexer(db.db, companyRoot, embeddingService)
	await indexer.reindexAll(storage)
	return indexer
})
