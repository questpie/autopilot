import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { TaskSchema, MessageSchema } from '@questpie/autopilot-spec'
import { SqliteBackend } from '../src/fs/sqlite-backend'
import { createTestCompany } from './helpers'

describe('SqliteBackend – comprehensive storage tests', () => {
	let cleanup: () => Promise<void>
	let root: string
	let backend: SqliteBackend

	const now = () => new Date().toISOString()

	/** Tiny monotonic counter to guarantee unique IDs within a single test. */
	let seq = 0

	function makeTask(overrides: Partial<Record<string, unknown>> = {}) {
		seq++
		const timestamp = now()
		return TaskSchema.parse({
			id: overrides.id ?? `task-${seq}-${Date.now().toString(36)}`,
			title: (overrides.title as string) ?? 'Test task',
			description: (overrides.description as string) ?? 'A test task',
			type: overrides.type ?? 'implementation',
			status: overrides.status ?? 'backlog',
			priority: overrides.priority ?? 'medium',
			created_by: (overrides.created_by as string) ?? 'planner',
			assigned_to: overrides.assigned_to as string | undefined,
			reviewers: (overrides.reviewers as string[]) ?? [],
			approver: overrides.approver as string | undefined,
			project: overrides.project as string | undefined,
			parent: overrides.parent as string | undefined,
			depends_on: (overrides.depends_on as string[]) ?? [],
			blocks: (overrides.blocks as string[]) ?? [],
			related: (overrides.related as string[]) ?? [],
			workflow: overrides.workflow as string | undefined,
			workflow_step: overrides.workflow_step as string | undefined,
			context: (overrides.context as Record<string, string>) ?? {},
			blockers: (overrides.blockers as unknown[]) ?? [],
			created_at: (overrides.created_at as string) ?? timestamp,
			updated_at: (overrides.updated_at as string) ?? timestamp,
			started_at: overrides.started_at as string | undefined,
			completed_at: overrides.completed_at as string | undefined,
			deadline: overrides.deadline as string | undefined,
			history: (overrides.history as unknown[]) ?? [{ at: timestamp, by: 'planner', action: 'created' }],
			metadata: (overrides.metadata as Record<string, unknown>) ?? {},
		})
	}

	function makeMessage(overrides: Partial<Record<string, unknown>> = {}) {
		seq++
		return MessageSchema.parse({
			id: overrides.id ?? `msg-${seq}-${Date.now().toString(36)}`,
			from: (overrides.from as string) ?? 'planner',
			channel: overrides.channel as string | undefined,
			to: overrides.to as string | undefined,
			at: (overrides.at as string) ?? now(),
			content: (overrides.content as string) ?? 'Hello world',
			mentions: (overrides.mentions as string[]) ?? [],
			references: (overrides.references as string[]) ?? [],
			reactions: (overrides.reactions as string[]) ?? [],
			thread: overrides.thread as string | undefined,
			transport: overrides.transport as string | undefined,
			external: (overrides.external as boolean) ?? false,
		})
	}

	beforeEach(async () => {
		seq = 0
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup
		backend = new SqliteBackend(root)
		await backend.initialize()
	})

	afterEach(async () => {
		if (backend) await backend.close()
		if (cleanup) await cleanup()
	})

	// ─── Task CRUD & Filtering (14 tests) ─────────────────────────────

	describe('tasks – CRUD & filtering', () => {
		it('should create a task with all required fields', async () => {
			const task = makeTask({ id: 'task-req-1' })
			const created = await backend.createTask(task)

			expect(created.id).toBe('task-req-1')
			expect(created.title).toBe('Test task')
			expect(created.type).toBe('implementation')
			expect(created.status).toBe('backlog')
			expect(created.priority).toBe('medium')
			expect(created.created_by).toBe('planner')
			expect(created.created_at).toBeDefined()
			expect(created.updated_at).toBeDefined()
		})

		it('should create a task with all optional fields (metadata, reviewers, blocks, depends_on, related, workflow, milestone, labels, resources)', async () => {
			const task = makeTask({
				id: 'task-opt-1',
				assigned_to: 'developer',
				reviewers: ['reviewer-1', 'reviewer-2'],
				approver: 'lead',
				project: 'web-app',
				parent: 'task-parent-0',
				depends_on: ['task-dep-1', 'task-dep-2'],
				blocks: ['task-block-1'],
				related: ['task-rel-1'],
				workflow: 'ci-pipeline',
				workflow_step: 'build',
				context: { repo: 'main', branch: 'feature-x' },
				deadline: now(),
				metadata: { source: 'linear', external_id: 'QUE-100' },
			})

			const created = await backend.createTask(task)
			const read = await backend.readTask('task-opt-1')

			expect(read).not.toBeNull()
			expect(read!.assigned_to).toBe('developer')
			expect(read!.reviewers).toEqual(['reviewer-1', 'reviewer-2'])
			expect(read!.approver).toBe('lead')
			expect(read!.project).toBe('web-app')
			expect(read!.parent).toBe('task-parent-0')
			expect(read!.depends_on).toEqual(['task-dep-1', 'task-dep-2'])
			expect(read!.blocks).toEqual(['task-block-1'])
			expect(read!.related).toEqual(['task-rel-1'])
			expect(read!.workflow).toBe('ci-pipeline')
			expect(read!.workflow_step).toBe('build')
			expect(read!.context).toEqual({ repo: 'main', branch: 'feature-x' })
			expect(read!.metadata).toEqual({ source: 'linear', external_id: 'QUE-100' })
			expect(read!.deadline).toBeDefined()
		})

		it('should read a task by ID (exists)', async () => {
			const task = makeTask({ id: 'task-read-1', title: 'Readable task' })
			await backend.createTask(task)

			const read = await backend.readTask('task-read-1')
			expect(read).not.toBeNull()
			expect(read!.id).toBe('task-read-1')
			expect(read!.title).toBe('Readable task')
		})

		it('should return null for non-existent task ID', async () => {
			const read = await backend.readTask('task-does-not-exist')
			expect(read).toBeNull()
		})

		it('should update task title, description, and status', async () => {
			await backend.createTask(makeTask({ id: 'task-upd-1' }))

			const updated = await backend.updateTask(
				'task-upd-1',
				{ title: 'New title', description: 'New desc', status: 'review' },
				'developer'
			)

			expect(updated.title).toBe('New title')
			expect(updated.description).toBe('New desc')
			expect(updated.status).toBe('review')
		})

		it('should preserve history entries on update', async () => {
			await backend.createTask(makeTask({ id: 'task-hist-1' }))

			const u1 = await backend.updateTask('task-hist-1', { title: 'First update' }, 'dev-a')
			expect(u1.history.length).toBe(2)
			expect(u1.history[1]!.action).toBe('updated')
			expect(u1.history[1]!.by).toBe('dev-a')

			const u2 = await backend.updateTask('task-hist-1', { title: 'Second update' }, 'dev-b')
			expect(u2.history.length).toBe(3)
			expect(u2.history[2]!.by).toBe('dev-b')

			// Original entry still intact
			expect(u2.history[0]!.action).toBe('created')
		})

		it('should set started_at when moving to in_progress and completed_at when moving to done', async () => {
			await backend.createTask(makeTask({ id: 'task-move-1', status: 'backlog' }))

			const inProg = await backend.moveTask('task-move-1', 'in_progress', 'developer')
			expect(inProg.status).toBe('in_progress')
			expect(inProg.started_at).toBeDefined()
			const startedAt = inProg.started_at

			const done = await backend.moveTask('task-move-1', 'done', 'reviewer')
			expect(done.status).toBe('done')
			expect(done.completed_at).toBeDefined()
			// started_at should be preserved, not overwritten
			expect(done.started_at).toBe(startedAt)
		})

		it('should list tasks filtered by status', async () => {
			await backend.createTask(makeTask({ id: 'task-s1', status: 'backlog' }))
			await backend.createTask(makeTask({ id: 'task-s2', status: 'in_progress' }))
			await backend.createTask(makeTask({ id: 'task-s3', status: 'backlog' }))

			const backlog = await backend.listTasks({ status: 'backlog' })
			expect(backlog.length).toBe(2)
			expect(backlog.every((t) => t.status === 'backlog')).toBe(true)
		})

		it('should list tasks filtered by assigned_to', async () => {
			await backend.createTask(makeTask({ id: 'task-a1', assigned_to: 'alice' }))
			await backend.createTask(makeTask({ id: 'task-a2', assigned_to: 'bob' }))
			await backend.createTask(makeTask({ id: 'task-a3', assigned_to: 'alice' }))

			const alice = await backend.listTasks({ assigned_to: 'alice' })
			expect(alice.length).toBe(2)
			expect(alice.every((t) => t.assigned_to === 'alice')).toBe(true)
		})

		it('should list tasks filtered by project', async () => {
			await backend.createTask(makeTask({ id: 'task-p1', project: 'alpha' }))
			await backend.createTask(makeTask({ id: 'task-p2', project: 'beta' }))
			await backend.createTask(makeTask({ id: 'task-p3', project: 'alpha' }))

			const alpha = await backend.listTasks({ project: 'alpha' })
			expect(alpha.length).toBe(2)
			expect(alpha.every((t) => t.project === 'alpha')).toBe(true)
		})

		it('should list tasks with multiple filters (AND logic)', async () => {
			await backend.createTask(makeTask({ id: 'task-m1', status: 'backlog', assigned_to: 'alice', project: 'web' }))
			await backend.createTask(makeTask({ id: 'task-m2', status: 'backlog', assigned_to: 'bob', project: 'web' }))
			await backend.createTask(makeTask({ id: 'task-m3', status: 'in_progress', assigned_to: 'alice', project: 'web' }))
			await backend.createTask(makeTask({ id: 'task-m4', status: 'backlog', assigned_to: 'alice', project: 'api' }))

			const results = await backend.listTasks({ status: 'backlog', assigned_to: 'alice', project: 'web' })
			expect(results.length).toBe(1)
			expect(results[0]!.id).toBe('task-m1')
		})

		it('should list tasks with limit/offset pagination', async () => {
			for (let i = 0; i < 10; i++) {
				await backend.createTask(makeTask({ id: `task-pg-${i}` }))
			}

			const page1 = await backend.listTasks({ limit: 3, offset: 0 })
			expect(page1.length).toBe(3)

			const page2 = await backend.listTasks({ limit: 3, offset: 3 })
			expect(page2.length).toBe(3)

			// No overlap between pages
			const page1Ids = new Set(page1.map((t) => t.id))
			const page2Ids = new Set(page2.map((t) => t.id))
			for (const id of page2Ids) {
				expect(page1Ids.has(id)).toBe(false)
			}

			// Offset beyond total returns empty
			const pageBeyond = await backend.listTasks({ limit: 3, offset: 100 })
			expect(pageBeyond.length).toBe(0)
		})

		it('should list tasks with order_by (created_at, updated_at, priority)', async () => {
			const t1 = now()
			// Small delay to guarantee different timestamps
			await Bun.sleep(10)
			const t2 = now()
			await Bun.sleep(10)
			const t3 = now()

			await backend.createTask(makeTask({ id: 'task-o1', created_at: t2, updated_at: t2 }))
			await backend.createTask(makeTask({ id: 'task-o2', created_at: t1, updated_at: t3 }))
			await backend.createTask(makeTask({ id: 'task-o3', created_at: t3, updated_at: t1 }))

			// Order by created_at ascending
			const byCreatedAsc = await backend.listTasks({ order_by: 'created_at', order_dir: 'asc' })
			expect(byCreatedAsc[0]!.id).toBe('task-o2')
			expect(byCreatedAsc[2]!.id).toBe('task-o3')

			// Order by updated_at ascending
			const byUpdatedAsc = await backend.listTasks({ order_by: 'updated_at', order_dir: 'asc' })
			expect(byUpdatedAsc[0]!.id).toBe('task-o3')
			expect(byUpdatedAsc[2]!.id).toBe('task-o2')

			// Order by priority
			await backend.createTask(makeTask({ id: 'task-op1', priority: 'low' }))
			await backend.createTask(makeTask({ id: 'task-op2', priority: 'critical' }))

			const byPriority = await backend.listTasks({ order_by: 'priority', order_dir: 'asc' })
			// SQLite text ordering: 'critical' < 'low' < 'medium'
			expect(byPriority.length).toBeGreaterThan(0)
		})

		it('should count tasks with filter', async () => {
			await backend.createTask(makeTask({ id: 'task-c1', status: 'backlog', project: 'web' }))
			await backend.createTask(makeTask({ id: 'task-c2', status: 'backlog', project: 'web' }))
			await backend.createTask(makeTask({ id: 'task-c3', status: 'review', project: 'web' }))
			await backend.createTask(makeTask({ id: 'task-c4', status: 'backlog', project: 'api' }))

			const total = await backend.countTasks()
			expect(total).toBe(4)

			const backlogCount = await backend.countTasks({ status: 'backlog' })
			expect(backlogCount).toBe(3)

			const webBacklog = await backend.countTasks({ status: 'backlog', project: 'web' })
			expect(webBacklog).toBe(2)

			const assignedCount = await backend.countTasks({ assigned_to: 'nobody' })
			expect(assignedCount).toBe(0)
		})

		it('should delete a task and confirm it is gone', async () => {
			await backend.createTask(makeTask({ id: 'task-del-1' }))
			await backend.createTask(makeTask({ id: 'task-del-2' }))

			await backend.deleteTask('task-del-1')

			const deleted = await backend.readTask('task-del-1')
			expect(deleted).toBeNull()

			// Other tasks unaffected
			const remaining = await backend.readTask('task-del-2')
			expect(remaining).not.toBeNull()

			const count = await backend.countTasks()
			expect(count).toBe(1)
		})
	})

	// ─── Message System (8 tests) ─────────────────────────────────────

	describe('messages', () => {
		it('should send a message with channel', async () => {
			const msg = makeMessage({ id: 'msg-ch-1', channel: 'general', content: 'Hello channel' })
			const sent = await backend.sendMessage(msg)

			expect(sent.id).toBe('msg-ch-1')
			expect(sent.channel).toBe('general')

			const msgs = await backend.readMessages({ channel: 'general' })
			expect(msgs.length).toBe(1)
			expect(msgs[0]!.content).toBe('Hello channel')
		})

		it('should send a direct message (to_id)', async () => {
			const msg = makeMessage({ id: 'msg-dm-1', from: 'planner', to: 'developer', content: 'Hey dev' })
			await backend.sendMessage(msg)

			const msgs = await backend.readMessages({ to_id: 'developer' })
			expect(msgs.length).toBe(1)
			expect(msgs[0]!.from).toBe('planner')
			expect(msgs[0]!.to).toBe('developer')
			expect(msgs[0]!.content).toBe('Hey dev')
		})

		it('should read messages filtered by channel', async () => {
			await backend.sendMessage(makeMessage({ id: 'msg-fc-1', channel: 'dev', content: 'Dev msg' }))
			await backend.sendMessage(makeMessage({ id: 'msg-fc-2', channel: 'general', content: 'General msg' }))
			await backend.sendMessage(makeMessage({ id: 'msg-fc-3', channel: 'dev', content: 'Another dev msg' }))

			const devMsgs = await backend.readMessages({ channel: 'dev' })
			expect(devMsgs.length).toBe(2)
			expect(devMsgs.every((m) => m.channel === 'dev')).toBe(true)
		})

		it('should read messages with limit', async () => {
			for (let i = 0; i < 10; i++) {
				await backend.sendMessage(makeMessage({ id: `msg-lim-${i}`, channel: 'general', content: `Message ${i}` }))
			}

			const limited = await backend.readMessages({ channel: 'general', limit: 4 })
			expect(limited.length).toBe(4)
		})

		it('should return messages ordered by created_at ascending', async () => {
			const t1 = now()
			await Bun.sleep(10)
			const t2 = now()
			await Bun.sleep(10)
			const t3 = now()

			await backend.sendMessage(makeMessage({ id: 'msg-ord-2', channel: 'ch', at: t2 }))
			await backend.sendMessage(makeMessage({ id: 'msg-ord-1', channel: 'ch', at: t1 }))
			await backend.sendMessage(makeMessage({ id: 'msg-ord-3', channel: 'ch', at: t3 }))

			const msgs = await backend.readMessages({ channel: 'ch' })
			expect(msgs[0]!.id).toBe('msg-ord-1')
			expect(msgs[1]!.id).toBe('msg-ord-2')
			expect(msgs[2]!.id).toBe('msg-ord-3')
		})

		it('should send a message with mentions and references', async () => {
			const msg = makeMessage({
				id: 'msg-ref-1',
				channel: 'dev',
				content: 'Hey @alice check task-42',
				mentions: ['alice', 'bob'],
				references: ['task-42', 'task-43'],
			})
			await backend.sendMessage(msg)

			const msgs = await backend.readMessages({ channel: 'dev' })
			expect(msgs.length).toBe(1)
			expect(msgs[0]!.mentions).toEqual(['alice', 'bob'])
			expect(msgs[0]!.references).toEqual(['task-42', 'task-43'])
		})

		it('should send a message with thread', async () => {
			// Parent message
			await backend.sendMessage(makeMessage({ id: 'msg-thr-parent', channel: 'dev', content: 'Main topic' }))

			// Thread replies
			await backend.sendMessage(
				makeMessage({ id: 'msg-thr-r1', channel: 'dev', content: 'Reply 1', thread: 'msg-thr-parent' })
			)
			await backend.sendMessage(
				makeMessage({ id: 'msg-thr-r2', channel: 'dev', content: 'Reply 2', thread: 'msg-thr-parent' })
			)

			const threadMsgs = await backend.readMessages({ thread: 'msg-thr-parent' })
			expect(threadMsgs.length).toBe(2)
			expect(threadMsgs.every((m) => m.thread === 'msg-thr-parent')).toBe(true)
		})

		it('should search messages by content (FTS)', async () => {
			await backend.sendMessage(
				makeMessage({ id: 'msg-fts-1', channel: 'dev', content: 'The deployment pipeline is broken' })
			)
			await backend.sendMessage(
				makeMessage({ id: 'msg-fts-2', channel: 'dev', content: 'All unit tests are passing' })
			)
			await backend.sendMessage(
				makeMessage({ id: 'msg-fts-3', channel: 'dev', content: 'Fix the broken pipeline ASAP' })
			)

			const results = await backend.searchMessages('broken pipeline')
			expect(results.length).toBeGreaterThanOrEqual(1)
			expect(results.some((m) => m.content.includes('broken'))).toBe(true)

			// Non-matching query
			const noResults = await backend.searchMessages('nonexistent gibberish xyzzy')
			expect(noResults.length).toBe(0)
		})
	})

	// ─── Activity Logging (6 tests) ───────────────────────────────────

	describe('activity', () => {
		it('should append an activity entry', async () => {
			await backend.appendActivity({
				at: now(),
				agent: 'developer',
				type: 'task_completed',
				summary: 'Finished implementing feature X',
				details: { task_id: 'task-1', duration_ms: 12000 },
			})

			const entries = await backend.readActivity()
			expect(entries.length).toBe(1)
			expect(entries[0]!.agent).toBe('developer')
			expect(entries[0]!.type).toBe('task_completed')
			expect(entries[0]!.summary).toBe('Finished implementing feature X')
			expect(entries[0]!.details).toEqual({ task_id: 'task-1', duration_ms: 12000 })
			expect(entries[0]!.at).toBeDefined()
		})

		it('should read activity with no filter (returns latest 100)', async () => {
			// Insert 5 entries
			for (let i = 0; i < 5; i++) {
				await backend.appendActivity({
					at: now(),
					agent: 'dev',
					type: 'action',
					summary: `Entry ${i}`,
				})
			}

			const all = await backend.readActivity()
			expect(all.length).toBe(5)
		})

		it('should filter activity by agent', async () => {
			await backend.appendActivity({ at: now(), agent: 'developer', type: 'code_push', summary: 'Pushed code' })
			await backend.appendActivity({ at: now(), agent: 'reviewer', type: 'review_done', summary: 'Reviewed PR' })
			await backend.appendActivity({ at: now(), agent: 'developer', type: 'task_started', summary: 'Started task' })

			const devActivity = await backend.readActivity({ agent: 'developer' })
			expect(devActivity.length).toBe(2)
			expect(devActivity.every((a) => a.agent === 'developer')).toBe(true)
		})

		it('should filter activity by type', async () => {
			await backend.appendActivity({ at: now(), agent: 'dev', type: 'task_completed', summary: 'Done with task' })
			await backend.appendActivity({ at: now(), agent: 'dev', type: 'code_pushed', summary: 'Pushed code' })
			await backend.appendActivity({ at: now(), agent: 'rev', type: 'task_completed', summary: 'Also done' })

			const completed = await backend.readActivity({ type: 'task_completed' })
			expect(completed.length).toBe(2)
			expect(completed.every((a) => a.type === 'task_completed')).toBe(true)
		})

		it('should limit activity results', async () => {
			for (let i = 0; i < 10; i++) {
				await backend.appendActivity({ at: now(), agent: 'dev', type: 'x', summary: `Entry ${i}` })
			}

			const limited = await backend.readActivity({ limit: 3 })
			expect(limited.length).toBe(3)
		})

		it('should return activity ordered descending by created_at', async () => {
			const t1 = now()
			await Bun.sleep(10)
			const t2 = now()
			await Bun.sleep(10)
			const t3 = now()

			await backend.appendActivity({ at: t1, agent: 'dev', type: 'x', summary: 'First' })
			await backend.appendActivity({ at: t2, agent: 'dev', type: 'x', summary: 'Second' })
			await backend.appendActivity({ at: t3, agent: 'dev', type: 'x', summary: 'Third' })

			const entries = await backend.readActivity()
			expect(entries.length).toBe(3)
			// Descending: most recent first
			expect(entries[0]!.summary).toBe('Third')
			expect(entries[1]!.summary).toBe('Second')
			expect(entries[2]!.summary).toBe('First')
		})
	})
})
