import { eq, and } from 'drizzle-orm'
import { taskRelations } from '../db/company-schema'
import type { CompanyDb } from '../db'

function _getRelation(db: CompanyDb, id: string) {
	return db.select().from(taskRelations).where(eq(taskRelations.id, id)).get()
}

export type TaskRelationRow = NonNullable<Awaited<ReturnType<typeof _getRelation>>>

export class TaskRelationService {
	constructor(private db: CompanyDb) {}

	async create(input: {
		id: string
		source_task_id: string
		target_task_id: string
		relation_type: string
		dedupe_key?: string
		origin_run_id?: string
		created_by: string
		metadata?: string
	}): Promise<TaskRelationRow | undefined> {
		const now = new Date().toISOString()
		await this.db.insert(taskRelations).values({
			...input,
			metadata: input.metadata ?? '{}',
			created_at: now,
		}).onConflictDoNothing()
		// Return the relation — may be existing if conflict on edge or dedupe_key
		const byEdge = await this.findByEdge(input.source_task_id, input.target_task_id, input.relation_type)
		if (byEdge) return byEdge
		if (input.dedupe_key) {
			return this.findByDedupeKey(input.source_task_id, input.relation_type, input.dedupe_key)
		}
		return undefined
	}

	async get(id: string): Promise<TaskRelationRow | undefined> {
		return _getRelation(this.db, id)
	}

	async findByEdge(sourceTaskId: string, targetTaskId: string, relationType: string): Promise<TaskRelationRow | undefined> {
		return this.db
			.select()
			.from(taskRelations)
			.where(
				and(
					eq(taskRelations.source_task_id, sourceTaskId),
					eq(taskRelations.target_task_id, targetTaskId),
					eq(taskRelations.relation_type, relationType),
				),
			)
			.get()
	}

	/** Find a relation by source + dedupe_key. Returns undefined if dedupe_key is null or no match. */
	async findByDedupeKey(sourceTaskId: string, relationType: string, dedupeKey: string): Promise<TaskRelationRow | undefined> {
		return this.db
			.select()
			.from(taskRelations)
			.where(
				and(
					eq(taskRelations.source_task_id, sourceTaskId),
					eq(taskRelations.relation_type, relationType),
					eq(taskRelations.dedupe_key, dedupeKey),
				),
			)
			.get()
	}

	async listBySource(sourceTaskId: string, relationType?: string): Promise<TaskRelationRow[]> {
		const conditions = [eq(taskRelations.source_task_id, sourceTaskId)]
		if (relationType) conditions.push(eq(taskRelations.relation_type, relationType))
		return this.db
			.select()
			.from(taskRelations)
			.where(and(...conditions))
			.all()
	}

	async listByTarget(targetTaskId: string, relationType?: string): Promise<TaskRelationRow[]> {
		const conditions = [eq(taskRelations.target_task_id, targetTaskId)]
		if (relationType) conditions.push(eq(taskRelations.relation_type, relationType))
		return this.db
			.select()
			.from(taskRelations)
			.where(and(...conditions))
			.all()
	}

	async exists(sourceTaskId: string, targetTaskId: string, relationType: string): Promise<boolean> {
		const row = await this.findByEdge(sourceTaskId, targetTaskId, relationType)
		return row !== undefined
	}

	async delete(id: string): Promise<void> {
		await this.db.delete(taskRelations).where(eq(taskRelations.id, id))
	}
}
