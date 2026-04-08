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

		return this.get(id) as Promise<SteerRow>
	}

	async get(id: string): Promise<SteerRow | undefined> {
		return _getSteer(this.db, id)
	}

	/** Get all pending steer messages for a run and mark them as delivered. */
	async claimPending(runId: string): Promise<SteerRow[]> {
		const now = new Date().toISOString()
		const pending = await this.db
			.select()
			.from(runSteers)
			.where(
				and(
					eq(runSteers.run_id, runId),
					eq(runSteers.status, 'pending'),
				),
			)
			.all()

		if (pending.length === 0) return []

		// Mark all as delivered
		for (const row of pending) {
			await this.db
				.update(runSteers)
				.set({ status: 'delivered', delivered_at: now })
				.where(eq(runSteers.id, row.id))
		}

		return pending
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
