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

	async listAll(relationType?: string): Promise<TaskRelationRow[]> {
		if (relationType) {
			return this.db
				.select()
				.from(taskRelations)
				.where(eq(taskRelations.relation_type, relationType))
				.all()
		}
		return this.db.select().from(taskRelations).all()
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

	// ─── Dependency helpers ─────────────────────────────────────────────

	/**
	 * Add a depends_on relation: taskId depends on dependsOnTaskId.
	 * Stored as source=taskId, target=dependsOnTaskId, relation_type=depends_on.
	 * Performs cycle detection before insertion.
	 */
	async addDependency(input: {
		task_id: string
		depends_on_task_id: string
		created_by: string
	}): Promise<TaskRelationRow | undefined> {
		// Cycle detection: check if dependsOn transitively depends on task
		const hasCycle = await this.wouldCreateCycle(input.task_id, input.depends_on_task_id)
		if (hasCycle) {
			throw new DependencyCycleError(
				`Adding dependency ${input.task_id} → ${input.depends_on_task_id} would create a cycle`,
			)
		}

		const id = `rel-dep-${Date.now()}-${input.task_id.slice(0, 8)}-${input.depends_on_task_id.slice(0, 8)}`
		return this.create({
			id,
			source_task_id: input.task_id,
			target_task_id: input.depends_on_task_id,
			relation_type: 'depends_on',
			created_by: input.created_by,
		})
	}

	/**
	 * List tasks that taskId depends on (outgoing depends_on edges).
	 */
	async listDependencies(taskId: string): Promise<TaskRelationRow[]> {
		return this.listBySource(taskId, 'depends_on')
	}

	/**
	 * List tasks that depend on taskId (incoming depends_on edges).
	 */
	async listDependents(taskId: string): Promise<TaskRelationRow[]> {
		return this.listByTarget(taskId, 'depends_on')
	}

	/**
	 * DFS cycle detection: would adding source→target create a cycle?
	 * Checks if target transitively reaches source via depends_on relations.
	 */
	private async wouldCreateCycle(source: string, target: string): Promise<boolean> {
		if (source === target) return true

		const visited = new Set<string>()
		const stack = [target]

		while (stack.length > 0) {
			const current = stack.pop()!
			if (current === source) return true
			if (visited.has(current)) continue
			visited.add(current)

			// Follow depends_on edges from current
			const deps = await this.listBySource(current, 'depends_on')
			for (const dep of deps) {
				stack.push(dep.target_task_id)
			}
		}

		return false
	}
}

export class DependencyCycleError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'DependencyCycleError'
	}
}
