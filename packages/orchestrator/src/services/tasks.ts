import { eq, and } from 'drizzle-orm'
import { tasks } from '../db/company-schema'
import type { CompanyDb } from '../db'

export type TaskRow = typeof tasks.$inferSelect
export type TaskInsert = typeof tasks.$inferInsert

export class TaskService {
	constructor(private db: CompanyDb) {}

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
		created_by: string
	}): Promise<TaskRow | undefined> {
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

	async get(id: string): Promise<TaskRow | undefined> {
		return this.db.select().from(tasks).where(eq(tasks.id, id)).get()
	}

	async list(filter?: {
		status?: string
		assigned_to?: string
		workflow_id?: string
	}): Promise<TaskRow[]> {
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
		}>,
	): Promise<TaskRow | undefined> {
		await this.db
			.update(tasks)
			.set({ ...updates, updated_at: new Date().toISOString() })
			.where(eq(tasks.id, id))
		return this.get(id)
	}

	async delete(id: string): Promise<void> {
		await this.db.delete(tasks).where(eq(tasks.id, id))
	}
}
