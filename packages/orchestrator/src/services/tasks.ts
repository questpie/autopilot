import { randomBytes } from 'node:crypto'
import { eq, and, or, sql, inArray } from 'drizzle-orm'
import { tasks, runs, runEvents, artifacts, taskRelations, conversationBindings, workerLeases, scheduleExecutions, runSteers } from '../db/company-schema'
import type { CompanyDb } from '../db'
import type { ArtifactService } from './artifacts'

/**
 * Slugify a title into a kebab-case ID suitable for git branches and filesystem paths.
 * Handles unicode, special chars, collapses dashes, and truncates to a reasonable length.
 * Appends a short random suffix to prevent collisions.
 */
export function slugifyTaskId(title: string, maxLength = 60): string {
	const slug = title
		.normalize('NFKD')
		// Strip combining diacritics (accents)
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		// Replace non-alphanumeric chars with dashes
		.replace(/[^a-z0-9]+/g, '-')
		// Collapse multiple dashes
		.replace(/-{2,}/g, '-')
		// Trim leading/trailing dashes
		.replace(/^-|-$/g, '')

	const suffix = randomBytes(2).toString('hex') // 4 hex chars
	const maxSlugLen = maxLength - suffix.length - 1 // -1 for the dash separator

	const trimmed = slug.slice(0, maxSlugLen).replace(/-$/, '')
	return trimmed ? `${trimmed}-${suffix}` : suffix
}

function _getTask(db: CompanyDb, id: string) {
	return db.select().from(tasks).where(eq(tasks.id, id)).get()
}

export type TaskRow = NonNullable<Awaited<ReturnType<typeof _getTask>>>

export class TaskService {
	#artifactService: ArtifactService | null = null

	constructor(private db: CompanyDb) {}

	/** Inject ArtifactService for blob-aware cascade deletion. */
	setArtifactService(svc: ArtifactService) {
		this.#artifactService = svc
	}

	async create(input: {
		id: string
		title: string
		description?: string
		type: string
		status?: string
		priority?: string
		assigned_to?: string
		workflow_id?: string
		workflow_step?: string
		context?: string
		metadata?: string
		queue?: string
		start_after?: string
		scheduled_by?: string
		created_by: string
	}) {
		const now = new Date().toISOString()
		await this.db.insert(tasks).values({
			...input,
			status: input.status ?? 'backlog',
			priority: input.priority ?? 'medium',
			context: input.context ?? '{}',
			metadata: input.metadata ?? '{}',
			created_at: now,
			updated_at: now,
		})
		return this.get(input.id)
	}

	async get(id: string) {
		return _getTask(this.db, id)
	}

	async list(filter?: {
		status?: string
		assigned_to?: string
		workflow_id?: string
	}) {
		const conditions = []
		if (filter?.status) conditions.push(eq(tasks.status, filter.status))
		if (filter?.assigned_to) conditions.push(eq(tasks.assigned_to, filter.assigned_to))
		if (filter?.workflow_id) conditions.push(eq(tasks.workflow_id, filter.workflow_id))

		if (conditions.length === 0) {
			return this.db.select().from(tasks).all()
		}
		if (conditions.length === 1) {
			return this.db.select().from(tasks).where(conditions[0]!).all()
		}
		return this.db
			.select()
			.from(tasks)
			.where(and(...conditions))
			.all()
	}

	async update(
		id: string,
		updates: Partial<{
			title: string
			description: string
			status: string
			priority: string
			assigned_to: string
			workflow_id: string
			workflow_step: string
			context: string
			metadata: string
			queue: string
			start_after: string
			scheduled_by: string
		}>,
	) {
		await this.db
			.update(tasks)
			.set({ ...updates, updated_at: new Date().toISOString() })
			.where(eq(tasks.id, id))
		return this.get(id)
	}

	/**
	 * Count tasks in a named queue that currently have active runs (claimed or running).
	 */
	async countActiveInQueue(queue: string): Promise<number> {
		const result = await this.db
			.select({ count: sql<number>`count(distinct ${tasks.id})` })
			.from(tasks)
			.innerJoin(runs, eq(runs.task_id, tasks.id))
			.where(
				and(
					eq(tasks.queue, queue),
					inArray(runs.status, ['claimed', 'running']),
				),
			)
			.get()
		return result?.count ?? 0
	}

