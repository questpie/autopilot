import { existsSync } from 'node:fs'
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

	// FTS5 for messages full-text search
	await initMessagesFts(client)

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

	// Run drizzle migrations for index tables (if folder exists)
	const indexMigrationsDir = join(import.meta.dir, '..', '..', 'drizzle-index')
	if (existsSync(indexMigrationsDir)) {
		await migrate(db, { migrationsFolder: indexMigrationsDir })
	}

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
		console.warn('[db] vector index search_vec_idx unavailable (libSQL without vector support?):', (err as Error).message)
	}
	try {
		await client.execute(
			'CREATE INDEX IF NOT EXISTS chunks_vec_idx ON chunks (libsql_vector_idx(embedding))',
		)
	} catch (err) {
		console.warn('[db] vector index chunks_vec_idx unavailable (libSQL without vector support?):', (err as Error).message)
	}

	return { db, raw: client }
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
		console.warn('[db] search FTS5 init failed:', (err as Error).message)
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
		console.warn('[db] search FTS5 triggers failed:', (err as Error).message)
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
		console.warn('[db] chunks FTS5 init failed:', (err as Error).message)
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
		console.warn('[db] chunks FTS5 triggers failed:', (err as Error).message)
	}
}

/**
 * FTS5 virtual table + triggers for messages full-text search (company DB).
 */
async function initMessagesFts(client: Client): Promise<void> {
	try {
		await client.execute(`
			CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
				content,
				content=messages,
				content_rowid=rowid
			)
		`)
	} catch (err) {
		console.warn('[db] messages FTS5 init failed:', (err as Error).message)
	}

	try {
		await client.execute(`
			CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
				INSERT INTO messages_fts(rowid, content) VALUES (new.rowid, new.content);
			END
		`)
		await client.execute(`
			CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
				INSERT INTO messages_fts(messages_fts, rowid, content) VALUES('delete', old.rowid, old.content);
			END
		`)
		await client.execute(`
			CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE ON messages BEGIN
				INSERT INTO messages_fts(messages_fts, rowid, content) VALUES('delete', old.rowid, old.content);
				INSERT INTO messages_fts(rowid, content) VALUES (new.rowid, new.content);
			END
		`)
	} catch (err) {
		console.warn('[db] messages FTS5 triggers failed:', (err as Error).message)
	}
}

export { companySchema, indexSchema }
