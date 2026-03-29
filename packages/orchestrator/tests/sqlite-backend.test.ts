import { describe, it, expect, afterEach } from 'bun:test'
import { rm } from 'node:fs/promises'
import { TaskSchema, MessageSchema } from '@questpie/autopilot-spec'
import { SqliteBackend } from '../src/fs/sqlite-backend'
import { createTestCompany } from './helpers'

describe('SqliteBackend', () => {
	let cleanup: () => Promise<void>
	let root: string
	let backend: SqliteBackend

	afterEach(async () => {
		if (backend) await backend.close()
		if (cleanup) await cleanup()
	})

	async function setup() {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup
		backend = new SqliteBackend(root)
		await backend.initialize()
	}

	const now = () => new Date().toISOString()

	function makeTask(overrides: Partial<Record<string, unknown>> = {}) {
		const timestamp = now()
		return TaskSchema.parse({
			id: overrides.id ?? `task-${Date.now().toString(36)}`,
			title: (overrides.title as string) ?? 'Test task',
			description: (overrides.description as string) ?? 'A test task',
			type: overrides.type ?? 'implementation',
			status: overrides.status ?? 'backlog',
			priority: overrides.priority ?? 'medium',
			created_by: (overrides.created_by as string) ?? 'planner',
			assigned_to: overrides.assigned_to as string | undefined,
			project: overrides.project as string | undefined,
			created_at: timestamp,
			updated_at: timestamp,
			history: [{ at: timestamp, by: 'planner', action: 'created' }],
		})
	}

	function makeMessage(overrides: Partial<Record<string, unknown>> = {}) {
		return MessageSchema.parse({
			id: overrides.id ?? `msg-${Date.now().toString(36)}`,
			from: (overrides.from as string) ?? 'planner',
			channel: overrides.channel as string | undefined,
			to: overrides.to as string | undefined,
			at: now(),
			content: (overrides.content as string) ?? 'Hello world',
		})
	}

	// ─── Tasks CRUD ─────────────────────────────────────────────────────

	describe('tasks', () => {
		it('should create and read a task', async () => {
			await setup()
			const task = makeTask({ id: 'task-cr1' })
			const created = await backend.createTask(task)

			expect(created.id).toBe('task-cr1')
			expect(created.title).toBe('Test task')

			const read = await backend.readTask('task-cr1')
			expect(read).not.toBeNull()
			expect(read!.id).toBe('task-cr1')
			expect(read!.title).toBe('Test task')
		})

		it('should return null for non-existent task', async () => {
			await setup()
			const read = await backend.readTask('task-nope')
			expect(read).toBeNull()
		})

		it('should update a task', async () => {
			await setup()
			const task = makeTask({ id: 'task-upd1' })
			await backend.createTask(task)

			const updated = await backend.updateTask('task-upd1', { title: 'Updated' }, 'developer')
			expect(updated.title).toBe('Updated')
			expect(updated.history.length).toBe(2)
			expect(updated.history[1]!.action).toBe('updated')
		})

		it('should throw when updating non-existent task', async () => {
			await setup()
			await expect(backend.updateTask('task-ghost', { title: 'x' }, 'dev')).rejects.toThrow('Task not found')
		})

		it('should move a task (status change)', async () => {
			await setup()
			const task = makeTask({ id: 'task-mv1', status: 'backlog' })
			await backend.createTask(task)

			const moved = await backend.moveTask('task-mv1', 'in_progress', 'developer')
			expect(moved.status).toBe('in_progress')
			expect(moved.started_at).toBeDefined()
		})

		it('should set completed_at when moving to done', async () => {
			await setup()
			const task = makeTask({ id: 'task-dn1', status: 'in_progress' })
			await backend.createTask(task)

			const moved = await backend.moveTask('task-dn1', 'done', 'reviewer')
			expect(moved.status).toBe('done')
			expect(moved.completed_at).toBeDefined()
		})

		it('should list all tasks', async () => {
			await setup()
			await backend.createTask(makeTask({ id: 'task-la1' }))
			await backend.createTask(makeTask({ id: 'task-la2' }))
			await backend.createTask(makeTask({ id: 'task-la3' }))

			const all = await backend.listTasks()
			expect(all.length).toBe(3)
		})

		it('should filter tasks by status', async () => {
			await setup()
			await backend.createTask(makeTask({ id: 'task-fs1', status: 'backlog' }))
			await backend.createTask(makeTask({ id: 'task-fs2', status: 'review' }))

			const backlog = await backend.listTasks({ status: 'backlog' })
			expect(backlog.length).toBe(1)
			expect(backlog[0]!.id).toBe('task-fs1')
		})

		it('should filter tasks by assigned_to', async () => {
			await setup()
			await backend.createTask(makeTask({ id: 'task-fa1', assigned_to: 'developer' }))
			await backend.createTask(makeTask({ id: 'task-fa2', assigned_to: 'reviewer' }))

			const devTasks = await backend.listTasks({ assigned_to: 'developer' })
			expect(devTasks.length).toBe(1)
			expect(devTasks[0]!.id).toBe('task-fa1')
		})

		it('should filter tasks by project', async () => {
			await setup()
			await backend.createTask(makeTask({ id: 'task-fp1', project: 'web' }))
			await backend.createTask(makeTask({ id: 'task-fp2', project: 'api' }))

			const webTasks = await backend.listTasks({ project: 'web' })
			expect(webTasks.length).toBe(1)
			expect(webTasks[0]!.id).toBe('task-fp1')
		})

		it('should count tasks', async () => {
			await setup()
			await backend.createTask(makeTask({ id: 'task-ct1', status: 'backlog' }))
			await backend.createTask(makeTask({ id: 'task-ct2', status: 'backlog' }))
			await backend.createTask(makeTask({ id: 'task-ct3', status: 'review' }))

			const total = await backend.countTasks()
			expect(total).toBe(3)

			const backlogCount = await backend.countTasks({ status: 'backlog' })
			expect(backlogCount).toBe(2)
		})

		it('should delete a task', async () => {
			await setup()
			await backend.createTask(makeTask({ id: 'task-del1' }))
			await backend.deleteTask('task-del1')
			const read = await backend.readTask('task-del1')
			expect(read).toBeNull()
		})
	})

	// ─── Messages CRUD ──────────────────────────────────────────────────

	describe('messages', () => {
		it('should send and read a channel message', async () => {
			await setup()
			const msg = makeMessage({ id: 'msg-ch1', channel: 'general', content: 'Hello channel' })
			await backend.sendMessage(msg)

			const msgs = await backend.readMessages({ channel: 'general' })
			expect(msgs.length).toBe(1)
			expect(msgs[0]!.content).toBe('Hello channel')
		})

		it('should send and read a direct message', async () => {
			await setup()
			const msg = makeMessage({ id: 'msg-dm1', from: 'planner', to: 'developer', content: 'Hey dev' })
			await backend.sendMessage(msg)

			const msgs = await backend.readMessages({ to_id: 'developer' })
			expect(msgs.length).toBe(1)
			expect(msgs[0]!.content).toBe('Hey dev')
		})

		it('should search messages with FTS', async () => {
			await setup()
			await backend.sendMessage(makeMessage({ id: 'msg-fts1', channel: 'dev', content: 'The deployment pipeline is broken' }))
			await backend.sendMessage(makeMessage({ id: 'msg-fts2', channel: 'dev', content: 'All tests are passing' }))
			await backend.sendMessage(makeMessage({ id: 'msg-fts3', channel: 'dev', content: 'Fix the broken pipeline ASAP' }))

			const results = await backend.searchMessages('broken pipeline')
			expect(results.length).toBeGreaterThanOrEqual(1)
			expect(results.some((m) => m.content.includes('broken'))).toBe(true)
		})

		it('should limit message results', async () => {
			await setup()
			for (let i = 0; i < 5; i++) {
				await backend.sendMessage(makeMessage({ id: `msg-lim${i}`, channel: 'general', content: `Message ${i}` }))
			}

			const limited = await backend.readMessages({ channel: 'general', limit: 3 })
			expect(limited.length).toBe(3)
		})
	})

	// ─── Activity ────────────────────────────────────────────────────────

	describe('activity', () => {
		it('should append and read activity', async () => {
			await setup()
			await backend.appendActivity({
				at: now(),
				agent: 'developer',
				type: 'task_completed',
				summary: 'Finished task X',
				details: { task_id: 'task-1' },
			})

			const entries = await backend.readActivity()
			expect(entries.length).toBe(1)
			expect(entries[0]!.agent).toBe('developer')
			expect(entries[0]!.summary).toBe('Finished task X')
			expect(entries[0]!.details).toEqual({ task_id: 'task-1' })
		})

		it('should filter activity by agent', async () => {
			await setup()
			await backend.appendActivity({ at: now(), agent: 'developer', type: 'x', summary: 'a' })
			await backend.appendActivity({ at: now(), agent: 'reviewer', type: 'x', summary: 'b' })

			const devActivity = await backend.readActivity({ agent: 'developer' })
			expect(devActivity.length).toBe(1)
			expect(devActivity[0]!.agent).toBe('developer')
		})

		it('should filter activity by type', async () => {
			await setup()
			await backend.appendActivity({ at: now(), agent: 'dev', type: 'task_completed', summary: 'a' })
			await backend.appendActivity({ at: now(), agent: 'dev', type: 'code_pushed', summary: 'b' })

			const completed = await backend.readActivity({ type: 'task_completed' })
			expect(completed.length).toBe(1)
			expect(completed[0]!.type).toBe('task_completed')
		})

		it('should limit activity results', async () => {
			await setup()
			for (let i = 0; i < 5; i++) {
				await backend.appendActivity({ at: now(), agent: 'dev', type: 'x', summary: `entry ${i}` })
			}

			const limited = await backend.readActivity({ limit: 3 })
			expect(limited.length).toBe(3)
		})
	})

	// ─── Channels ────────────────────────────────────────────────────────

	describe('channels', () => {
		it('should create and read a channel', async () => {
			await setup()
			const channel = await backend.createChannel({
				id: 'general', name: 'General', type: 'group',
				created_by: 'admin', created_at: now(), updated_at: now(), metadata: {},
			})
			expect(channel.id).toBe('general')

			const read = await backend.readChannel('general')
			expect(read).not.toBeNull()
			expect(read!.name).toBe('General')
		})

		it('should return null for non-existent channel', async () => {
			await setup()
			expect(await backend.readChannel('ghost')).toBeNull()
		})

		it('should list channels', async () => {
			await setup()
			await backend.createChannel({ id: 'c1', name: 'C1', type: 'group', created_by: 'admin', created_at: now(), updated_at: now(), metadata: {} })
			await backend.createChannel({ id: 'c2', name: 'C2', type: 'direct', created_by: 'admin', created_at: now(), updated_at: now(), metadata: {} })

			const all = await backend.listChannels()
			expect(all.length).toBe(2)
		})

		it('should delete a channel', async () => {
			await setup()
			await backend.createChannel({ id: 'del', name: 'Delete Me', type: 'group', created_by: 'admin', created_at: now(), updated_at: now(), metadata: {} })
			await backend.deleteChannel('del')
			expect(await backend.readChannel('del')).toBeNull()
		})
	})

	// ─── Channel Members ─────────────────────────────────────────────────

	describe('channel members', () => {
		it('should add and list members', async () => {
			await setup()
			await backend.createChannel({ id: 'ch', name: 'Ch', type: 'group', created_by: 'admin', created_at: now(), updated_at: now(), metadata: {} })
			await backend.addChannelMember('ch', 'dev', 'agent', 'member')
			await backend.addChannelMember('ch', 'ops', 'agent', 'member')

			const members = await backend.getChannelMembers('ch')
			expect(members.length).toBe(2)
			expect(members.map(m => m.actor_id).sort()).toEqual(['dev', 'ops'])
		})

		it('should remove a member', async () => {
			await setup()
			await backend.createChannel({ id: 'ch2', name: 'Ch2', type: 'group', created_by: 'admin', created_at: now(), updated_at: now(), metadata: {} })
			await backend.addChannelMember('ch2', 'dev', 'agent', 'member')
			await backend.removeChannelMember('ch2', 'dev')

			const members = await backend.getChannelMembers('ch2')
			expect(members.length).toBe(0)
		})

		it('should check membership', async () => {
			await setup()
			await backend.createChannel({ id: 'ch3', name: 'Ch3', type: 'group', created_by: 'admin', created_at: now(), updated_at: now(), metadata: {} })
			await backend.addChannelMember('ch3', 'dev', 'agent', 'member')

			expect(await backend.isChannelMember('ch3', 'dev')).toBe(true)
			expect(await backend.isChannelMember('ch3', 'stranger')).toBe(false)
		})
	})

	// ─── Direct Messages (DM) ────────────────────────────────────────────

	describe('DM channels', () => {
		it('getOrCreateDirectChannel creates new DM', async () => {
			await setup()
			const channel = await backend.getOrCreateDirectChannel('user-1', 'agent-dev')
			expect(channel.type).toBe('direct')
			expect(channel.id).toContain('--')
		})

		it('getOrCreateDirectChannel returns existing DM', async () => {
			await setup()
			const first = await backend.getOrCreateDirectChannel('user-1', 'agent-dev')
			const second = await backend.getOrCreateDirectChannel('user-1', 'agent-dev')
			expect(first.id).toBe(second.id)
		})

		it('getOrCreateDirectChannel is order-independent', async () => {
			await setup()
			const ab = await backend.getOrCreateDirectChannel('aaa', 'zzz')
			const ba = await backend.getOrCreateDirectChannel('zzz', 'aaa')
			expect(ab.id).toBe(ba.id) // sorted internally
		})

		it('DM channel has both members', async () => {
			await setup()
			const channel = await backend.getOrCreateDirectChannel('alice', 'bob')
			const members = await backend.getChannelMembers(channel.id)
			expect(members.length).toBe(2)
			expect(members.map(m => m.actor_id).sort()).toEqual(['alice', 'bob'])
		})
	})
})
