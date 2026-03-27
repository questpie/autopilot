/**
 * File lock management — advisory locks stored in SQLite.
 *
 * Locks expire after a configurable TTL (default 60 seconds).
 * Used for critical config files to prevent concurrent edits.
 */
import { eq, and, gt } from 'drizzle-orm'
import type { AutopilotDb } from '../db'
import { fileLocks } from '../db/schema'

const DEFAULT_LOCK_TTL_MS = 60_000 // 60 seconds

export interface FileLock {
	path: string
	locked_by: string
	locked_at: number
	expires_at: number
}

/**
 * Attempt to acquire a lock on a file path.
 * Returns the lock if acquired, or null if already locked by another actor.
 */
export async function acquireLock(
	db: AutopilotDb,
	path: string,
	lockedBy: string,
	ttlMs: number = DEFAULT_LOCK_TTL_MS,
): Promise<FileLock | null> {
	const now = Date.now()

	// Clean up expired locks first
	await db.delete(fileLocks).where(
		and(eq(fileLocks.path, path), gt(fileLocks.expires_at, 0)),
	).execute()

	// Check for existing non-expired lock
	const existing = await db
		.select()
		.from(fileLocks)
		.where(eq(fileLocks.path, path))
		.limit(1)
		.execute()

	if (existing.length > 0) {
		const lock = existing[0]!
		// Expired — remove it
		if (lock.expires_at < now) {
			await db.delete(fileLocks).where(eq(fileLocks.path, path)).execute()
		} else if (lock.locked_by !== lockedBy) {
			// Locked by someone else and not expired
			return null
		} else {
			// Same actor — refresh the lock
			const newExpiry = now + ttlMs
			await db
				.update(fileLocks)
				.set({ locked_at: now, expires_at: newExpiry })
				.where(eq(fileLocks.path, path))
				.execute()
			return { path, locked_by: lockedBy, locked_at: now, expires_at: newExpiry }
		}
	}

	// Acquire new lock
	const expiresAt = now + ttlMs
	const lock: FileLock = {
		path,
		locked_by: lockedBy,
		locked_at: now,
		expires_at: expiresAt,
	}

	await db.insert(fileLocks).values(lock).execute()
	return lock
}

/**
 * Release a lock on a file path.
 * Only the holder can release (unless force=true).
 */
export async function releaseLock(
	db: AutopilotDb,
	path: string,
	actorId?: string,
): Promise<boolean> {
	if (actorId) {
		// Check if lock exists and is owned by this actor before deleting
		const existing = await db
			.select()
			.from(fileLocks)
			.where(and(eq(fileLocks.path, path), eq(fileLocks.locked_by, actorId)))
			.limit(1)
			.execute()
		if (existing.length === 0) return false
		await db
			.delete(fileLocks)
			.where(and(eq(fileLocks.path, path), eq(fileLocks.locked_by, actorId)))
			.execute()
		return true
	}
	await db.delete(fileLocks).where(eq(fileLocks.path, path)).execute()
	return true
}

/**
 * Get the current lock status for a file path.
 * Returns the lock if active, or null if not locked / expired.
 */
export async function getLockStatus(
	db: AutopilotDb,
	path: string,
): Promise<FileLock | null> {
	const now = Date.now()
	const existing = await db
		.select()
		.from(fileLocks)
		.where(eq(fileLocks.path, path))
		.limit(1)
		.execute()

	if (existing.length === 0) return null

	const lock = existing[0]!
	if (lock.expires_at < now) {
		// Expired — clean up
		await db.delete(fileLocks).where(eq(fileLocks.path, path)).execute()
		return null
	}

	return lock
}

/**
 * Compute SHA-256 hash of a string (for If-Match optimistic locking).
 */
export async function computeFileHash(content: string): Promise<string> {
	const encoder = new TextEncoder()
	const data = encoder.encode(content)
	const hashBuffer = await crypto.subtle.digest('SHA-256', data)
	const hashArray = Array.from(new Uint8Array(hashBuffer))
	return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}
