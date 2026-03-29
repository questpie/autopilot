import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { createClient, type Client } from '@libsql/client'
import { join } from 'node:path'
import { mkdir } from 'node:fs/promises'
import * as schema from './schema'

export type AutopilotDb = ReturnType<typeof drizzle<typeof schema>>

export interface DbResult {
	db: AutopilotDb
	raw: Client
}

/**
 * Create a Drizzle-wrapped libSQL database for the given company root.
 *
 * The DB file is stored at `<companyRoot>/.data/autopilot.db` with WAL mode
 * enabled for concurrent read performance.
 *
 * Runs Drizzle migrations (including custom SQL for FTS5 / vec0 virtual tables).
 *
 * Returns both the Drizzle ORM instance and the raw libSQL Client
 * so callers (e.g. Better Auth) can share the same underlying connection.
 */
export async function createDb(companyRoot: string, opts?: { embeddingDimensions?: number; useDiskAnn?: boolean }): Promise<DbResult> {
	const dataDir = join(companyRoot, '.data')
	await mkdir(dataDir, { recursive: true })

	const dbPath = join(dataDir, 'autopilot.db')
	const client = createClient({
		url: process.env.DATABASE_URL ?? `file:${dbPath}`,
		syncUrl: process.env.TURSO_SYNC_URL,
		authToken: process.env.TURSO_AUTH_TOKEN,
	})

	await client.execute('PRAGMA journal_mode = WAL')
	await client.execute('PRAGMA synchronous = NORMAL')
	await client.execute('PRAGMA foreign_keys = ON')
	await client.execute('PRAGMA busy_timeout = 5000')

	const db = drizzle(client, { schema })

	// Run drizzle migrations (regular tables)
	migrate(db, { migrationsFolder: join(__dirname, '..', '..', 'drizzle') })

	// Create FTS5 virtual table + triggers for unified search index
	// (must be raw SQL — drizzle migrator cannot handle trigger semicolons)
	await initSearchFts(client)

	// D44: Detect if running on Turso (libSQL native vectors) or local (sqlite-vec)
	const dims = opts?.embeddingDimensions ?? 768
	const isTurso = !!(process.env.TURSO_SYNC_URL || process.env.DATABASE_URL?.startsWith('libsql://'))

	if (isTurso) {
		// ── libSQL native: F32_BLOB columns + DiskANN index via libsql_vector_idx ──
		// Embeddings stored directly in the regular tables as F32_BLOB columns.
		// search_index already has content; we add an embedding column if missing.
		try {
			await client.execute(`ALTER TABLE search_index ADD COLUMN embedding F32_BLOB(${dims})`)
		} catch { /* column already exists */ }
		try {
			await client.execute(`CREATE INDEX IF NOT EXISTS search_vec_idx ON search_index (libsql_vector_idx(embedding))`)
		} catch { /* index already exists or not supported */ }
	} else {
		// ── Local: sqlite-vec vec0 virtual table ──
		try {
			await client.execute(`
				CREATE VIRTUAL TABLE IF NOT EXISTS search_vec USING vec0(
					search_id INTEGER PRIMARY KEY,
					embedding float[${dims}]
				)
			`)
		} catch {
			// vec0 not available — vector search will be unavailable
		}
	}

	// D25: FTS5 + vec0/DiskANN virtual tables for chunks
	await initChunksFts(client, dims, isTurso)

	// Cleanup expired rate limit entries on startup and every 5 minutes
	try { await client.execute(`DELETE FROM rate_limit_entries WHERE expires_at < unixepoch()`) } catch { /* table may not exist yet */ }
	setInterval(() => {
		client.execute(`DELETE FROM rate_limit_entries WHERE expires_at < unixepoch()`).catch(() => {/* db closed */})
	}, 5 * 60 * 1000)

	// Cleanup expired file locks on startup and every minute
	const nowMs = Date.now()
	try { await client.execute(`DELETE FROM file_locks WHERE expires_at < ${nowMs}`) } catch { /* table may not exist yet */ }
	setInterval(() => {
		client.execute(`DELETE FROM file_locks WHERE expires_at < ${Date.now()}`).catch(() => {/* db closed */})
	}, 60 * 1000)

	// Cleanup expired pins on startup and every 5 minutes
	try { await client.execute(`DELETE FROM pins WHERE expires_at IS NOT NULL AND expires_at < ${nowMs}`) } catch { /* table may not exist yet */ }
	setInterval(() => {
		client.execute(`DELETE FROM pins WHERE expires_at IS NOT NULL AND expires_at < ${Date.now()}`).catch(() => {/* db closed */})
	}, 5 * 60 * 1000)

	return { db, raw: client }
}

/**
 * Initialize FTS5 virtual table and triggers for the unified search_index table.
 * Uses raw SQL because Drizzle ORM does not support virtual tables or triggers.
 */
