import { randomBytes } from 'node:crypto'
import { eq, and, lte, desc } from 'drizzle-orm'
import { Cron } from 'croner'
import { schedules, scheduleExecutions, tasks, queries } from '../db/company-schema'
import type { CompanyDb } from '../db'

function _getSchedule(db: CompanyDb, id: string) {
	return db.select().from(schedules).where(eq(schedules.id, id)).get()
}

export type ScheduleRow = NonNullable<Awaited<ReturnType<typeof _getSchedule>>>

function _getExecution(db: CompanyDb, id: string) {
	return db.select().from(scheduleExecutions).where(eq(scheduleExecutions.id, id)).get()
}

export type ScheduleExecutionRow = NonNullable<Awaited<ReturnType<typeof _getExecution>>>

/**
 * Compute the next run time from a cron expression using croner.
 *
 * Returns ISO string of next occurrence, or null if cron is invalid/empty.
 */
export function computeNextRun(cron: string, timezone: string, from?: Date): string | null {
	if (!cron || cron.trim() === '') return null
	try {
		const job = new Cron(cron, { timezone })
		const next = job.nextRun(from ?? new Date())
		return next ? next.toISOString() : null
	} catch (err) {
		console.warn(`[schedules] invalid cron expression "${cron}":`, err instanceof Error ? err.message : String(err))
		return null
	}
}

/**
 * Interpolate template variables in a string.
 * Supported: {{date}} (YYYY-MM-DD), {{datetime}} (ISO 8601)
 */
export function interpolateTemplate(text: string, now?: Date): string {
	const d = now ?? new Date()
	const iso = d.toISOString()
	const dateOnly = iso.slice(0, 10) // YYYY-MM-DD
	return text
		.replace(/\{\{date\}\}/g, dateOnly)
		.replace(/\{\{datetime\}\}/g, iso)
}

export class ScheduleService {
	constructor(private db: CompanyDb) {}

	async create(input: {
		name: string
		description?: string
		cron: string
		timezone?: string
		agent_id: string
		workflow_id?: string
		task_template?: string
		mode?: string
		query_template?: string
		concurrency_policy?: string
		enabled?: boolean
		created_by?: string
	}): Promise<ScheduleRow | undefined> {
		const id = `sched-${randomBytes(8).toString('hex')}`
		const now = new Date().toISOString()
		const tz = input.timezone ?? 'UTC'
		const nextRun = input.enabled !== false ? computeNextRun(input.cron, tz) : null

		await this.db.insert(schedules).values({
			id,
			name: input.name,
			description: input.description,
			cron: input.cron,
			timezone: tz,
			agent_id: input.agent_id,
			workflow_id: input.workflow_id,
			task_template: input.task_template ?? '{}',
			mode: input.mode ?? 'task',
			query_template: input.query_template ?? '{}',
			concurrency_policy: input.concurrency_policy ?? 'skip',
			enabled: input.enabled !== false,
			next_run_at: nextRun,
			created_by: input.created_by,
			created_at: now,
			updated_at: now,
		})

		return this.get(id)
	}

	async get(id: string): Promise<ScheduleRow | undefined> {
		return _getSchedule(this.db, id)
	}

	async list(): Promise<ScheduleRow[]> {
		return this.db.select().from(schedules).all()
	}

	async update(
		id: string,
		updates: Partial<{
			name: string
			description: string
			cron: string
			timezone: string
			agent_id: string
			workflow_id: string
			task_template: string
			mode: string
			query_template: string
			concurrency_policy: string
			enabled: boolean
		}>,
	): Promise<ScheduleRow | undefined> {
		const existing = await this.get(id)
		if (!existing) return undefined

		const merged: Record<string, unknown> = { ...updates, updated_at: new Date().toISOString() }

		// Recompute next_run if cron, timezone, or enabled changed
		if (updates.cron !== undefined || updates.timezone !== undefined || updates.enabled !== undefined) {
			const cron = updates.cron ?? existing.cron
			const tz = updates.timezone ?? existing.timezone ?? 'UTC'
			const enabled = updates.enabled ?? existing.enabled
			const nextRun = enabled ? computeNextRun(cron, tz) : null
			merged.next_run_at = nextRun
		}

		await this.db.update(schedules).set(merged).where(eq(schedules.id, id))
		return this.get(id)
	}

	async delete(id: string): Promise<ScheduleRow | undefined> {
		const existing = await this.get(id)
		if (!existing) return undefined
		// Cascade: delete execution history before the schedule itself
		await this.db.delete(scheduleExecutions).where(eq(scheduleExecutions.schedule_id, id))
		await this.db.delete(schedules).where(eq(schedules.id, id))
		return existing
	}

