import { randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { schedules } from '../db/company-schema'
import type { CompanyDb } from '../db'

function _getSchedule(db: CompanyDb, id: string) {
	return db.select().from(schedules).where(eq(schedules.id, id)).get()
}

export type ScheduleRow = NonNullable<Awaited<ReturnType<typeof _getSchedule>>>

/**
 * Compute the next run time from a cron expression.
 *
 * This is a stub implementation that parses a simple cron expression
 * and returns the next occurrence. For V1, this is intentionally minimal —
 * a full cron library can be wired in later without changing the service API.
 */
export function computeNextRun(cron: string, timezone: string, from?: Date): string | null {
	// V1 stub: parse simple cron expressions (minute hour dom month dow)
	const parts = cron.trim().split(/\s+/)
	if (parts.length < 5) return null

	// For V1 we store the computed value but don't run a scheduler daemon yet.
	// The real computation will use a cron parser library when the daemon lands.
	// For now, return null to indicate "not yet computed".
	return null
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
			enabled: boolean
		}>,
	): Promise<ScheduleRow | undefined> {
		const existing = await this.get(id)
		if (!existing) return undefined

		const merged = { ...updates, updated_at: new Date().toISOString() }

		// Recompute next_run if cron, timezone, or enabled changed
		if (updates.cron !== undefined || updates.timezone !== undefined || updates.enabled !== undefined) {
			const cron = updates.cron ?? existing.cron
			const tz = updates.timezone ?? existing.timezone ?? 'UTC'
			const enabled = updates.enabled ?? existing.enabled
			const nextRun = enabled ? computeNextRun(cron, tz) : null
			Object.assign(merged, { next_run_at: nextRun })
		}

		await this.db.update(schedules).set(merged).where(eq(schedules.id, id))
		return this.get(id)
	}

	async delete(id: string): Promise<ScheduleRow | undefined> {
		const existing = await this.get(id)
		if (!existing) return undefined
		await this.db.delete(schedules).where(eq(schedules.id, id))
		return existing
	}
}
