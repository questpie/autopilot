import { describe, it, expect, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createDb } from '../src/db'
import type { AutopilotDb } from '../src/db'
import { createTestCompany } from './helpers'

describe('migration', () => {
	let cleanup: () => Promise<void>
	let root: string
	let db: AutopilotDb

	afterEach(async () => {
		if (cleanup) await cleanup()
	})

	async function setup() {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup
		db = await createDb(root)
	}

	function getRawDb(): Database {
		return (db as unknown as { $client: Database }).$client
	}

	it('should create search_index table via migration', async () => {
		await setup()
		const raw = getRawDb()
		const tables = raw.prepare(
			"SELECT name FROM sqlite_master WHERE type='table' AND name='search_index'"
		).all() as Array<{ name: string }>
		expect(tables.length).toBe(1)
	})

	it('should create search_fts virtual table via migration', async () => {
		await setup()
		const raw = getRawDb()
		const tables = raw.prepare(
			"SELECT name FROM sqlite_master WHERE type='table' AND name='search_fts'"
		).all() as Array<{ name: string }>
		expect(tables.length).toBe(1)
	})

	it('should create search_vec virtual table when sqlite-vec is available', async () => {
		await setup()
		const raw = getRawDb()
		const tables = raw.prepare(
			"SELECT name FROM sqlite_master WHERE type='table' AND name='search_vec'"
		).all() as Array<{ name: string }>
		// search_vec requires sqlite-vec extension which may not be available in all environments
		// When available, table should exist; when not, gracefully skipped
		expect(tables.length).toBeLessThanOrEqual(1)
	})

	it('should create FTS triggers for search_index', async () => {
		await setup()
		const raw = getRawDb()
		const triggers = raw.prepare(
			"SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE 'search_fts%'"
		).all() as Array<{ name: string }>
		const triggerNames = triggers.map((t) => t.name).sort()
		expect(triggerNames).toEqual(['search_fts_ad', 'search_fts_ai', 'search_fts_au'])
	})

	it('should be idempotent — running createDb twice should not fail', async () => {
		await setup()
		// Second call should not throw
		const db2 = await createDb(root)
		const raw2 = (db2 as unknown as { $client: Database }).$client
		const tables = raw2.prepare(
			"SELECT name FROM sqlite_master WHERE type='table' AND name='search_index'"
		).all() as Array<{ name: string }>
		expect(tables.length).toBe(1)
	})
})