	/**
	 * Find the next pending task in a named queue, ordered by priority_order.
	 * 'fifo' = oldest created_at first. 'priority' = highest priority first, then oldest.
	 * Only returns tasks whose start_after (if set) has elapsed.
	 */
	async findNextInQueue(queue: string, priorityOrder: 'fifo' | 'priority' = 'fifo'): Promise<TaskRow | undefined> {
		const now = new Date().toISOString()
		const conditions = [
			eq(tasks.queue, queue),
			// Tasks in backlog or active that have no running/claimed runs
			inArray(tasks.status, ['backlog', 'active']),
		]

		// Get candidates
		const candidates = await this.db
			.select()
			.from(tasks)
			.where(and(...conditions))
			.all()

		// Filter: start_after must have elapsed (or be unset), and must not have active runs
		const eligible: TaskRow[] = []
		for (const task of candidates) {
			if (task.start_after && task.start_after > now) continue

			// Ensure no active runs for this task
			const activeRuns = await this.db
				.select({ id: runs.id })
				.from(runs)
				.where(
					and(
						eq(runs.task_id, task.id),
						inArray(runs.status, ['pending', 'claimed', 'running']),
					),
				)
				.all()
			if (activeRuns.length > 0) continue

			eligible.push(task)
		}

		if (eligible.length === 0) return undefined

		if (priorityOrder === 'priority') {
			const priorityMap: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
			eligible.sort((a, b) => {
				const pa = priorityMap[a.priority ?? 'medium'] ?? 2
				const pb = priorityMap[b.priority ?? 'medium'] ?? 2
				if (pa !== pb) return pa - pb
				return (a.created_at ?? '').localeCompare(b.created_at ?? '')
			})
		} else {
			eligible.sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
		}

		return eligible[0]
	}

	/**
	 * List all tasks in a named queue with summary info.
	 */
	async listByQueue(queue: string): Promise<TaskRow[]> {
		return await this.db
			.select()
			.from(tasks)
			.where(eq(tasks.queue, queue))
			.all()
	}

	/**
	 * Find tasks whose start_after has elapsed and that are still in backlog/active
	 * with no pending/claimed/running runs. These are ready for intake.
	 */
	async listDeferredReady(): Promise<TaskRow[]> {
		const now = new Date().toISOString()
		const candidates = await this.db
			.select()
			.from(tasks)
			.where(
				and(
					sql`${tasks.start_after} IS NOT NULL`,
					sql`${tasks.start_after} <= ${now}`,
					inArray(tasks.status, ['backlog', 'active']),
				),
			)
			.all()

		const ready: TaskRow[] = []
		for (const task of candidates) {
			const activeRuns = await this.db
				.select({ id: runs.id })
				.from(runs)
				.where(
					and(
						eq(runs.task_id, task.id),
						inArray(runs.status, ['pending', 'claimed', 'running']),
					),
				)
				.all()
			if (activeRuns.length === 0) ready.push(task)
		}
		return ready
	}

	async delete(id: string): Promise<TaskRow | undefined> {
		const existing = await this.get(id)
		if (!existing) return undefined
		await this.db.delete(tasks).where(eq(tasks.id, id))
		return existing
	}

	/**
	 * Delete a task and cascade-delete all related rows:
	 * runs, run_events, artifacts, worker_leases, task_relations, conversation_bindings.
	 *
	 * Wrapped in a transaction so partial deletes cannot leave orphaned rows.
	 */
	async deleteCascade(id: string): Promise<TaskRow | undefined> {
		const existing = await this.get(id)
		if (!existing) return undefined

		await this.db.transaction(async (tx) => {
			// 1. Find all runs for this task
			const taskRuns = await tx.select({ id: runs.id }).from(runs).where(eq(runs.task_id, id)).all()
			const runIds = taskRuns.map((r) => r.id)

			if (runIds.length > 0) {
				// 2. Delete run_events + artifacts + worker_leases + run_steers for each run
				for (const runId of runIds) {
					await tx.delete(runEvents).where(eq(runEvents.run_id, runId)).run()
					await tx.delete(artifacts).where(eq(artifacts.run_id, runId)).run()
					await tx.delete(workerLeases).where(eq(workerLeases.run_id, runId)).run()
					await tx.delete(runSteers).where(eq(runSteers.run_id, runId)).run()
				}

				// 3. Delete runs
				await tx.delete(runs).where(eq(runs.task_id, id)).run()
			}

			// 4. Delete artifacts linked directly to this task (not via run)
			await tx.delete(artifacts).where(eq(artifacts.task_id, id)).run()

			// 5. Delete task_relations (both directions)
			await tx.delete(taskRelations).where(
				or(eq(taskRelations.source_task_id, id), eq(taskRelations.target_task_id, id))!
			).run()

			// 6. Delete conversation bindings
			await tx.delete(conversationBindings).where(eq(conversationBindings.task_id, id)).run()

			// 7. Delete schedule_executions referencing this task
			await tx.delete(scheduleExecutions).where(eq(scheduleExecutions.task_id, id)).run()

			// 8. Delete the task itself
			await tx.delete(tasks).where(eq(tasks.id, id)).run()
		})

		// Clean up orphaned blobs (filesystem + artifact_blobs rows) outside the transaction
		if (this.#artifactService) {
			await this.#artifactService.removeOrphanBlobs()
		}

		return existing
	}
}