	/**
	 * Find schedules that are due for execution.
	 * Returns enabled schedules where next_run_at <= now.
	 */
	async findDue(now: Date): Promise<ScheduleRow[]> {
		const nowIso = now.toISOString()
		return this.db
			.select()
			.from(schedules)
			.where(
				and(
					eq(schedules.enabled, true),
					lte(schedules.next_run_at, nowIso),
				),
			)
			.all()
	}

	/**
	 * Record a schedule execution in the ledger.
	 */
	async recordExecution(input: {
		schedule_id: string
		task_id?: string
		query_id?: string
		status: string
		skip_reason?: string
		error?: string
		triggered_at: string
	}): Promise<ScheduleExecutionRow | undefined> {
		const id = `sexec-${randomBytes(8).toString('hex')}`
		const now = new Date().toISOString()

		await this.db.insert(scheduleExecutions).values({
			id,
			schedule_id: input.schedule_id,
			task_id: input.task_id ?? null,
			query_id: input.query_id ?? null,
			status: input.status,
			skip_reason: input.skip_reason ?? null,
			error: input.error ?? null,
			triggered_at: input.triggered_at,
			created_at: now,
		})

		return _getExecution(this.db, id)
	}

	/**
	 * List executions for a schedule, most recent first.
	 */
	async listExecutions(scheduleId: string, limit = 50): Promise<ScheduleExecutionRow[]> {
		return this.db
			.select()
			.from(scheduleExecutions)
			.where(eq(scheduleExecutions.schedule_id, scheduleId))
			.orderBy(desc(scheduleExecutions.triggered_at))
			.limit(limit)
			.all()
	}

	/**
	 * Find an active (triggered, not yet completed/failed/skipped) execution for concurrency check.
	 *
	 * Note: Schedule execution status is not automatically transitioned when the
	 * triggered task/query completes. To avoid permanently blocking future executions,
	 * we auto-complete stale triggered executions whose referenced task has reached
	 * a terminal state.
	 */
	async findActiveExecution(scheduleId: string): Promise<ScheduleExecutionRow | undefined> {
		const triggered = await this.db
			.select()
			.from(scheduleExecutions)
			.where(
				and(
					eq(scheduleExecutions.schedule_id, scheduleId),
					eq(scheduleExecutions.status, 'triggered'),
				),
			)
			.orderBy(desc(scheduleExecutions.triggered_at))
			.limit(1)
			.get()

		if (!triggered) return undefined

		// Auto-complete stale triggered executions: if the referenced task/query
		// is in a terminal state, mirror its status onto the execution record.
		const terminalStatus = await this.resolveTerminalStatus(triggered)
		if (terminalStatus) {
			await this.db
				.update(scheduleExecutions)
				.set({ status: terminalStatus })
				.where(eq(scheduleExecutions.id, triggered.id))

			// Drain queue: promote the oldest queued execution so the next tick picks it up
			const queued = await this.db
				.select()
				.from(scheduleExecutions)
				.where(
					and(
						eq(scheduleExecutions.schedule_id, scheduleId),
						eq(scheduleExecutions.status, 'queued'),
					),
				)
				.orderBy(scheduleExecutions.triggered_at)
				.limit(1)
				.get()
			if (queued) {
				await this.db
					.update(scheduleExecutions)
					.set({ status: 'triggered' })
					.where(eq(scheduleExecutions.id, queued.id))
				console.log(`[schedules] promoted queued execution ${queued.id} to triggered for schedule ${scheduleId}`)
			}

			return undefined
		}

		return triggered
	}

	/** Check if a triggered execution's task/query has reached a terminal state. */
	private async resolveTerminalStatus(exec: ScheduleExecutionRow): Promise<'completed' | 'failed' | null> {
		if (exec.task_id) {
			const task = await this.db.select().from(tasks).where(eq(tasks.id, exec.task_id)).get()
			if (task?.status === 'done') return 'completed'
			if (task?.status === 'failed') return 'failed'
		}
		if (exec.query_id) {
			const query = await this.db.select().from(queries).where(eq(queries.id, exec.query_id)).get()
			if (query?.status === 'completed') return 'completed'
			if (query?.status === 'failed') return 'failed'
		}
		return null
	}

	/**
	 * Update next_run_at and last_run_at after an execution.
	 */
	async advanceSchedule(id: string, triggeredAt: Date): Promise<void> {
		const schedule = await this.get(id)
		if (!schedule) return

		const tz = schedule.timezone ?? 'UTC'
		const nextRun = computeNextRun(schedule.cron, tz, triggeredAt)

		const updates: Record<string, unknown> = {
			last_run_at: triggeredAt.toISOString(),
			updated_at: new Date().toISOString(),
		}

		if (nextRun) {
			updates.next_run_at = nextRun
		} else {
			// One-shot schedule (invalid cron or no next occurrence) — auto-disable
			updates.next_run_at = null
			updates.enabled = false
		}

		await this.db.update(schedules).set(updates).where(eq(schedules.id, id))
	}
}
