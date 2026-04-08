import { randomBytes } from 'node:crypto'
import { eq, and } from 'drizzle-orm'
import { runSteers } from '../db/company-schema'
import type { CompanyDb } from '../db'

function _getSteer(db: CompanyDb, id: string) {
	return db.select().from(runSteers).where(eq(runSteers.id, id)).get()
}

export type SteerRow = NonNullable<Awaited<ReturnType<typeof _getSteer>>>

export class SteerService {
	constructor(private db: CompanyDb) {}

	/** Create a pending steer message for a run. */
	async create(input: {
		run_id: string
		message: string
		created_by: string
	}): Promise<SteerRow> {
		const id = `steer-${Date.now()}-${randomBytes(6).toString('hex')}`
		const now = new Date().toISOString()

		await this.db.insert(runSteers).values({
			id,
			run_id: input.run_id,
			message: input.message,
			status: 'pending',
			created_by: input.created_by,
			created_at: now,
		})

		const row = await this.get(id)
		if (!row) throw new Error(`Failed to read back steer ${id} after insert`)
		return row
	}

	async get(id: string): Promise<SteerRow | undefined> {
		return _getSteer(this.db, id)
	}

	/**
	 * Atomically claim all pending steer messages for a run.
	 * Marks them as delivered and returns the claimed rows.
	 * Selects pending IDs first, then updates and reads back by those IDs
	 * to avoid flakes when two claims share the same millisecond.
	 */
	async claimPending(runId: string): Promise<SteerRow[]> {
		// 1. Select pending steer IDs for this run
		const pending = await this.db
			.select({ id: runSteers.id })
			.from(runSteers)
			.where(
				and(
					eq(runSteers.run_id, runId),
					eq(runSteers.status, 'pending'),
				),
			)

		if (pending.length === 0) return []

		const ids = pending.map((r) => r.id)
		const now = new Date().toISOString()

		// 2. Update only those specific IDs
		for (const id of ids) {
			await this.db
				.update(runSteers)
				.set({ status: 'delivered', delivered_at: now })
				.where(eq(runSteers.id, id))
		}

		// 3. Read back the claimed rows by ID
		const result: SteerRow[] = []
		for (const id of ids) {
			const row = await this.db.select().from(runSteers).where(eq(runSteers.id, id)).get()
			if (row) result.push(row)
		}
		return result
	}

	/** List all steer messages for a run. */
	async listForRun(runId: string): Promise<SteerRow[]> {
		return this.db
			.select()
			.from(runSteers)
			.where(eq(runSteers.run_id, runId))
			.all()
	}
}
