import { describe, it, expect, afterEach } from 'bun:test'
import type { Client } from '@libsql/client'
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
		const result = await createDb(root)
		db = result.db
	}

	function getRawClient(): Client {
		return (db as unknown as { $client: Client }).$client
	}

	it('should create search_index table via migration', async () => {
		await setup()
		const raw = getRawClient()
		const result = await raw.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='search_index'")
		expect(result.rows.length).toBe(1)
	})

	it('should create search_fts virtual table via migration', async () => {
		await setup()
		const raw = getRawClient()
		const result = await raw.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='search_fts'")
		expect(result.rows.length).toBe(1)
	})

	it('should create chunks table via migration', async () => {
		await setup()
		const raw = getRawClient()
		const result = await raw.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='chunks'")
		expect(result.rows.length).toBe(1)
	})

	it('should create FTS triggers for search_index', async () => {
		await setup()
		const raw = getRawClient()
		const result = await raw.execute("SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE 'search_fts%'")
		const triggerNames = result.rows.map((t) => t.name as string).sort()
		expect(triggerNames).toEqual(['search_fts_ad', 'search_fts_ai', 'search_fts_au'])
	})

	it('should be idempotent — running createDb twice should not fail', async () => {
		await setup()
		// Second call should not throw
		const { db: db2 } = await createDb(root)
		const raw2 = (db2 as unknown as { $client: Client }).$client
		const result = await raw2.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='search_index'")
		expect(result.rows.length).toBe(1)
	})
})
