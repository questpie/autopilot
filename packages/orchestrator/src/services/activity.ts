import { sql } from 'drizzle-orm'
import { activity } from '../db/company-schema'
import type { CompanyDb } from '../db'

export type ActivityRow = typeof activity.$inferSelect

export class ActivityService {
	constructor(private db: CompanyDb) {}

	async log(entry: {
		actor: string
		type: string
		summary: string
		details?: string
	}): Promise<void> {
		await this.db.insert(activity).values({
			...entry,
			created_at: new Date().toISOString(),
		})
	}

	/** Get approval/rejection/reply activity for a specific task, ordered by time. */
	async listForTask(taskId: string): Promise<ActivityRow[]> {
		return this.db
			.select()
			.from(activity)
			.where(sql`json_extract(${activity.details}, '$.task_id') = ${taskId}`)
			.orderBy(activity.created_at)
			.all()
	}
}
