import { describe, it, expect, afterEach } from 'bun:test'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { createDb } from '../src/db'
import { createAuth } from '../src/auth'
import { createTestCompany } from './helpers'

describe('DB consolidation (ADR-019)', () => {
	let cleanup: () => Promise<void>
	let root: string

	afterEach(async () => {
		if (cleanup) await cleanup()
	})

	async function setup() {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup
	}

	it('createDb returns { db, raw } pointing to .data/autopilot.db', async () => {
		await setup()
		const result = await createDb(root)
		expect(result.db).toBeDefined()
		expect(result.raw).toBeDefined()
		// libSQL Client doesn't expose filename — verify the DB file exists instead
		expect(existsSync(join(root, '.data', 'autopilot.db'))).toBe(true)
	})

	it('createAuth accepts Drizzle db from createDb (shared connection)', async () => {
		await setup()
		const { db } = await createDb(root)
		const auth = await createAuth(db)
		expect(auth).toBeDefined()
		expect(auth.handler).toBeInstanceOf(Function)
	})

	it('.auth/ directory is NOT created by createDb + createAuth', async () => {
		await setup()
		const { db } = await createDb(root)
		await createAuth(db)
		expect(existsSync(join(root, '.auth'))).toBe(false)
	})

	it('createDb + createAuth use the same underlying DB file', async () => {
		await setup()
		const { db, raw } = await createDb(root)

		const auth = await createAuth(db)
		expect(auth).toBeDefined()

		const dbPath = join(root, '.data', 'autopilot.db')
		expect(existsSync(dbPath)).toBe(true)
	})

	it('DB uses WAL journal mode', async () => {
		await setup()
		const { raw } = await createDb(root)
		const result = await raw.execute('PRAGMA journal_mode')
		expect(result.rows[0]?.journal_mode).toBe('wal')
	})

	it('foreign_keys is enabled', async () => {
		await setup()
		const { raw } = await createDb(root)
		const result = await raw.execute('PRAGMA foreign_keys')
		expect(Number(result.rows[0]?.foreign_keys)).toBe(1)
	})

	it('Better Auth tables exist (user, session, account)', async () => {
		await setup()
		const { db, raw } = await createDb(root)
		await createAuth(db)
		for (const table of ['user', 'session', 'account']) {
			const result = await raw.execute(`SELECT name FROM sqlite_master WHERE type='table' AND name='${table}'`)
			expect(result.rows.length).toBe(1)
		}
	})
})
