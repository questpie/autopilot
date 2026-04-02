import { eq, and } from 'drizzle-orm'
import { workflowRuns } from '../db/company-schema'
import type { CompanyDb } from '../db'

export type WorkflowRunRow = typeof workflowRuns.$inferSelect

/**
 * Workflow run service — tracks workflow execution state in the DB.
 *
 * The actual workflow logic (step resolution, transitions, validation)
 * lives in `../workflow/engine.ts`. This service only manages the
 * persistent run records.
 */
export class WorkflowRunService {
	constructor(private db: CompanyDb) {}

	async create(input: {
		id: string
		task_id: string
		workflow_id: string
		current_step?: string
	}): Promise<WorkflowRunRow | undefined> {
		const now = new Date().toISOString()
		await this.db.insert(workflowRuns).values({
			...input,
			status: 'pending',
			created_at: now,
			updated_at: now,
		})
		return this.get(input.id)
	}

	async get(id: string): Promise<WorkflowRunRow | undefined> {
		return this.db.select().from(workflowRuns).where(eq(workflowRuns.id, id)).get()
	}

	async getByTask(taskId: string): Promise<WorkflowRunRow | undefined> {
		return this.db
			.select()
			.from(workflowRuns)
			.where(eq(workflowRuns.task_id, taskId))
			.get()
	}

	async list(filter?: {
		workflow_id?: string
		status?: string
	}): Promise<WorkflowRunRow[]> {
		const conditions = []
		if (filter?.workflow_id) conditions.push(eq(workflowRuns.workflow_id, filter.workflow_id))
		if (filter?.status) conditions.push(eq(workflowRuns.status, filter.status))

		if (conditions.length === 0) {
			return this.db.select().from(workflowRuns).all()
		}
		if (conditions.length === 1) {
			return this.db.select().from(workflowRuns).where(conditions[0]!).all()
		}
		return this.db
			.select()
			.from(workflowRuns)
			.where(and(...conditions))
			.all()
	}

	/** Advance the workflow run to a new step. */
	async advanceStep(runId: string, stepId: string): Promise<WorkflowRunRow | undefined> {
		await this.db
			.update(workflowRuns)
			.set({
				current_step: stepId,
				status: 'running',
				updated_at: new Date().toISOString(),
			})
			.where(eq(workflowRuns.id, runId))
		return this.get(runId)
	}

	/** Complete a workflow run. */
	async complete(runId: string, status: 'completed' | 'failed'): Promise<WorkflowRunRow | undefined> {
		await this.db
			.update(workflowRuns)
			.set({
				status,
				updated_at: new Date().toISOString(),
			})
			.where(eq(workflowRuns.id, runId))
		return this.get(runId)
	}
}
