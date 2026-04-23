import { randomBytes } from 'node:crypto'
import { ExecutionTargetSchema } from '@questpie/autopilot-spec'
import type { WorkerCapability } from '@questpie/autopilot-spec'
import { and, asc, eq, gt } from 'drizzle-orm'
import type { CompanyDb } from '../db'
import { runEvents, runs } from '../db/company-schema'

function _getRun(db: CompanyDb, id: string) {
	return db.select().from(runs).where(eq(runs.id, id)).get()
}

function _getRunEvents(db: CompanyDb, runId: string) {
	return db
		.select()
		.from(runEvents)
		.where(eq(runEvents.run_id, runId))
		.orderBy(asc(runEvents.id))
		.all()
}

export type RunRow = NonNullable<Awaited<ReturnType<typeof _getRun>>>
export type RunEventRow = Awaited<ReturnType<typeof _getRunEvents>>[number]

export class RunService {
	constructor(private db: CompanyDb) {}

	async create(input: {
		id: string
		agent_id: string
		task_id?: string
		project_id?: string
		runtime: string
		model?: string
		provider?: string
		variant?: string
		initiated_by?: string
		instructions?: string
		resumed_from_run_id?: string
		runtime_session_ref?: string
		preferred_worker_id?: string
		targeting?: string
	}) {
		const now = new Date().toISOString()
		await this.db.insert(runs).values({
			...input,
			status: 'pending',
			created_at: now,
		})
		return this.get(input.id)
	}

	async get(id: string) {
		return _getRun(this.db, id)
	}

