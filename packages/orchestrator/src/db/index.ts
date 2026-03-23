import { drizzle } from 'drizzle-orm/bun-sqlite'
import { Database } from 'bun:sqlite'
import { join } from 'node:path'
import { mkdir } from 'node:fs/promises'
import * as schema from './schema'

export type AutopilotDb = ReturnType<typeof drizzle<typeof schema>>

/**
 * Create a Drizzle-wrapped bun:sqlite database for the given company root.
 *
 * The DB file is stored at `<companyRoot>/.data/autopilot.db` with WAL mode
 * enabled for concurrent read performance.
 */
export async function createDb(companyRoot: string): Promise<AutopilotDb> {
	const dataDir = join(companyRoot, '.data')
	await mkdir(dataDir, { recursive: true })

	const dbPath = join(dataDir, 'autopilot.db')
	const sqlite = new Database(dbPath, { create: true })
	sqlite.exec('PRAGMA journal_mode = WAL')
	sqlite.exec('PRAGMA synchronous = NORMAL')
	sqlite.exec('PRAGMA foreign_keys = ON')
	sqlite.exec('PRAGMA busy_timeout = 5000')

	return drizzle(sqlite, { schema })
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
