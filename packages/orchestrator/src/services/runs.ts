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
		resumed_from_run_id?: string
		runtime_session_ref?: string
		preferred_worker_id?: string
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

	/** Claim the oldest pending run for a worker. Respects preferred_worker_id for continuation runs. */
	async claim(workerId: string, runtime?: string): Promise<RunRow | undefined> {
		const conditions = [eq(runs.status, 'pending')]
		if (runtime) conditions.push(eq(runs.runtime, runtime))

		const pending = await this.db
			.select()
			.from(runs)
			.where(and(...conditions))
			.all()

		if (pending.length === 0) return undefined

		// Find a run this worker can claim:
		// 1. Continuation runs with preferred_worker_id only go to that worker
		// 2. Regular runs go to any worker
		const claimable = pending.find((r) => {
			if (r.preferred_worker_id) {
				return r.preferred_worker_id === workerId
			}
			return true
		})

		if (!claimable) return undefined

		// Attempt to claim — the WHERE guards against races
		const result = await this.db
			.update(runs)
			.set({
				status: 'claimed',
				worker_id: workerId,
				started_at: new Date().toISOString(),
			})
			.where(and(eq(runs.id, claimable.id), eq(runs.status, 'pending')))

		// If no rows changed, someone else claimed it
		if (result.rowsAffected === 0) return undefined

		return this.get(claimable.id)
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

	/** Complete a run with final status, optional summary/tokens, and session ref. */
	async complete(
		runId: string,
		result: {
			status: 'completed' | 'failed'
			summary?: string
			tokens_input?: number
			tokens_output?: number
			error?: string
			runtime_session_ref?: string
			resumable?: boolean
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
				runtime_session_ref: result.runtime_session_ref,
				resumable: result.resumable ?? false,
			})
			.where(eq(runs.id, runId))
		return this.get(runId)
	}

	/**
	 * Create a continuation run from an existing completed/failed run.
	 * The new run inherits agent, task, runtime, and session lineage.
	 * It is routed to the same worker via preferred_worker_id.
	 */
	async createContinuation(
		originalRunId: string,
		input: {
			message: string
			initiated_by?: string
		},
	): Promise<RunRow | undefined> {
		const original = await this.get(originalRunId)
		if (!original) return undefined

		// Only completed/failed runs can be continued
		if (original.status !== 'completed' && original.status !== 'failed') {
			return undefined
		}

		const id = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
		const now = new Date().toISOString()

		await this.db.insert(runs).values({
			id,
			agent_id: original.agent_id,
			task_id: original.task_id,
			runtime: original.runtime,
			status: 'pending',
			initiated_by: input.initiated_by ?? original.initiated_by,
			instructions: input.message,
			resumed_from_run_id: originalRunId,
			runtime_session_ref: original.runtime_session_ref,
			preferred_worker_id: original.worker_id,
			created_at: now,
		})

		return this.get(id)
	}
}
