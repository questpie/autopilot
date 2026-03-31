import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { type Client, createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { getEnv } from '../env'
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
export async function createDb(
	companyRoot: string,
	_opts?: { embeddingDimensions?: number },
): Promise<DbResult> {
	const env = getEnv()
	const dataDir = join(companyRoot, '.data')
	await mkdir(dataDir, { recursive: true })

	const dbPath = join(dataDir, 'autopilot.db')
	const client = createClient({
		url: env.DATABASE_URL ?? `file:${dbPath}`,
		syncUrl: env.TURSO_SYNC_URL,
		authToken: env.TURSO_AUTH_TOKEN,
	})

	await client.execute('PRAGMA journal_mode = WAL')
	await client.execute('PRAGMA synchronous = NORMAL')
	await client.execute('PRAGMA foreign_keys = ON')
	await client.execute('PRAGMA busy_timeout = 5000')

	const db = drizzle(client, { schema })

	// Run drizzle migrations (regular tables)
	await migrate(db, { migrationsFolder: join(__dirname, '..', '..', 'drizzle') })

	// Create FTS5 virtual table + triggers for unified search index
	// (must be raw SQL — drizzle migrator cannot handle trigger semicolons)
	await initSearchFts(client)

	// libSQL native vector indexes (DiskANN) — F32_BLOB columns added via migration 0007
	// Indexes created here because drizzle cannot manage libsql_vector_idx
	try {
		await client.execute(
			'CREATE INDEX IF NOT EXISTS search_vec_idx ON search_index (libsql_vector_idx(embedding))',
		)
	} catch {
		/* index exists or libSQL version without vector support */
	}
	try {
		await client.execute(
			'CREATE INDEX IF NOT EXISTS chunks_vec_idx ON chunks (libsql_vector_idx(embedding))',
		)
	} catch {
		/* index exists or libSQL version without vector support */
	}

	// D25: FTS5 virtual tables for chunks
	await initChunksFts(client)

	// Cleanup expired rate limit entries on startup and every 5 minutes
	try {
		await client.execute('DELETE FROM rate_limit_entries WHERE expires_at < unixepoch()')
	} catch {
		/* table may not exist yet */
	}
	setInterval(
		() => {
			client.execute('DELETE FROM rate_limit_entries WHERE expires_at < unixepoch()').catch(() => {
				/* db closed */
			})
		},
		5 * 60 * 1000,
	)

	// Cleanup expired file locks on startup and every minute
	const nowMs = Date.now()
	try {
		await client.execute(`DELETE FROM file_locks WHERE expires_at < ${nowMs}`)
	} catch {
		/* table may not exist yet */
	}
	setInterval(() => {
		client.execute(`DELETE FROM file_locks WHERE expires_at < ${Date.now()}`).catch(() => {
			/* db closed */
		})
	}, 60 * 1000)

	// Cleanup expired pins on startup and every 5 minutes
	try {
		await client.execute(`DELETE FROM pins WHERE expires_at IS NOT NULL AND expires_at < ${nowMs}`)
	} catch {
		/* table may not exist yet */
	}
	setInterval(
		() => {
			client
				.execute(`DELETE FROM pins WHERE expires_at IS NOT NULL AND expires_at < ${Date.now()}`)
				.catch(() => {
					/* db closed */
				})
		},
		5 * 60 * 1000,
	)

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
 * Vector indexes are created in createDb() via libsql_vector_idx.
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
	} catch {
		/* already exists */
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
	} catch {
		/* triggers exist */
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

import { companyRootFactory, container } from '../container'
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
