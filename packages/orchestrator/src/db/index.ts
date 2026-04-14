import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { type Client, createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { env } from '../env'
import * as companySchema from './company-schema'
import * as indexSchema from './index-schema'

export type CompanyDb = ReturnType<typeof drizzle<typeof companySchema>>
export type IndexDb = ReturnType<typeof drizzle<typeof indexSchema>>

export interface CompanyDbResult {
	db: CompanyDb
	raw: Client
}

export interface IndexDbResult {
	db: IndexDb
	raw: Client
}

/**
 * Create the company database (operational truth — never rebuilt).
 *
 * Stored at `<companyRoot>/.data/company.db` with WAL mode enabled.
 * Runs Drizzle migrations for schema changes.
 */
export async function createCompanyDb(companyRoot: string): Promise<CompanyDbResult> {
	const dataDir = join(companyRoot, '.data')
	await mkdir(dataDir, { recursive: true })

	const dbPath = join(dataDir, 'company.db')
	const client = createClient({
		url: env.DATABASE_URL ?? `file:${dbPath}`,
		syncUrl: env.TURSO_SYNC_URL,
		authToken: env.TURSO_AUTH_TOKEN,
	})

	await client.execute('PRAGMA journal_mode = WAL')
	await client.execute('PRAGMA synchronous = NORMAL')
	await client.execute('PRAGMA foreign_keys = ON')
	await client.execute('PRAGMA busy_timeout = 5000')

	const db = drizzle(client, { schema: companySchema })

	// Run drizzle migrations (regular tables)
	const migrationsDir = join(import.meta.dir, '..', '..', 'drizzle')
	await migrate(db, { migrationsFolder: migrationsDir })

	return { db, raw: client }
}

/**
 * Create the index database (derived search/embedding state — fully rebuildable).
 *
 * Stored at `<companyRoot>/.data/index.db` with WAL mode enabled.
 * Creates FTS5 virtual tables and DiskANN vector indexes via raw SQL.
 */
export async function createIndexDb(companyRoot: string): Promise<IndexDbResult> {
	const dataDir = join(companyRoot, '.data')
	await mkdir(dataDir, { recursive: true })

	const dbPath = join(dataDir, 'index.db')
	const client = createClient({ url: `file:${dbPath}` })

	await client.execute('PRAGMA journal_mode = WAL')
	await client.execute('PRAGMA synchronous = NORMAL')
	await client.execute('PRAGMA foreign_keys = ON')
	await client.execute('PRAGMA busy_timeout = 5000')

	const db = drizzle(client, { schema: indexSchema })

	// Create core tables via raw SQL (index.db is fully rebuildable — no migrations needed)
	await createIndexTables(client)

	// Items table (VFS item index)
	await createItemsTables(client)

	// FTS5 virtual tables for items
	await initItemsFts(client)

	// FTS5 virtual tables for search_index
	await initSearchFts(client)

	// FTS5 virtual tables for chunks
	await initChunksFts(client)

	// DiskANN vector indexes (libSQL native)
	try {
		await client.execute(
			'CREATE INDEX IF NOT EXISTS search_vec_idx ON search_index (libsql_vector_idx(embedding))',
		)
	} catch (err) {
		console.warn('[db] vector index search_vec_idx unavailable (libSQL without vector support?):', err instanceof Error ? err.message : String(err))
	}
	try {
		await client.execute(
			'CREATE INDEX IF NOT EXISTS chunks_vec_idx ON chunks (libsql_vector_idx(embedding))',
		)
	} catch (err) {
		console.warn('[db] vector index chunks_vec_idx unavailable (libSQL without vector support?):', err instanceof Error ? err.message : String(err))
	}

	return { db, raw: client }
}

// ─── Index Table Creation (raw SQL — rebuildable) ─────────────────────────

async function createIndexTables(client: Client): Promise<void> {
	await client.execute(`
		CREATE TABLE IF NOT EXISTS search_index (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			entity_type TEXT NOT NULL,
			entity_id TEXT NOT NULL,
			title TEXT,
			content TEXT NOT NULL,
			content_hash TEXT NOT NULL,
			indexed_at TEXT NOT NULL,
			embedding BLOB
		)
	`)
	await client.execute('CREATE INDEX IF NOT EXISTS idx_search_entity_type ON search_index(entity_type)')
	await client.execute('CREATE INDEX IF NOT EXISTS idx_search_entity_id ON search_index(entity_id)')
	await client.execute('CREATE UNIQUE INDEX IF NOT EXISTS uq_search_entity ON search_index(entity_type, entity_id)')

	await client.execute(`
		CREATE TABLE IF NOT EXISTS chunks (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			entity_type TEXT NOT NULL,
			entity_id TEXT NOT NULL,
			chunk_index INTEGER NOT NULL,
			content TEXT NOT NULL,
			content_hash TEXT NOT NULL,
			metadata TEXT DEFAULT '{}',
			indexed_at TEXT NOT NULL,
			embedding BLOB
		)
	`)
	await client.execute('CREATE INDEX IF NOT EXISTS idx_chunks_entity ON chunks(entity_type, entity_id)')
	await client.execute('CREATE INDEX IF NOT EXISTS idx_chunks_entity_chunk ON chunks(entity_type, entity_id, chunk_index)')
	await client.execute('CREATE INDEX IF NOT EXISTS idx_chunks_hash ON chunks(content_hash)')
}

// ─── FTS5 Initialization ───────────────────────────────────────────────────

/**
 * FTS5 virtual table + triggers for the search_index table.
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
	} catch (err) {
		console.warn('[db] search FTS5 init failed:', err instanceof Error ? err.message : String(err))
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
	} catch (err) {
		console.warn('[db] search FTS5 triggers failed:', err instanceof Error ? err.message : String(err))
	}
}

/**
 * FTS5 virtual table + triggers for the chunks table.
 */
async function initChunksFts(client: Client): Promise<void> {
	try {
		await client.execute(`
			CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
				content,
				content=chunks,
				content_rowid=id,
				tokenize='porter unicode61'
			)
		`)
	} catch (err) {
		console.warn('[db] chunks FTS5 init failed:', err instanceof Error ? err.message : String(err))
	}

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
	} catch (err) {
		console.warn('[db] chunks FTS5 triggers failed:', err instanceof Error ? err.message : String(err))
	}
}

