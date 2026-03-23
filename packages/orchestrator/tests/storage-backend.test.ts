import { describe, it, expect, afterEach } from 'bun:test'
import { TaskSchema, MessageSchema } from '@questpie/autopilot-spec'
import { SqliteBackend } from '../src/fs/sqlite-backend'
import { YamlFsBackend } from '../src/fs/yaml-backend'
import type { StorageBackend } from '../src/fs/storage'
import { createTestCompany } from './helpers'

/**
 * Shared contract tests for both StorageBackend implementations.
 * Verifies that both YAML and SQLite backends behave identically
 * for the core StorageBackend interface methods.
 */
function testBackend(name: string, createBackend: (root: string) => StorageBackend) {
	describe(`StorageBackend — ${name}`, () => {
		let cleanup: () => Promise<void>
		let root: string
		let backend: StorageBackend

		afterEach(async () => {
			if (backend) await backend.close()
			if (cleanup) await cleanup()
		})

		async function setup() {
			const ctx = await createTestCompany()
			root = ctx.root
			cleanup = ctx.cleanup
			backend = createBackend(root)
			await backend.initialize()
		}

		const now = () => new Date().toISOString()

		function makeTask(overrides: Partial<Record<string, unknown>> = {}) {
			const timestamp = now()
			return TaskSchema.parse({
				id: overrides.id ?? `task-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
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

		it('should create and read a task', async () => {
			await setup()
			const task = makeTask({ id: 'task-iface1' })
			await backend.createTask(task)

			const read = await backend.readTask('task-iface1')
			expect(read).not.toBeNull()
			expect(read!.id).toBe('task-iface1')
			expect(read!.title).toBe('Test task')
		})

		it('should return null for non-existent task', async () => {
			await setup()
			const read = await backend.readTask('task-nope')
			expect(read).toBeNull()
		})

		it('should list tasks', async () => {
			await setup()
			await backend.createTask(makeTask({ id: 'task-il1' }))
			await backend.createTask(makeTask({ id: 'task-il2' }))

			const all = await backend.listTasks()
			expect(all.length).toBe(2)
		})

		it('should filter tasks by status', async () => {
			await setup()
			await backend.createTask(makeTask({ id: 'task-ifs1', status: 'backlog' }))
			await backend.createTask(makeTask({ id: 'task-ifs2', status: 'review' }))

			const backlog = await backend.listTasks({ status: 'backlog' })
			expect(backlog.length).toBe(1)
			expect(backlog[0]!.status).toBe('backlog')
		})

		it('should append and read activity', async () => {
			await setup()
			await backend.appendActivity({
				at: now(),
				agent: 'developer',
				type: 'task_completed',
				summary: 'Done with task',
			})

			const entries = await backend.readActivity()
			expect(entries.length).toBe(1)
			expect(entries[0]!.agent).toBe('developer')
		})

		it('should send and read messages', async () => {
			await setup()
			const msg = MessageSchema.parse({
				id: 'msg-iface1',
				from: 'planner',
				channel: 'general',
				at: now(),
				content: 'Hello from interface test',
			})
			await backend.sendMessage(msg)

			const msgs = await backend.readMessages({ channel: 'general' })
			expect(msgs.length).toBe(1)
			expect(msgs[0]!.content).toBe('Hello from interface test')
		})
	})
}

// Run the same contract tests against both backends
testBackend('sqlite', (root) => new SqliteBackend(root))
testBackend('yaml', (root) => new YamlFsBackend(root))
