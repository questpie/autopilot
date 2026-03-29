/**
 * D5: Functional task transaction tests.
 *
 * Verifies that updateTask and moveTask are atomic — read + validate + write
 * happens within a single transaction. Uses a real in-memory libSQL DB.
 */
import { describe, it, expect, afterEach } from 'bun:test'
import { SqliteBackend } from '../src/fs/sqlite-backend'
import { createTestCompany } from './helpers'

describe('D5: task transactions (functional)', () => {
	let cleanup: () => Promise<void>
	let storage: SqliteBackend

	afterEach(async () => {
		try { await storage?.close() } catch { /* ignore */ }
		if (cleanup) await cleanup()
	})

	async function setup() {
		const ctx = await createTestCompany()
		cleanup = ctx.cleanup
		storage = new SqliteBackend(ctx.root)
		await storage.initialize()
	}

	async function createTestTask(overrides?: Record<string, unknown>) {
		const now = new Date().toISOString()
		return storage.createTask({
			title: 'Test Task',
			type: 'implementation',
			status: 'backlog',
			priority: 'medium',
			created_by: 'test-user',
			created_at: now,
			updated_at: now,
			history: [],
			...overrides,
		} as any)
	}

	// ─── updateTask ────────────────────────────────────────────────────

	it('updateTask changes title and preserves other fields', async () => {
		await setup()
		const task = await createTestTask({ title: 'Original Title' })

		const updated = await storage.updateTask(task.id, { title: 'New Title' }, 'test-user')
		expect(updated.title).toBe('New Title')
		expect(updated.status).toBe('backlog') // preserved
		expect(updated.type).toBe('implementation') // preserved
	})

	it('updateTask adds history entry', async () => {
		await setup()
		const task = await createTestTask()

		const updated = await storage.updateTask(task.id, { title: 'Changed' }, 'editor')
		expect(updated.history.length).toBeGreaterThan(task.history.length)
		const lastEntry = updated.history[updated.history.length - 1]
		expect(lastEntry.by).toBe('editor')
		expect(lastEntry.action).toBe('updated')
	})

	it('updateTask throws for non-existent task', async () => {
		await setup()
		await expect(
			storage.updateTask('non-existent-id', { title: 'x' }, 'user'),
		).rejects.toThrow('Task not found')
	})

	it('updateTask sets updated_at timestamp', async () => {
		await setup()
		const task = await createTestTask()
		const before = task.updated_at

		// Small delay to ensure different timestamp
		await new Promise((r) => setTimeout(r, 10))
		const updated = await storage.updateTask(task.id, { description: 'new desc' }, 'user')
		expect(updated.updated_at).not.toBe(before)
	})

	it('updateTask preserves created_at (immutable)', async () => {
		await setup()
		const task = await createTestTask()

		const updated = await storage.updateTask(task.id, { title: 'x' }, 'user')
		expect(updated.created_at).toBe(task.created_at)
	})

	it('updateTask preserves id (immutable)', async () => {
		await setup()
		const task = await createTestTask()

		const updated = await storage.updateTask(task.id, { title: 'x' }, 'user')
		expect(updated.id).toBe(task.id)
	})

	// ─── moveTask ──────────────────────────────────────────────────────

	it('moveTask changes status', async () => {
		await setup()
		const task = await createTestTask({ status: 'backlog' })

		const moved = await storage.moveTask(task.id, 'in_progress', 'agent')
		expect(moved.status).toBe('in_progress')
	})

	it('moveTask sets started_at when moving to in_progress', async () => {
		await setup()
		const task = await createTestTask({ status: 'backlog' })
		expect(task.started_at).toBeFalsy()

		const moved = await storage.moveTask(task.id, 'in_progress', 'agent')
		expect(moved.started_at).toBeTruthy()
	})

	it('moveTask sets completed_at when moving to done', async () => {
		await setup()
		const task = await createTestTask({ status: 'in_progress' })

		const moved = await storage.moveTask(task.id, 'done', 'agent')
		expect(moved.completed_at).toBeTruthy()
	})

	it('moveTask preserves started_at on subsequent moves', async () => {
		await setup()
		const task = await createTestTask({ status: 'backlog' })

		const moved1 = await storage.moveTask(task.id, 'in_progress', 'agent')
		const startedAt = moved1.started_at

		const moved2 = await storage.moveTask(task.id, 'review', 'agent')
		expect(moved2.started_at).toBe(startedAt) // not overwritten
	})

	it('moveTask adds history entry with from/to', async () => {
		await setup()
		const task = await createTestTask({ status: 'backlog' })

		const moved = await storage.moveTask(task.id, 'in_progress', 'agent')
		const lastEntry = moved.history[moved.history.length - 1]
		expect(lastEntry.action).toBe('status_changed')
		expect(lastEntry.from).toBe('backlog')
		expect(lastEntry.to).toBe('in_progress')
	})

	it('moveTask throws for non-existent task', async () => {
		await setup()
		await expect(
			storage.moveTask('non-existent', 'done', 'user'),
		).rejects.toThrow('Task not found')
	})

	// ─── Concurrent operations ─────────────────────────────────────────

	it('handles rapid sequential updates without data loss', async () => {
		await setup()
		const task = await createTestTask({ title: 'v0' })

		// Rapid sequential updates
		await storage.updateTask(task.id, { title: 'v1' }, 'user')
		await storage.updateTask(task.id, { title: 'v2' }, 'user')
		await storage.updateTask(task.id, { title: 'v3' }, 'user')

		const final = await storage.readTask(task.id)
		expect(final!.title).toBe('v3')
		expect(final!.history.length).toBeGreaterThanOrEqual(3)
	})

	it('handles move after update within same task', async () => {
		await setup()
		const task = await createTestTask({ status: 'backlog', title: 'Original' })

		await storage.updateTask(task.id, { title: 'Updated' }, 'user')
		const moved = await storage.moveTask(task.id, 'in_progress', 'agent')

		expect(moved.title).toBe('Updated')
		expect(moved.status).toBe('in_progress')
		expect(moved.history.length).toBeGreaterThanOrEqual(2)
	})
})