// ─── Items Table Creation ──────────────────────────────────────────────────

async function createItemsTables(client: Client): Promise<void> {
	await client.execute(`
		CREATE TABLE IF NOT EXISTS items (
			path TEXT PRIMARY KEY,
			is_dir INTEGER NOT NULL,
			type TEXT,
			type_source TEXT,
			frontmatter TEXT,
			body_preview TEXT,
			size INTEGER,
			mtime TEXT NOT NULL,
			hash TEXT,
			parent_path TEXT,
			indexed_at TEXT NOT NULL
		)
	`)
	await client.execute('CREATE INDEX IF NOT EXISTS idx_items_type ON items(type)')
	await client.execute('CREATE INDEX IF NOT EXISTS idx_items_parent ON items(parent_path)')
	await client.execute('CREATE INDEX IF NOT EXISTS idx_items_type_parent ON items(type, parent_path)')
}

async function initItemsFts(client: Client): Promise<void> {
	try {
		await client.execute(`
			CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(
				path, frontmatter, body_preview,
				content=items,
				content_rowid=rowid,
				tokenize='porter unicode61'
			)
		`)
	} catch (err) {
		console.warn('[db] items FTS5 init failed:', err instanceof Error ? err.message : String(err))
	}

	try {
		await client.execute(`
			CREATE TRIGGER IF NOT EXISTS items_fts_ai AFTER INSERT ON items BEGIN
				INSERT INTO items_fts(rowid, path, frontmatter, body_preview) VALUES (new.rowid, new.path, new.frontmatter, new.body_preview);
			END
		`)
		await client.execute(`
			CREATE TRIGGER IF NOT EXISTS items_fts_ad AFTER DELETE ON items BEGIN
				INSERT INTO items_fts(items_fts, rowid, path, frontmatter, body_preview) VALUES('delete', old.rowid, old.path, old.frontmatter, old.body_preview);
			END
		`)
		await client.execute(`
			CREATE TRIGGER IF NOT EXISTS items_fts_au AFTER UPDATE ON items BEGIN
				INSERT INTO items_fts(items_fts, rowid, path, frontmatter, body_preview) VALUES('delete', old.rowid, old.path, old.frontmatter, old.body_preview);
				INSERT INTO items_fts(rowid, path, frontmatter, body_preview) VALUES (new.rowid, new.path, new.frontmatter, new.body_preview);
			END
		`)
	} catch (err) {
		console.warn('[db] items FTS5 triggers failed:', err instanceof Error ? err.message : String(err))
	}
}

export { companySchema, indexSchema }