async function initSearchFts(client: Client): Promise<void> {
	try {
		await client.execute(`
			CREATE VIRTUAL TABLE IF NOT EXISTS search_fts USING fts5(
				title, content,
				content=search_index,
				content_rowid=id,
				tokenize='porter unicode61'
			)
		`)
	} catch {
		// Already exists
	}

	try {
		await client.execute(`
			CREATE TRIGGER IF NOT EXISTS search_fts_ai AFTER INSERT ON search_index BEGIN
				INSERT INTO search_fts(rowid, title, content) VALUES (new.id, new.title, new.content);
			END
		`)
		await client.execute(`
			CREATE TRIGGER IF NOT EXISTS search_fts_ad AFTER DELETE ON search_index BEGIN
				INSERT INTO search_fts(search_fts, rowid, title, content) VALUES('delete', old.id, old.title, old.content);
			END
		`)
		await client.execute(`
			CREATE TRIGGER IF NOT EXISTS search_fts_au AFTER UPDATE ON search_index BEGIN
				INSERT INTO search_fts(search_fts, rowid, title, content) VALUES('delete', old.id, old.title, old.content);
				INSERT INTO search_fts(rowid, title, content) VALUES (new.id, new.title, new.content);
			END
		`)
	} catch {
		// Triggers already exist
	}
}

/**
 * D25: Initialize FTS5 virtual tables for chunks table.
 * D44: Use libSQL native DiskANN on Turso, vec0 locally.
 */
async function initChunksFts(client: Client, dims: number, isTurso: boolean): Promise<void> {
	try {
		await client.execute(`
			CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
				content,
				content=chunks,
				content_rowid=id,
				tokenize='porter unicode61'
			)
		`)
	} catch { /* already exists */ }

	try {
		await client.execute(`
			CREATE TRIGGER IF NOT EXISTS chunks_fts_ai AFTER INSERT ON chunks BEGIN
				INSERT INTO chunks_fts(rowid, content) VALUES (new.id, new.content);
			END
		`)
		await client.execute(`
			CREATE TRIGGER IF NOT EXISTS chunks_fts_ad AFTER DELETE ON chunks BEGIN
				INSERT INTO chunks_fts(chunks_fts, rowid, content) VALUES('delete', old.id, old.content);
			END
		`)
		await client.execute(`
			CREATE TRIGGER IF NOT EXISTS chunks_fts_au AFTER UPDATE ON chunks BEGIN
				INSERT INTO chunks_fts(chunks_fts, rowid, content) VALUES('delete', old.id, old.content);
				INSERT INTO chunks_fts(rowid, content) VALUES (new.id, new.content);
			END
		`)
	} catch { /* triggers exist */ }

	if (isTurso) {
		// D44: libSQL native — add F32_BLOB column + DiskANN index to chunks table
		try {
			await client.execute(`ALTER TABLE chunks ADD COLUMN embedding F32_BLOB(${dims})`)
		} catch { /* column already exists */ }
		try {
			await client.execute(`CREATE INDEX IF NOT EXISTS chunks_vec_idx ON chunks (libsql_vector_idx(embedding))`)
		} catch { /* index exists or not supported */ }
	} else {
		// Local: sqlite-vec vec0 virtual table
		try {
			await client.execute(`
				CREATE VIRTUAL TABLE IF NOT EXISTS chunks_vec USING vec0(
					chunk_id INTEGER PRIMARY KEY,
					embedding float[${dims}]
				)
			`)
		} catch { /* vec0 not available */ }
	}
}

/**
 * Initialize FTS5 virtual tables and triggers for message full-text search.
 * Uses raw SQL because Drizzle ORM does not support virtual tables.
 */
export async function initFts(db: AutopilotDb): Promise<void> {
	const raw = (db as unknown as { $client: Client }).$client

	try {
		await raw.execute(`
			CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
				content,
				content=messages,
				content_rowid=rowid
			)
		`)
	} catch {
		// Already exists — FTS5 virtual tables may not support IF NOT EXISTS in all versions
	}

	// Triggers for automatic FTS sync
	try {
		await raw.execute(`
			CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
				INSERT INTO messages_fts(rowid, content) VALUES (new.rowid, new.content);
			END
		`)
		await raw.execute(`
			CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
				INSERT INTO messages_fts(messages_fts, rowid, content) VALUES('delete', old.rowid, old.content);
			END
		`)
		await raw.execute(`
			CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE ON messages BEGIN
				INSERT INTO messages_fts(messages_fts, rowid, content) VALUES('delete', old.rowid, old.content);
				INSERT INTO messages_fts(rowid, content) VALUES (new.rowid, new.content);
			END
		`)
	} catch {
		// Triggers already exist
	}
}

export { schema }

import { container, companyRootFactory } from '../container'
import { loadCompany } from '../fs'

export const dbFactory = container.registerAsync('db', async (c) => {
	const { companyRoot } = c.resolve([companyRootFactory])

	// Read embedding dimensions from company config so the vec0 table matches the provider
	let embeddingDimensions: number | undefined
	try {
		const company = await loadCompany(companyRoot)
		const settings = company.settings as Record<string, unknown> | undefined
		const embeddingsConfig = settings?.embeddings as { dimensions?: number } | undefined
		embeddingDimensions = embeddingsConfig?.dimensions
	} catch {
		// Config not available yet — use default
	}

	return createDb(companyRoot, { embeddingDimensions })
})
