/**
 * Context snapshot tests — buildCompanySnapshot with real DB.
 *
 * Tests the snapshot builder that provides agents with awareness of
 * current tasks, messages, pins, and agent statuses.
 */
import { describe, it, expect, afterEach } from 'bun:test'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { stringify as stringifyYaml } from 'yaml'
import { SqliteBackend } from '../src/fs/sqlite-backend'
import { buildCompanySnapshot } from '../src/context/snapshot'
import { createTestCompany } from './helpers'

describe('buildCompanySnapshot', () => {
	let cleanup: () => Promise<void>
	let storage: SqliteBackend
	let root: string

	afterEach(async () => {
		try { await storage?.close() } catch {}
		if (cleanup) await cleanup()
	})

	async function setup() {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup
		storage = new SqliteBackend(root)
		await storage.initialize()

		// Write agents.yaml
		await writeFile(
			join(root, 'team', 'agents.yaml'),
			stringifyYaml({
				agents: [
					{ id: 'dev', name: 'Developer', role: 'developer', description: 'Writes code', model: 'claude', fs_scope: { read: ['**'], write: ['**'] } },
					{ id: 'ops', name: 'DevOps', role: 'devops', description: 'Manages infra', model: 'claude', fs_scope: { read: ['**'], write: ['**'] } },
				],
			}),
		)
	}

	const testAgent = {
		id: 'dev',
		name: 'Developer',
		role: 'developer',
		description: 'Writes code',
		model: 'claude',
		tools: [],
		fs_scope: { read: ['**'], write: ['**'] },
	}

	it('returns a snapshot with empty data', async () => {
		await setup()
		const snap = await buildCompanySnapshot(root, testAgent as any, storage)

		expect(snap).toHaveProperty('activeTasks')
		expect(snap).toHaveProperty('recentMessages')
		expect(snap).toHaveProperty('dashboardPins')
		expect(snap).toHaveProperty('agentStatuses')
		expect(Array.isArray(snap.activeTasks)).toBe(true)
	})

	it('includes active tasks (not done/cancelled)', async () => {
		await setup()
		const now = new Date().toISOString()

		await storage.createTask({
			id: 'task-active-1',
			title: 'Active task',
			type: 'implementation',
			status: 'in_progress',
			priority: 'high',
			created_by: 'user',
			created_at: now,
			updated_at: now,
			history: [],
		} as any)

		await storage.createTask({
			id: 'task-done-1',
			title: 'Done task',
			type: 'implementation',
			status: 'done',
			priority: 'medium',
			created_by: 'user',
			created_at: now,
			updated_at: now,
			history: [],
		} as any)

		const snap = await buildCompanySnapshot(root, testAgent as any, storage)

		expect(snap.activeTasks.length).toBe(1)
		expect(snap.activeTasks[0]!.title).toBe('Active task')
		expect(snap.activeTasks[0]!.status).toBe('in_progress')
	})

	it('includes agent statuses from agents.yaml', async () => {
		await setup()
		const snap = await buildCompanySnapshot(root, testAgent as any, storage)

		expect(snap.agentStatuses.length).toBeGreaterThanOrEqual(2)
		const dev = snap.agentStatuses.find((a) => a.id === 'dev')
		expect(dev).toBeDefined()
		expect(dev!.name).toBe('Developer')
		expect(dev!.role).toBe('developer')
	})

	it('returns empty dashboardPins when no pins exist', async () => {
		await setup()
		const snap = await buildCompanySnapshot(root, testAgent as any, storage)
		expect(Array.isArray(snap.dashboardPins)).toBe(true)
		// No pins dir and no DB pins → empty array
		expect(snap.dashboardPins.length).toBe(0)
	})

	it('handles missing agents.yaml gracefully', async () => {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup
		storage = new SqliteBackend(root)
		await storage.initialize()

		const snap = await buildCompanySnapshot(root, testAgent as any, storage)
		expect(Array.isArray(snap.agentStatuses)).toBe(true)
	})

	it('excludes cancelled tasks', async () => {
		await setup()
		const now = new Date().toISOString()

		await storage.createTask({
			id: 'task-cancelled',
			title: 'Cancelled task',
			type: 'implementation',
			status: 'cancelled',
			priority: 'low',
			created_by: 'user',
			created_at: now,
			updated_at: now,
			history: [],
		} as any)

		const snap = await buildCompanySnapshot(root, testAgent as any, storage)
		expect(snap.activeTasks.length).toBe(0)
	})

	it('includes multiple active statuses (backlog, in_progress, review, blocked)', async () => {
		await setup()
		const now = new Date().toISOString()

		for (const [i, status] of ['backlog', 'in_progress', 'review', 'blocked'].entries()) {
			await storage.createTask({
				id: `task-${status}-${i}`,
				title: `${status} task`,
				type: 'implementation',
				status,
				priority: 'medium',
				created_by: 'user',
				created_at: now,
				updated_at: now,
				history: [],
			} as any)
		}

		const snap = await buildCompanySnapshot(root, testAgent as any, storage)
		expect(snap.activeTasks.length).toBe(4)
	})

	it('task entries include id, title, status, assigned_to', async () => {
		await setup()
		const now = new Date().toISOString()

		await storage.createTask({
			id: 'task-shape',
			title: 'Shape test',
			type: 'implementation',
			status: 'in_progress',
			priority: 'high',
			created_by: 'user',
			assigned_to: 'dev',
			created_at: now,
			updated_at: now,
			history: [],
		} as any)

		const snap = await buildCompanySnapshot(root, testAgent as any, storage)
		const task = snap.activeTasks[0]!
		expect(task.id).toBe('task-shape')
		expect(task.title).toBe('Shape test')
		expect(task.status).toBe('in_progress')
		expect(task.assigned_to).toBe('dev')
	})

	it('agentStatuses includes role and name for each agent', async () => {
		await setup()
		const snap = await buildCompanySnapshot(root, testAgent as any, storage)

		for (const a of snap.agentStatuses) {
			expect(a).toHaveProperty('id')
			expect(a).toHaveProperty('name')
			expect(a).toHaveProperty('role')
			expect(a).toHaveProperty('status')
		}
	})
})
