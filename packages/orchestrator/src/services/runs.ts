import { eq, and } from 'drizzle-orm'
import { runs, runEvents } from '../db/company-schema'
import type { CompanyDb } from '../db'

export type RunRow = typeof runs.$inferSelect
export type RunEventRow = typeof runEvents.$inferSelect

export class RunService {
	constructor(private db: CompanyDb) {}

	async create(input: {
		id: string
		agent_id: string
		task_id?: string
		runtime: string
		initiated_by?: string
		instructions?: string
	}): Promise<RunRow | undefined> {
		const now = new Date().toISOString()
		await this.db.insert(runs).values({
			...input,
			status: 'pending',
			created_at: now,
		})
		return this.get(input.id)
	}

	async get(id: string): Promise<RunRow | undefined> {
		return this.db.select().from(runs).where(eq(runs.id, id)).get()
	}

	async list(filter?: { status?: string; worker_id?: string; agent_id?: string }): Promise<RunRow[]> {
		const conditions = []
		if (filter?.status) conditions.push(eq(runs.status, filter.status))
		if (filter?.worker_id) conditions.push(eq(runs.worker_id, filter.worker_id))
		if (filter?.agent_id) conditions.push(eq(runs.agent_id, filter.agent_id))

		if (conditions.length === 0) {
			return this.db.select().from(runs).all()
		}
		if (conditions.length === 1) {
			return this.db.select().from(runs).where(conditions[0]!).all()
		}
		return this.db
			.select()
			.from(runs)
			.where(and(...conditions))
			.all()
	}

	/** Claim the oldest pending run for a worker. Optionally filter by runtime. */
	async claim(workerId: string, runtime?: string): Promise<RunRow | undefined> {
		const conditions = [eq(runs.status, 'pending')]
		if (runtime) conditions.push(eq(runs.runtime, runtime))

		const pending = await this.db
			.select()
			.from(runs)
			.where(and(...conditions))
			.all()

		if (pending.length === 0) return undefined
		const run = pending[0]!

		// Attempt to claim — the WHERE guards against races
		const result = await this.db
			.update(runs)
			.set({
				status: 'claimed',
				worker_id: workerId,
				started_at: new Date().toISOString(),
			})
			.where(and(eq(runs.id, run.id), eq(runs.status, 'pending')))

		// If no rows changed, someone else claimed it
		if (result.rowsAffected === 0) return undefined

		return this.get(run.id)
	}

	/** Transition a claimed run to running. */
	async start(runId: string): Promise<RunRow | undefined> {
		await this.db
			.update(runs)
			.set({ status: 'running', started_at: new Date().toISOString() })
			.where(eq(runs.id, runId))
		return this.get(runId)
	}

	/** Append a compact event to a run. */
	async appendEvent(
		runId: string,
		event: { type: string; summary?: string; metadata?: string },
	): Promise<void> {
		await this.db.insert(runEvents).values({
			run_id: runId,
			type: event.type,
			summary: event.summary,
			metadata: event.metadata ?? '{}',
			created_at: new Date().toISOString(),
		})
	}

	/** Get events for a run, ordered by creation time. */
	async getEvents(runId: string): Promise<RunEventRow[]> {
		return this.db.select().from(runEvents).where(eq(runEvents.run_id, runId)).all()
	}

	/** Complete a run with final status and optional summary/token counts. */
	async complete(
		runId: string,
		result: {
			status: 'completed' | 'failed'
			summary?: string
			tokens_input?: number
			tokens_output?: number
			error?: string
		},
	): Promise<RunRow | undefined> {
		await this.db
			.update(runs)
			.set({
				status: result.status,
				summary: result.summary,
				tokens_input: result.tokens_input ?? 0,
				tokens_output: result.tokens_output ?? 0,
				error: result.error,
				ended_at: new Date().toISOString(),
			})
			.where(eq(runs.id, runId))
		return this.get(runId)
	}
}
