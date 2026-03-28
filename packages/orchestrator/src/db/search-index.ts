import { eq, and } from 'drizzle-orm'
import { Database } from 'bun:sqlite'
import { searchIndex } from './schema'
import type { AutopilotDb } from './index'
import { createHash } from 'node:crypto'

export type EntityType = 'task' | 'message' | 'knowledge' | 'pin' | 'file' | 'agent' | 'channel' | 'skill'

export interface SearchResult {
	entityType: EntityType
	entityId: string
	title: string | null
	snippet: string
	score: number
}

function contentHash(content: string): string {
	return createHash('sha256').update(content).digest('hex').slice(0, 16)
}

function getRawDb(db: AutopilotDb): Database {
	return (db as unknown as { $client: Database }).$client
}

/**
 * Index or update an entity in the unified search index.
 * Returns true if the entity was actually inserted/updated (content changed).
 */
export async function indexEntity(
	db: AutopilotDb,
	type: EntityType,
	id: string,
	title: string | null,
	content: string,
): Promise<boolean> {
	const hash = contentHash(content)
	const now = new Date().toISOString()

	// Check if entity exists with same hash (skip if unchanged)
	const existing = db
		.select({ contentHash: searchIndex.contentHash })
		.from(searchIndex)
		.where(and(eq(searchIndex.entityType, type), eq(searchIndex.entityId, id)))
		.get()

	if (existing?.contentHash === hash) {
		return false
	}

	// Upsert: delete + insert (SQLite UPSERT with triggers needs delete first for FTS sync)
	db.delete(searchIndex)
		.where(and(eq(searchIndex.entityType, type), eq(searchIndex.entityId, id)))
		.run()

	db.insert(searchIndex)
		.values({
			entityType: type,
			entityId: id,
			title,
			content,
			contentHash: hash,
			indexedAt: now,
		})
		.run()

	return true
}

/**
 * Remove an entity from the search index.
 */
export async function removeEntity(
	db: AutopilotDb,
	type: EntityType,
	id: string,
): Promise<void> {
	// Delete orphaned vectors BEFORE removing the search_index row (need the row id)
	try {
		const row = db
			.select({ id: searchIndex.id })
			.from(searchIndex)
			.where(and(eq(searchIndex.entityType, type), eq(searchIndex.entityId, id)))
			.get()
		if (row) {
			const raw = getRawDb(db)
			try {
				raw.prepare('DELETE FROM search_vec WHERE search_id = ?').run(row.id)
			} catch {
				// search_vec may not exist
			}
		}
	} catch {
		// best-effort vector cleanup
	}

	db.delete(searchIndex)
		.where(and(eq(searchIndex.entityType, type), eq(searchIndex.entityId, id)))
		.run()
}

/**
 * Full-text search across the unified search index using FTS5.
 */
export async function searchFts(
	db: AutopilotDb,
	query: string,
	opts?: { type?: EntityType; limit?: number },
): Promise<SearchResult[]> {
	const raw = getRawDb(db)
	const limit = opts?.limit ?? 20

	try {
		const params: (string | number | Buffer)[] = [query]
		let typeFilter = ''
		if (opts?.type) {
			typeFilter = 'AND si.entity_type = ?'
			params.push(opts.type)
		}
		params.push(limit)

		const rows = raw.prepare(`
			SELECT
				si.entity_type,
				si.entity_id,
				si.title,
				snippet(search_fts, 1, '<b>', '</b>', '...', 40) as snippet,
				search_fts.rank as score
			FROM search_fts
			JOIN search_index si ON si.id = search_fts.rowid
			WHERE search_fts MATCH ?
			${typeFilter}
			ORDER BY search_fts.rank
			LIMIT ?
		`).all(...params) as Array<{
			entity_type: string
			entity_id: string
			title: string | null
			snippet: string
			score: number
		}>

		return rows.map((r) => ({
			entityType: r.entity_type as EntityType,
			entityId: r.entity_id,
			title: r.title,
			snippet: r.snippet,
			score: r.score,
		}))
	} catch {
		return []
	}
}

/**
 * Vector similarity search using sqlite-vec.
 */
export async function searchVec(
	db: AutopilotDb,
	embedding: Float32Array,
	opts?: { type?: EntityType; limit?: number },
): Promise<SearchResult[]> {
	const raw = getRawDb(db)
	const limit = opts?.limit ?? 20

	try {
		const embeddingBuffer = Buffer.from(embedding.buffer)

		const params: (string | number | Buffer)[] = [embeddingBuffer, limit]
		let typeFilter = ''
		if (opts?.type) {
			typeFilter = 'AND si.entity_type = ?'
			params.push(opts.type)
		}

		const rows = raw.prepare(`
			SELECT
				si.entity_type,
				si.entity_id,
				si.title,
				substr(si.content, 1, 200) as snippet,
				sv.distance as score
			FROM search_vec sv
			JOIN search_index si ON si.id = sv.search_id
			WHERE sv.embedding MATCH ? AND sv.k = ?
			${typeFilter}
			ORDER BY sv.distance
		`).all(...params) as Array<{
			entity_type: string
			entity_id: string
			title: string | null
			snippet: string
			score: number
		}>

		return rows.map((r) => ({
			entityType: r.entity_type as EntityType,
			entityId: r.entity_id,
			title: r.title,
			snippet: r.snippet,
			score: r.score,
		}))
	} catch {
		return []
	}
}

/**
 * Hybrid search combining FTS5 and vector results using Reciprocal Rank Fusion.
 * RRF formula: score = 1/(k + rank_fts) + 1/(k + rank_vec), k=60
 */
export async function searchHybrid(
	db: AutopilotDb,
	query: string,
	embedding: Float32Array | null,
	opts?: { type?: EntityType; limit?: number },
): Promise<SearchResult[]> {
	const limit = opts?.limit ?? 20
	const k = 60

	const ftsResults = await searchFts(db, query, { type: opts?.type, limit: limit * 2 })

	if (!embedding) {
		return ftsResults.slice(0, limit)
	}

	const vecResults = await searchVec(db, embedding, { type: opts?.type, limit: limit * 2 })

	// Build rank maps
	const scores = new Map<string, { score: number; result: SearchResult }>()

	ftsResults.forEach((r, i) => {
		const key = `${r.entityType}:${r.entityId}`
		const rrfScore = 1 / (k + i + 1)
		scores.set(key, { score: rrfScore, result: r })
	})

	vecResults.forEach((r, i) => {
		const key = `${r.entityType}:${r.entityId}`
		const rrfScore = 1 / (k + i + 1)
		const existing = scores.get(key)
		if (existing) {
			existing.score += rrfScore
		} else {
			scores.set(key, { score: rrfScore, result: r })
		}
	})

	// Sort by combined RRF score (descending)
	const merged = Array.from(scores.values())
		.sort((a, b) => b.score - a.score)
		.slice(0, limit)
		.map((entry) => ({
			...entry.result,
			score: entry.score,
		}))

	return merged
}
