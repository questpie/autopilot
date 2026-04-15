import { blob, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

// ─── Search Index ──────────────────────────────────────────────────────────

export const searchIndex = sqliteTable(
	'search_index',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		entityType: text('entity_type').notNull(),
		entityId: text('entity_id').notNull(),
		title: text('title'),
		content: text('content').notNull(),
		contentHash: text('content_hash').notNull(),
		indexedAt: text('indexed_at').notNull(),
		/** libSQL native F32_BLOB — embedding vector for DiskANN search. */
		embedding: blob('embedding'),
	},
	(table) => [
		index('idx_search_entity_type').on(table.entityType),
		index('idx_search_entity_id').on(table.entityId),
		uniqueIndex('uq_search_entity').on(table.entityType, table.entityId),
	],
)

// ─── Chunks (paragraph-level embedding chunks) ────────────────────────────

export const chunks = sqliteTable(
	'chunks',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		entityType: text('entity_type').notNull(),
		entityId: text('entity_id').notNull(),
		chunkIndex: integer('chunk_index').notNull(),
		content: text('content').notNull(),
		contentHash: text('content_hash').notNull(),
		metadata: text('metadata').default('{}'),
		indexedAt: text('indexed_at').notNull(),
		/** libSQL native F32_BLOB — embedding vector for DiskANN search. */
		embedding: blob('embedding'),
	},
	(table) => [
		index('idx_chunks_entity').on(table.entityType, table.entityId),
		index('idx_chunks_entity_chunk').on(table.entityType, table.entityId, table.chunkIndex),
		index('idx_chunks_hash').on(table.contentHash),
	],
)
