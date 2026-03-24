import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { Database } from 'bun:sqlite'
import { join } from 'node:path'
import { mkdir } from 'node:fs/promises'
import * as sqliteVec from 'sqlite-vec'
import * as schema from './schema'

export type AutopilotDb = ReturnType<typeof drizzle<typeof schema>>

export interface DbResult {
	db: AutopilotDb
	raw: Database
}

/**
 * Create a Drizzle-wrapped bun:sqlite database for the given company root.
 *
 * The DB file is stored at `<companyRoot>/.data/autopilot.db` with WAL mode
 * enabled for concurrent read performance.
 *
 * Loads sqlite-vec extension for vector search and runs Drizzle migrations
 * (including custom SQL for FTS5 / vec0 virtual tables).
 *
 * Returns both the Drizzle ORM instance and the raw bun:sqlite Database
 * so callers (e.g. Better Auth) can share the same underlying connection.
 */
export async function createDb(companyRoot: string): Promise<DbResult> {
	const dataDir = join(companyRoot, '.data')
	await mkdir(dataDir, { recursive: true })

	const dbPath = join(dataDir, 'autopilot.db')
	const sqlite = new Database(dbPath, { create: true })
	sqlite.exec('PRAGMA journal_mode = WAL')
	sqlite.exec('PRAGMA synchronous = NORMAL')
	sqlite.exec('PRAGMA foreign_keys = ON')
	sqlite.exec('PRAGMA busy_timeout = 5000')

	// Load sqlite-vec extension for vector similarity search (optional — may not be available)
	try {
		sqliteVec.load(sqlite)
	} catch {
		// Extension loading not supported in this SQLite build — vector search will be unavailable
	}

	const db = drizzle(sqlite, { schema })

	// Run drizzle migrations (regular tables)
	migrate(db, { migrationsFolder: join(__dirname, '..', '..', 'drizzle') })

	// Migrate: rename legacy "sessions" table → "agent_sessions" if it exists
	migrateSessionsTable(sqlite)

	// Create FTS5 virtual table + triggers for unified search index
	// (must be raw SQL — drizzle migrator cannot handle trigger semicolons)
	initSearchFts(sqlite)

	// Create vec0 virtual table (requires sqlite-vec extension)
	try {
		sqlite.exec(`
			CREATE VIRTUAL TABLE IF NOT EXISTS search_vec USING vec0(
				search_id INTEGER PRIMARY KEY,
				embedding float[768]
			)
		`)
	} catch {
		// sqlite-vec not available — vector search will be unavailable
	}

	// Cleanup expired rate limit entries on startup and every 5 minutes
	try { sqlite.exec(`DELETE FROM rate_limit_entries WHERE expires_at < unixepoch()`) } catch { /* table may not exist yet */ }
	setInterval(() => {
		try { sqlite.exec(`DELETE FROM rate_limit_entries WHERE expires_at < unixepoch()`) }
		catch { /* db closed */ }
	}, 5 * 60 * 1000)

	return { db, raw: sqlite }
}

/**
 * Rename the legacy "sessions" table to "agent_sessions" if it exists.
 * This is a one-time migration for databases created before the consolidation.
 */
function migrateSessionsTable(sqlite: Database): void {
	try {
		const exists = sqlite.prepare(
			"SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'"
		).all() as Array<{ name: string }>
		if (exists.length > 0) {
			sqlite.exec('ALTER TABLE sessions RENAME TO agent_sessions')
			// Recreate indexes with new names
			sqlite.exec('DROP INDEX IF EXISTS idx_sessions_agent')
			sqlite.exec('DROP INDEX IF EXISTS idx_sessions_task')
			sqlite.exec('DROP INDEX IF EXISTS idx_sessions_status')
			sqlite.exec('DROP INDEX IF EXISTS idx_sessions_started')
			sqlite.exec('CREATE INDEX IF NOT EXISTS idx_agent_sessions_agent ON agent_sessions(agent_id)')
			sqlite.exec('CREATE INDEX IF NOT EXISTS idx_agent_sessions_task ON agent_sessions(task_id)')
			sqlite.exec('CREATE INDEX IF NOT EXISTS idx_agent_sessions_status ON agent_sessions(status)')
			sqlite.exec('CREATE INDEX IF NOT EXISTS idx_agent_sessions_started ON agent_sessions(started_at)')
		}
	} catch {
		// Table doesn't exist or already renamed — safe to ignore
	}
}

/**
 * Initialize FTS5 virtual table and triggers for the unified search_index table.
 * Uses raw SQL because Drizzle ORM does not support virtual tables or triggers.
 */
function initSearchFts(sqlite: Database): void {
	try {
		sqlite.exec(`
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
		sqlite.exec(`
			CREATE TRIGGER IF NOT EXISTS search_fts_ai AFTER INSERT ON search_index BEGIN
				INSERT INTO search_fts(rowid, title, content) VALUES (new.id, new.title, new.content);
			END
		`)
		sqlite.exec(`
			CREATE TRIGGER IF NOT EXISTS search_fts_ad AFTER DELETE ON search_index BEGIN
				INSERT INTO search_fts(search_fts, rowid, title, content) VALUES('delete', old.id, old.title, old.content);
			END
		`)
		sqlite.exec(`
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
 * Initialize FTS5 virtual tables and triggers for message full-text search.
 * Uses raw SQL because Drizzle ORM does not support virtual tables.
 */
export function initFts(db: AutopilotDb): void {
	const raw = (db as unknown as { $client: Database }).$client

	try {
		raw.exec(`
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
		raw.exec(`
			CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
				INSERT INTO messages_fts(rowid, content) VALUES (new.rowid, new.content);
			END
		`)
		raw.exec(`
			CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
				INSERT INTO messages_fts(messages_fts, rowid, content) VALUES('delete', old.rowid, old.content);
			END
		`)
		raw.exec(`
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

export const dbFactory = container.registerAsync('db', async (c) => {
	const { companyRoot } = c.resolve([companyRootFactory])
	return createDb(companyRoot)
})
