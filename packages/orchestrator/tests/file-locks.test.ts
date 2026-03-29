/**
 * File locks tests — acquireLock, releaseLock, getLockStatus, computeFileHash.
 * All functional with real in-memory libSQL DB.
 */
import { describe, it, expect, afterEach } from 'bun:test'
import { createDb } from '../src/db'
import type { AutopilotDb } from '../src/db'
import { acquireLock, releaseLock, getLockStatus, computeFileHash } from '../src/fs/file-locks'
import { createTestCompany } from './helpers'

describe('file-locks', () => {
	let cleanup: () => Promise<void>
	let db: AutopilotDb

	afterEach(async () => {
		if (cleanup) await cleanup()
	})

	async function setup() {
		const ctx = await createTestCompany()
		cleanup = ctx.cleanup
		const result = await createDb(ctx.root)
		db = result.db
	}

	// ── acquireLock ────────────────────────────────────────────────────

	it('acquires a lock on an unlocked path', async () => {
		await setup()
		const lock = await acquireLock(db, 'company.yaml', 'agent-dev')
		expect(lock).not.toBeNull()
		expect(lock!.path).toBe('company.yaml')
		expect(lock!.locked_by).toBe('agent-dev')
		expect(lock!.expires_at).toBeGreaterThan(Date.now())
	})

	it('blocks second actor from locking same path', async () => {
		await setup()
		await acquireLock(db, 'agents.yaml', 'agent-a')
		const blocked = await acquireLock(db, 'agents.yaml', 'agent-b')
		expect(blocked).toBeNull()
	})

	it('same actor can refresh their own lock', async () => {
		await setup()
		const first = await acquireLock(db, 'config.yaml', 'dev')
		expect(first).not.toBeNull()
		const refreshed = await acquireLock(db, 'config.yaml', 'dev')
		expect(refreshed).not.toBeNull()
		expect(refreshed!.locked_by).toBe('dev')
	})

	it('allows locking after expired lock is cleaned up', async () => {
		await setup()
		// Acquire with very short TTL
		await acquireLock(db, 'expired.yaml', 'old-agent', 1)
		// Wait for expiry
		await new Promise((r) => setTimeout(r, 10))
		// New actor should be able to acquire
		const lock = await acquireLock(db, 'expired.yaml', 'new-agent')
		expect(lock).not.toBeNull()
		expect(lock!.locked_by).toBe('new-agent')
	})

	it('different paths can be locked independently', async () => {
		await setup()
		const a = await acquireLock(db, 'file-a.yaml', 'agent-1')
		const b = await acquireLock(db, 'file-b.yaml', 'agent-2')
		expect(a).not.toBeNull()
		expect(b).not.toBeNull()
	})

	// ── releaseLock ────────────────────────────────────────────────────

	it('releases a lock held by the actor', async () => {
		await setup()
		await acquireLock(db, 'release.yaml', 'dev')
		const released = await releaseLock(db, 'release.yaml', 'dev')
		expect(released).toBe(true)

		// Should be unlocked now
		const status = await getLockStatus(db, 'release.yaml')
		expect(status).toBeNull()
	})

	it('refuses to release lock held by another actor', async () => {
		await setup()
		await acquireLock(db, 'owned.yaml', 'agent-a')
		const released = await releaseLock(db, 'owned.yaml', 'agent-b')
		expect(released).toBe(false)
	})

	it('force release (no actorId) always succeeds', async () => {
		await setup()
		await acquireLock(db, 'force.yaml', 'agent-x')
		const released = await releaseLock(db, 'force.yaml')
		expect(released).toBe(true)
	})

	it('release non-existent lock returns false for specific actor', async () => {
		await setup()
		const released = await releaseLock(db, 'ghost.yaml', 'nobody')
		expect(released).toBe(false)
	})

	// ── getLockStatus ──────────────────────────────────────────────────

	it('returns lock for active lock', async () => {
		await setup()
		await acquireLock(db, 'status.yaml', 'dev')
		const status = await getLockStatus(db, 'status.yaml')
		expect(status).not.toBeNull()
		expect(status!.locked_by).toBe('dev')
	})

	it('returns null for unlocked path', async () => {
		await setup()
		const status = await getLockStatus(db, 'unlocked.yaml')
		expect(status).toBeNull()
	})

	it('returns null and cleans up expired lock', async () => {
		await setup()
		await acquireLock(db, 'expiring.yaml', 'dev', 1) // 1ms TTL
		await new Promise((r) => setTimeout(r, 10))
		const status = await getLockStatus(db, 'expiring.yaml')
		expect(status).toBeNull()
	})

	// ── computeFileHash ────────────────────────────────────────────────

	it('produces consistent hash for same content', async () => {
		const h1 = await computeFileHash('hello world')
		const h2 = await computeFileHash('hello world')
		expect(h1).toBe(h2)
	})

	it('produces different hash for different content', async () => {
		const h1 = await computeFileHash('hello')
		const h2 = await computeFileHash('world')
		expect(h1).not.toBe(h2)
	})

	it('returns hex string', async () => {
		const hash = await computeFileHash('test')
		expect(hash).toMatch(/^[0-9a-f]+$/)
		expect(hash.length).toBe(64) // SHA-256 = 32 bytes = 64 hex chars
	})
})
