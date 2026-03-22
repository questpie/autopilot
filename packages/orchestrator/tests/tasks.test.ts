import { describe, it, expect, afterEach } from 'bun:test'
import { createTask, readTask, updateTask, moveTask, listTasks, findTask } from '../src/fs/tasks'
import { createTestCompany } from './helpers'

describe('tasks', () => {
	let cleanup: () => Promise<void>
	let root: string

	afterEach(async () => {
		if (cleanup) await cleanup()
	})

	const baseTask = {
		title: 'Test task',
		description: 'A test task',
		type: 'implementation' as const,
		status: 'backlog' as const,
		priority: 'medium' as const,
		created_by: 'planner',
	}

	it('should create a task with generated ID', async () => {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup

		const task = await createTask(root, baseTask)

		expect(task.id).toMatch(/^task-/)
		expect(task.title).toBe('Test task')
		expect(task.status).toBe('backlog')
		expect(task.created_at).toBeDefined()
		expect(task.history).toHaveLength(1)
		expect(task.history[0]?.action).toBe('created')
	})

	it('should create a task with custom ID', async () => {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup

		const task = await createTask(root, { ...baseTask, id: 'task-custom' })
		expect(task.id).toBe('task-custom')
	})

	it('should read a task by ID', async () => {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup

		const created = await createTask(root, { ...baseTask, id: 'task-read' })
		const found = await readTask(root, 'task-read')

		expect(found).not.toBeNull()
		expect(found?.id).toBe('task-read')
		expect(found?.title).toBe(created.title)
	})

	it('should return null for non-existent task', async () => {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup

		const found = await readTask(root, 'task-nope')
		expect(found).toBeNull()
	})

	it('should find task location', async () => {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup

		await createTask(root, { ...baseTask, id: 'task-find', status: 'review' })
		const found = await findTask(root, 'task-find')

		expect(found).not.toBeNull()
		expect(found?.folder).toBe('review')
	})

	it('should update task fields', async () => {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup

		await createTask(root, { ...baseTask, id: 'task-upd' })
		const updated = await updateTask(root, 'task-upd', { title: 'Updated title' }, 'developer')

		expect(updated.title).toBe('Updated title')
		expect(updated.history).toHaveLength(2)
		expect(updated.history[1]?.action).toBe('updated')
		expect(updated.history[1]?.by).toBe('developer')
	})

	it('should throw when updating non-existent task', async () => {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup

		expect(updateTask(root, 'task-ghost', { title: 'x' }, 'dev')).rejects.toThrow('Task not found')
	})

	it('should move task between status folders', async () => {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup

		await createTask(root, { ...baseTask, id: 'task-move' })
		const moved = await moveTask(root, 'task-move', 'in_progress', 'developer')

		expect(moved.status).toBe('in_progress')
		expect(moved.started_at).toBeDefined()

		// Should now be in active folder
		const found = await findTask(root, 'task-move')
		expect(found?.folder).toBe('active')
	})

	it('should set completed_at when moving to done', async () => {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup

		await createTask(root, { ...baseTask, id: 'task-done', status: 'in_progress' })
		const moved = await moveTask(root, 'task-done', 'done', 'reviewer')

		expect(moved.status).toBe('done')
		expect(moved.completed_at).toBeDefined()
	})

	it('should list all tasks', async () => {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup

		await createTask(root, { ...baseTask, id: 'task-l1', status: 'backlog' })
		await createTask(root, { ...baseTask, id: 'task-l2', status: 'in_progress', assigned_to: 'developer' })
		await createTask(root, { ...baseTask, id: 'task-l3', status: 'review' })

		const all = await listTasks(root)
		expect(all).toHaveLength(3)
	})

	it('should filter tasks by status', async () => {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup

		await createTask(root, { ...baseTask, id: 'task-f1', status: 'backlog' })
		await createTask(root, { ...baseTask, id: 'task-f2', status: 'review' })

		const backlog = await listTasks(root, { status: 'backlog' })
		expect(backlog).toHaveLength(1)
		expect(backlog[0]?.id).toBe('task-f1')
	})

	it('should filter tasks by agent', async () => {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup

		await createTask(root, { ...baseTask, id: 'task-a1', assigned_to: 'developer' })
		await createTask(root, { ...baseTask, id: 'task-a2', assigned_to: 'reviewer' })

		const devTasks = await listTasks(root, { agent: 'developer' })
		expect(devTasks).toHaveLength(1)
		expect(devTasks[0]?.id).toBe('task-a1')
	})

	it('should filter tasks by project', async () => {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup

		await createTask(root, { ...baseTask, id: 'task-p1', project: 'web' })
		await createTask(root, { ...baseTask, id: 'task-p2', project: 'api' })

		const webTasks = await listTasks(root, { project: 'web' })
		expect(webTasks).toHaveLength(1)
		expect(webTasks[0]?.id).toBe('task-p1')
	})
})