	async list(filter?: {
		status?: string
		worker_id?: string
		agent_id?: string
		task_id?: string
	}) {
		const conditions = []
		if (filter?.status) conditions.push(eq(runs.status, filter.status))
		if (filter?.worker_id) conditions.push(eq(runs.worker_id, filter.worker_id))
		if (filter?.agent_id) conditions.push(eq(runs.agent_id, filter.agent_id))
		if (filter?.task_id) conditions.push(eq(runs.task_id, filter.task_id))

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

	/** Claim the oldest pending run for a worker. Filters by targeting constraints. */
	async claim(
		workerId: string,
		runtime?: string,
		workerCapabilities?: WorkerCapability[],
		options?: { excludeRunIds?: string[] },
	) {
		const conditions = [eq(runs.status, 'pending')]
		if (runtime) conditions.push(eq(runs.runtime, runtime))

		const pending = await this.db
			.select()
			.from(runs)
			.where(and(...conditions))
			.all()

		if (pending.length === 0) return undefined
		const excluded = new Set(options?.excludeRunIds ?? [])

		// Build a flat set of tags this worker advertises (runtimes + models + explicit tags)
		const workerTags = new Set<string>()
		for (const cap of workerCapabilities ?? []) {
			workerTags.add(cap.runtime)
			for (const m of cap.models) workerTags.add(m)
			for (const t of cap.tags ?? []) workerTags.add(t)
		}

		const claimable = pending.find(
			(r) => !excluded.has(r.id) && isEligible(r, workerId, workerTags),
		)

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

	/** Release a claimed run back to pending so another claim attempt can evaluate it later. */
	async releaseClaim(runId: string): Promise<void> {
		await this.db
			.update(runs)
			.set({
				status: 'pending',
				worker_id: null,
				started_at: null,
			})
			.where(and(eq(runs.id, runId), eq(runs.status, 'claimed')))
	}

	/** Transition a claimed run to running. */
	async start(runId: string) {
		await this.db
			.update(runs)
			.set({ status: 'running', started_at: new Date().toISOString() })
			.where(eq(runs.id, runId))
		return this.get(runId)
	}

	private static CANCELLABLE_STATUSES = new Set(['pending', 'claimed', 'running'])

	/** Cancel a pending, claimed, or running run. Returns the updated run or undefined if not cancellable. */
	async cancel(runId: string, reason?: string) {
		const run = await this.get(runId)
		if (!run || !RunService.CANCELLABLE_STATUSES.has(run.status)) return undefined
		await this.db
			.update(runs)
			.set({
				status: 'failed',
				error: reason ?? 'cancelled by operator',
				ended_at: new Date().toISOString(),
			})
			.where(eq(runs.id, runId))
		return this.get(runId)
	}

	/** Update the instructions for a run. */
	async updateInstructions(runId: string, instructions: string) {
		await this.db.update(runs).set({ instructions }).where(eq(runs.id, runId))
		return this.get(runId)
	}

	/** Append a compact event to a run. */
	async appendEvent(runId: string, event: { type: string; summary?: string; metadata?: string }) {
		const createdAt = new Date().toISOString()
		const rows = await this.db
			.insert(runEvents)
			.values({
				run_id: runId,
				type: event.type,
				summary: event.summary,
				metadata: event.metadata ?? '{}',
				created_at: createdAt,
			})
			.returning()
		return rows[0]
	}

	/** Get events for a run, ordered by creation time. */
	async getEvents(runId: string) {
		return _getRunEvents(this.db, runId)
	}

	/** Get events for a run strictly after a persisted event ID. */
	async getEventsSince(runId: string, lastEventId: number) {
		return this.db
			.select()
			.from(runEvents)
			.where(and(eq(runEvents.run_id, runId), gt(runEvents.id, lastEventId)))
			.orderBy(asc(runEvents.id))
			.all()
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
	) {
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
	) {
		const original = await this.get(originalRunId)
		if (!original) return undefined

		// Only completed/failed runs can be continued
		if (original.status !== 'completed' && original.status !== 'failed') {
			return undefined
		}

		const id = `run-${Date.now()}-${randomBytes(6).toString('hex')}`
		const now = new Date().toISOString()

		await this.db.insert(runs).values({
			id,
			agent_id: original.agent_id,
			task_id: original.task_id,
			project_id: original.project_id,
			runtime: original.runtime,
			model: original.model,
			provider: original.provider,
			variant: original.variant,
			status: 'pending',
			initiated_by: input.initiated_by ?? original.initiated_by,
			instructions: input.message,
			resumed_from_run_id: originalRunId,
			runtime_session_ref: original.runtime_session_ref,
			preferred_worker_id: original.worker_id,
			targeting: original.targeting,
			created_at: now,
		})

		return this.get(id)
	}
}

// ─── Targeting ──────────────────────────────────────────────────────────────

/** Check if a worker is eligible to claim a run based on continuation and targeting constraints. */
function isEligible(run: RunRow, workerId: string, workerTags: Set<string>): boolean {
	// Continuation runs with preferred_worker_id only go to that worker
	if (run.preferred_worker_id) {
		if (run.preferred_worker_id !== workerId) {
			logSkip(run.id, workerId, `continuation pinned to ${run.preferred_worker_id}`)
			return false
		}
		return true
	}

	if (!run.targeting) return true

	let raw: unknown
	try {
		raw = JSON.parse(run.targeting)
	} catch (err) {
		console.warn(
			`[targeting] run=${run.id} malformed targeting JSON, treating as unconstrained:`,
			err,
		)
		return true
	}

	const parsed = ExecutionTargetSchema.safeParse(raw)
	if (!parsed.success) {
		console.warn(`[targeting] run=${run.id} invalid targeting schema:`, parsed.error.message)
		return true
	}

	const t = parsed.data
	const allowFallback = t.allow_fallback !== false

	// Hard pin — required_worker_id is never relaxed by allow_fallback
	if (t.required_worker_id && t.required_worker_id !== workerId) {
		logSkip(run.id, workerId, `required_worker_id is ${t.required_worker_id}`)
		return false
	}
	if (t.required_runtime && !workerTags.has(t.required_runtime) && !allowFallback) {
		logSkip(
			run.id,
			workerId,
			`requires runtime "${t.required_runtime}", worker has [${[...workerTags]}]`,
		)
		return false
	}
	if (t.required_worker_tags?.length) {
		const missing = t.required_worker_tags.filter((tag) => !workerTags.has(tag))
		if (missing.length > 0 && !allowFallback) {
			logSkip(run.id, workerId, `missing worker tags: [${missing}]`)
			return false
		}
	}

	return true
}

function logSkip(runId: string, workerId: string, reason: string): void {
	console.log(`[targeting] skip run=${runId} worker=${workerId}: ${reason}`)
}
