import { sql } from 'drizzle-orm'
import { activity } from '../db/company-schema'
import type { CompanyDb } from '../db'

function _listActivityForTask(db: CompanyDb, taskId: string) {
	return db
		.select()
		.from(activity)
		.where(sql`json_extract(${activity.details}, '$.task_id') = ${taskId}`)
		.orderBy(activity.created_at)
		.all()
}

export type ActivityRow = Awaited<ReturnType<typeof _listActivityForTask>>[number]

export class ActivityService {
	constructor(private db: CompanyDb) {}

	async log(entry: {
		actor: string
		type: string
		summary: string
		details?: string
	}) {
		await this.db.insert(activity).values({
			...entry,
			created_at: new Date().toISOString(),
		})
	}

	/** Get approval/rejection/reply activity for a specific task, ordered by time. */
	async listForTask(taskId: string) {
		return _listActivityForTask(this.db, taskId)
	}
}
