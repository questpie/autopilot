import { describe, it, expect, afterEach } from 'bun:test'
import { createTask, readTask, updateTask, moveTask, listTasks, findTask } from '../src/fs/tasks'
import { createTestCompany } from './helpers'

describe('tasks edge cases', () => {
	let cleanup: () => Promise<void>
	let root: string

	afterEach(async () => {
		if (cleanup) await cleanup()
	})

	describe('create task with all optional fields populated', () => {
		it('creates a task with every field set', async () => {
			const ctx = await createTestCompany()
			root = ctx.root
			cleanup = ctx.cleanup

			const task = await createTask(root, {
				id: 'task-001',
				title: 'Full featured task',
				description: 'A task with all fields populated',
				type: 'implementation',
				status: 'in_progress',
				priority: 'critical',
				created_by: 'peter',
				assigned_to: 'peter',
				project: 'web-app',
				parent: 'task-parent',
				depends_on: ['task-dep-1', 'task-dep-2'],
				blocks: ['task-block-1'],
				related: ['task-related-1'],
				reviewers: ['maria', 'jan'],
				approver: 'ceo',
				workflow: 'development',
				workflow_step: 'implement',
				context: { branch: 'feat/login', pr: '42' },
				blockers: [
					{
						type: 'human_required',
						reason: 'Need API key',
						assigned_to: 'ceo',
						resolved: false,
					},
				],
				deadline: '2026-06-01T00:00:00Z',
				metadata: { linear_id: 'LIN-123', github_pr: 'https://github.com/org/repo/pull/42' },
			})

			expect(task.id).toBe('task-001')
			expect(task.title).toBe('Full featured task')
			expect(task.description).toBe('A task with all fields populated')
			expect(task.type).toBe('implementation')
			expect(task.status).toBe('in_progress')
			expect(task.priority).toBe('critical')
			expect(task.created_by).toBe('peter')
			expect(task.assigned_to).toBe('peter')
			expect(task.project).toBe('web-app')
			expect(task.parent).toBe('task-parent')
			expect(task.depends_on).toEqual(['task-dep-1', 'task-dep-2'])
			expect(task.blocks).toEqual(['task-block-1'])
			expect(task.related).toEqual(['task-related-1'])
			expect(task.reviewers).toEqual(['maria', 'jan'])
			expect(task.approver).toBe('ceo')
			expect(task.workflow).toBe('development')
			expect(task.workflow_step).toBe('implement')
			expect(task.context).toEqual({ branch: 'feat/login', pr: '42' })
			expect(task.blockers).toHaveLength(1)
			expect(task.blockers[0]?.reason).toBe('Need API key')
			expect(task.deadline).toBe('2026-06-01T00:00:00Z')
			expect(task.metadata).toEqual({ linear_id: 'LIN-123', github_pr: 'https://github.com/org/repo/pull/42' })
		})
	})

	describe('metadata field — save and read JSON', () => {
		it('persists arbitrary metadata through create and read', async () => {
			const ctx = await createTestCompany()
			root = ctx.root
			cleanup = ctx.cleanup

			const task = await createTask(root, {
				id: 'task-meta',
				title: 'Metadata test',
				type: 'implementation',
				status: 'backlog',
				priority: 'medium',
				created_by: 'peter',
				metadata: {
					linear_id: 'LIN-456',
					github_pr: 'https://github.com/org/repo/pull/99',
					custom_flag: true,
					nested: { key: 'value' },
				},
			})

			expect(task.metadata).toEqual({
				linear_id: 'LIN-456',
				github_pr: 'https://github.com/org/repo/pull/99',
				custom_flag: true,
				nested: { key: 'value' },
			})

			// Read back from disk
			const read = await readTask(root, 'task-meta')
			expect(read).not.toBeNull()
			expect(read?.metadata).toEqual({
				linear_id: 'LIN-456',
				github_pr: 'https://github.com/org/repo/pull/99',
				custom_flag: true,
				nested: { key: 'value' },
			})
		})

		it('defaults metadata to empty object when omitted', async () => {
			const ctx = await createTestCompany()
			root = ctx.root
			cleanup = ctx.cleanup

			const task = await createTask(root, {
				id: 'task-no-meta',
				title: 'No metadata',
				type: 'implementation',
				status: 'backlog',
				priority: 'medium',
				created_by: 'peter',
			})

			expect(task.metadata).toEqual({})
		})
	})

	describe('update task adds history entry with correct timestamp', () => {
		it('adds a history entry with updated_at timestamp', async () => {
			const ctx = await createTestCompany()
			root = ctx.root
			cleanup = ctx.cleanup

			const created = await createTask(root, {
				id: 'task-001',
				title: 'Original title',
				type: 'implementation',
				status: 'backlog',
				priority: 'medium',
				created_by: 'peter',
			})

			const beforeUpdate = new Date().toISOString()
			const updated = await updateTask(root, 'task-001', { title: 'Updated title' }, 'peter')

			expect(updated.title).toBe('Updated title')
			expect(updated.history).toHaveLength(2)

			const lastEntry = updated.history[1]!
			expect(lastEntry.action).toBe('updated')
			expect(lastEntry.by).toBe('peter')
			expect(lastEntry.at).toBeDefined()
			// updated_at should be recent
			expect(updated.updated_at >= beforeUpdate).toBe(true)
			// created_at should be preserved
			expect(updated.created_at).toBe(created.created_at)
		})
	})

	describe('move task from active → review → done', () => {
		it('moves through multiple statuses correctly', async () => {
			const ctx = await createTestCompany()
			root = ctx.root
			cleanup = ctx.cleanup

			await createTask(root, {
				id: 'task-001',
				title: 'Move test',
				type: 'implementation',
				status: 'in_progress',
				priority: 'medium',
				created_by: 'peter',
			})

			// active → review
			const reviewTask = await moveTask(root, 'task-001', 'review', 'peter')
			expect(reviewTask.status).toBe('review')

			const reviewLocation = await findTask(root, 'task-001')
			expect(reviewLocation?.folder).toBe('review')

			// review → done
			const doneTask = await moveTask(root, 'task-001', 'done', 'maria')
			expect(doneTask.status).toBe('done')
			expect(doneTask.completed_at).toBeDefined()

			const doneLocation = await findTask(root, 'task-001')
			expect(doneLocation?.folder).toBe('done')

			// History should have: created, status_changed (review), status_changed (done)
			expect(doneTask.history).toHaveLength(3)
			expect(doneTask.history[1]?.action).toBe('status_changed')
			expect(doneTask.history[2]?.action).toBe('status_changed')
		})
	})

	describe('list tasks filters by status correctly', () => {
		it('only returns tasks matching the requested status', async () => {
			const ctx = await createTestCompany()
			root = ctx.root
			cleanup = ctx.cleanup

			await createTask(root, { id: 'task-001', title: 'Backlog 1', type: 'implementation', status: 'backlog', priority: 'medium', created_by: 'peter' })
			await createTask(root, { id: 'task-002', title: 'Backlog 2', type: 'implementation', status: 'backlog', priority: 'high', created_by: 'peter' })
			await createTask(root, { id: 'task-003', title: 'Active 1', type: 'implementation', status: 'in_progress', priority: 'medium', created_by: 'peter' })
			await createTask(root, { id: 'task-004', title: 'Review 1', type: 'review', status: 'review', priority: 'low', created_by: 'maria' })

			const backlogTasks = await listTasks(root, { status: 'backlog' })
			expect(backlogTasks).toHaveLength(2)
			expect(backlogTasks.map((t) => t.id).sort()).toEqual(['task-001', 'task-002'])

			const activeTasks = await listTasks(root, { status: 'in_progress' })
			expect(activeTasks).toHaveLength(1)
			expect(activeTasks[0]?.id).toBe('task-003')

			const reviewTasks = await listTasks(root, { status: 'review' })
			expect(reviewTasks).toHaveLength(1)
			expect(reviewTasks[0]?.id).toBe('task-004')

			const doneTasks = await listTasks(root, { status: 'done' })
			expect(doneTasks).toHaveLength(0)
		})
	})

	describe('list tasks filters by assigned_to correctly', () => {
		it('only returns tasks assigned to the requested agent', async () => {
			const ctx = await createTestCompany()
			root = ctx.root
			cleanup = ctx.cleanup

			await createTask(root, { id: 'task-001', title: 'Peter task', type: 'implementation', status: 'backlog', priority: 'medium', created_by: 'peter', assigned_to: 'peter' })
			await createTask(root, { id: 'task-002', title: 'Maria task', type: 'review', status: 'backlog', priority: 'medium', created_by: 'peter', assigned_to: 'maria' })
			await createTask(root, { id: 'task-003', title: 'Unassigned', type: 'implementation', status: 'backlog', priority: 'medium', created_by: 'peter' })

			const peterTasks = await listTasks(root, { agent: 'peter' })
			expect(peterTasks).toHaveLength(1)
			expect(peterTasks[0]?.id).toBe('task-001')

			const mariaTasks = await listTasks(root, { agent: 'maria' })
			expect(mariaTasks).toHaveLength(1)
			expect(mariaTasks[0]?.id).toBe('task-002')

			const janTasks = await listTasks(root, { agent: 'jan' })
			expect(janTasks).toHaveLength(0)
		})
	})

	describe('find task across all status folders', () => {
		it('finds tasks regardless of which folder they are in', async () => {
			const ctx = await createTestCompany()
			root = ctx.root
			cleanup = ctx.cleanup

			await createTask(root, { id: 'task-backlog', title: 'Backlog', type: 'implementation', status: 'backlog', priority: 'medium', created_by: 'peter' })
			await createTask(root, { id: 'task-active', title: 'Active', type: 'implementation', status: 'in_progress', priority: 'medium', created_by: 'peter' })
			await createTask(root, { id: 'task-review', title: 'Review', type: 'review', status: 'review', priority: 'medium', created_by: 'peter' })
			await createTask(root, { id: 'task-blocked', title: 'Blocked', type: 'implementation', status: 'blocked', priority: 'medium', created_by: 'peter' })
			await createTask(root, { id: 'task-done', title: 'Done', type: 'implementation', status: 'done', priority: 'medium', created_by: 'peter' })

			const found1 = await findTask(root, 'task-backlog')
			expect(found1).not.toBeNull()
			expect(found1?.folder).toBe('backlog')

			const found2 = await findTask(root, 'task-active')
			expect(found2).not.toBeNull()
			expect(found2?.folder).toBe('active')

			const found3 = await findTask(root, 'task-review')
			expect(found3).not.toBeNull()
			expect(found3?.folder).toBe('review')

			const found4 = await findTask(root, 'task-blocked')
			expect(found4).not.toBeNull()
			expect(found4?.folder).toBe('blocked')

			const found5 = await findTask(root, 'task-done')
			expect(found5).not.toBeNull()
			expect(found5?.folder).toBe('done')

			const notFound = await findTask(root, 'task-ghost')
			expect(notFound).toBeNull()
		})
	})

	describe('task with blockers', () => {
		it('creates a task with blockers and verifies they persist', async () => {
			const ctx = await createTestCompany()
			root = ctx.root
			cleanup = ctx.cleanup

			const task = await createTask(root, {
				id: 'task-001',
				title: 'Blocked task',
				type: 'implementation',
				status: 'blocked',
				priority: 'high',
				created_by: 'peter',
				blockers: [
					{
						type: 'human_required',
						reason: 'Need production database credentials',
						assigned_to: 'ceo',
						resolved: false,
					},
					{
						type: 'human_required',
						reason: 'Need API docs',
						assigned_to: 'maria',
						resolved: false,
					},
				],
			})

			expect(task.blockers).toHaveLength(2)
			expect(task.blockers[0]?.resolved).toBe(false)
			expect(task.blockers[1]?.reason).toBe('Need API docs')

			// Read back from disk
			const read = await readTask(root, 'task-001')
			expect(read).not.toBeNull()
			expect(read?.blockers).toHaveLength(2)
		})
	})

	describe('update non-existent task throws', () => {
		it('throws Task not found error', async () => {
			const ctx = await createTestCompany()
			root = ctx.root
			cleanup = ctx.cleanup

			await expect(
				updateTask(root, 'task-ghost', { title: 'Nope' }, 'peter')
			).rejects.toThrow('Task not found')
		})
	})

	describe('move non-existent task throws', () => {
		it('throws Task not found error', async () => {
			const ctx = await createTestCompany()
			root = ctx.root
			cleanup = ctx.cleanup

			await expect(
				moveTask(root, 'task-ghost', 'done', 'peter')
			).rejects.toThrow('Task not found')
		})
	})

	describe('create two tasks quickly — IDs should be unique', () => {
		it('generates unique IDs when created sequentially', async () => {
			const ctx = await createTestCompany()
			root = ctx.root
			cleanup = ctx.cleanup

			const task1 = await createTask(root, {
				title: 'Task A',
				type: 'implementation',
				status: 'backlog',
				priority: 'medium',
				created_by: 'peter',
			})

			// Small delay to ensure different timestamps
			await new Promise((r) => setTimeout(r, 2))

			const task2 = await createTask(root, {
				title: 'Task B',
				type: 'implementation',
				status: 'backlog',
				priority: 'medium',
				created_by: 'peter',
			})

			expect(task1.id).not.toBe(task2.id)
			expect(task1.id).toMatch(/^task-/)
			expect(task2.id).toMatch(/^task-/)
		})
	})

	describe('task with dependencies (depends_on array)', () => {
		it('creates tasks with depends_on and verifies persistence', async () => {
			const ctx = await createTestCompany()
			root = ctx.root
			cleanup = ctx.cleanup

			await createTask(root, {
				id: 'task-dep-1',
				title: 'Dependency 1',
				type: 'implementation',
				status: 'backlog',
				priority: 'medium',
				created_by: 'peter',
			})

			await createTask(root, {
				id: 'task-dep-2',
				title: 'Dependency 2',
				type: 'implementation',
				status: 'backlog',
				priority: 'medium',
				created_by: 'peter',
			})

			const task = await createTask(root, {
				id: 'task-main',
				title: 'Main task',
				type: 'implementation',
				status: 'backlog',
				priority: 'high',
				created_by: 'peter',
				depends_on: ['task-dep-1', 'task-dep-2'],
				blocks: ['task-downstream'],
			})

			expect(task.depends_on).toEqual(['task-dep-1', 'task-dep-2'])
			expect(task.blocks).toEqual(['task-downstream'])

			// Verify persistence
			const read = await readTask(root, 'task-main')
			expect(read?.depends_on).toEqual(['task-dep-1', 'task-dep-2'])
			expect(read?.blocks).toEqual(['task-downstream'])
		})
	})

	describe('task with history — verify append-only behavior', () => {
		it('history grows with each update and never loses entries', async () => {
			const ctx = await createTestCompany()
			root = ctx.root
			cleanup = ctx.cleanup

			const created = await createTask(root, {
				id: 'task-001',
				title: 'History test',
				type: 'implementation',
				status: 'backlog',
				priority: 'medium',
				created_by: 'peter',
			})
			expect(created.history).toHaveLength(1)
			expect(created.history[0]?.action).toBe('created')

			const updated1 = await updateTask(root, 'task-001', { title: 'First update' }, 'peter')
			expect(updated1.history).toHaveLength(2)
			expect(updated1.history[0]?.action).toBe('created')
			expect(updated1.history[1]?.action).toBe('updated')

			const updated2 = await updateTask(root, 'task-001', { priority: 'high' }, 'maria')
			expect(updated2.history).toHaveLength(3)
			expect(updated2.history[0]?.action).toBe('created')
			expect(updated2.history[1]?.action).toBe('updated')
			expect(updated2.history[2]?.action).toBe('updated')
			expect(updated2.history[2]?.by).toBe('maria')

			const moved = await moveTask(root, 'task-001', 'in_progress', 'peter')
			expect(moved.history).toHaveLength(4)
			expect(moved.history[3]?.action).toBe('status_changed')

			// Verify all entries are still intact after reading from disk
			const read = await readTask(root, 'task-001')
			expect(read?.history).toHaveLength(4)
			expect(read?.history[0]?.action).toBe('created')
			expect(read?.history[1]?.action).toBe('updated')
			expect(read?.history[2]?.action).toBe('updated')
			expect(read?.history[3]?.action).toBe('status_changed')
		})
	})
})
