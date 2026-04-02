import { eq, and } from 'drizzle-orm'
import { workers, workerLeases } from '../db/company-schema'
import type { CompanyDb } from '../db'

export type WorkerRow = typeof workers.$inferSelect
export type WorkerLeaseRow = typeof workerLeases.$inferSelect

export class WorkerService {
	constructor(private db: CompanyDb) {}

	// ─── Worker registration ───────────────────────────────────────────────

	async register(input: {
		id: string
		device_id?: string
		name?: string
		capabilities?: string
	}): Promise<WorkerRow | undefined> {
		const now = new Date().toISOString()

		// Upsert: if worker already exists, update heartbeat and set online
		const existing = await this.get(input.id)
		if (existing) {
			await this.db
				.update(workers)
				.set({
					status: 'online',
					last_heartbeat: now,
					device_id: input.device_id ?? existing.device_id,
					name: input.name ?? existing.name,
					capabilities: input.capabilities ?? existing.capabilities,
				})
				.where(eq(workers.id, input.id))
			return this.get(input.id)
		}

		await this.db.insert(workers).values({
			...input,
			status: 'online',
			capabilities: input.capabilities ?? '[]',
			registered_at: now,
			last_heartbeat: now,
		})
		return this.get(input.id)
	}

	async get(id: string): Promise<WorkerRow | undefined> {
		return this.db.select().from(workers).where(eq(workers.id, id)).get()
	}

	async list(filter?: { status?: string }): Promise<WorkerRow[]> {
		if (filter?.status) {
			return this.db.select().from(workers).where(eq(workers.status, filter.status)).all()
		}
		return this.db.select().from(workers).all()
	}

	/** Update heartbeat timestamp — called periodically by the worker. */
	async heartbeat(workerId: string): Promise<void> {
		await this.db
			.update(workers)
			.set({ last_heartbeat: new Date().toISOString() })
			.where(eq(workers.id, workerId))
	}

	/** Mark a worker as offline. */
	async setOffline(workerId: string): Promise<void> {
		await this.db.update(workers).set({ status: 'offline' }).where(eq(workers.id, workerId))
	}

	/** Mark a worker as busy. */
	async setBusy(workerId: string): Promise<void> {
		await this.db.update(workers).set({ status: 'busy' }).where(eq(workers.id, workerId))
	}

	/** Mark a worker as online (idle). */
	async setOnline(workerId: string): Promise<void> {
		await this.db.update(workers).set({ status: 'online' }).where(eq(workers.id, workerId))
	}

	/**
	 * Detect stale workers whose last heartbeat is older than `thresholdMs`
	 * and mark them offline.
	 */
	async expireStale(thresholdMs = 60_000): Promise<string[]> {
		const cutoff = new Date(Date.now() - thresholdMs).toISOString()
		const allOnline = await this.list({ status: 'online' })
		const stale = allOnline.filter((w) => w.last_heartbeat !== null && w.last_heartbeat < cutoff)
		for (const w of stale) {
			await this.setOffline(w.id)
		}
		return stale.map((w) => w.id)
	}

	// ─── Lease management ──────────────────────────────────────────────────

	async createLease(input: {
		id: string
		worker_id: string
		run_id: string
		expires_at: string
	}): Promise<WorkerLeaseRow | undefined> {
		await this.db.insert(workerLeases).values({
			...input,
			status: 'active',
			claimed_at: new Date().toISOString(),
		})
		return this.getLease(input.id)
	}

	async getLease(id: string): Promise<WorkerLeaseRow | undefined> {
		return this.db.select().from(workerLeases).where(eq(workerLeases.id, id)).get()
	}

	async getActiveLeaseForWorker(workerId: string): Promise<WorkerLeaseRow | undefined> {
		return this.db
			.select()
			.from(workerLeases)
			.where(and(eq(workerLeases.worker_id, workerId), eq(workerLeases.status, 'active')))
			.get()
	}

	async completeLease(leaseId: string, status: 'completed' | 'failed'): Promise<void> {
		await this.db.update(workerLeases).set({ status }).where(eq(workerLeases.id, leaseId))
	}

	/**
	 * Expire leases that have passed their expires_at timestamp.
	 * Returns the expired lease rows (with worker_id and run_id intact).
	 */
	async expireLeases(): Promise<WorkerLeaseRow[]> {
		const now = new Date().toISOString()
		const active = await this.db
			.select()
			.from(workerLeases)
			.where(eq(workerLeases.status, 'active'))
			.all()

		const expired = active.filter((l) => l.expires_at < now)
		for (const lease of expired) {
			await this.db
				.update(workerLeases)
				.set({ status: 'expired' })
				.where(eq(workerLeases.id, lease.id))
		}
		return expired
	}

	/**
	 * Expire stale leases and recover affected runs + workers.
	 *
	 * 1. Expires any leases past their `expires_at`
	 * 2. Marks the associated run as `failed` with error "lease expired"
	 * 3. For each affected worker with no remaining active leases, sets status back to `online`
	 */
	async expireStaleAndRecover(
		failRun: (runId: string) => Promise<void>,
	): Promise<{ expiredLeaseIds: string[]; failedRunIds: string[]; recoveredWorkerIds: string[] }> {
		const expired = await this.expireLeases()
		if (expired.length === 0) {
			return { expiredLeaseIds: [], failedRunIds: [], recoveredWorkerIds: [] }
		}

		const failedRunIds: string[] = []
		const affectedWorkerIds = new Set<string>()

		for (const lease of expired) {
			await failRun(lease.run_id)
			failedRunIds.push(lease.run_id)
			affectedWorkerIds.add(lease.worker_id)
		}

		// Recover workers that have no remaining active leases
		const recoveredWorkerIds: string[] = []
		for (const workerId of affectedWorkerIds) {
			const activeLease = await this.getActiveLeaseForWorker(workerId)
			if (!activeLease) {
				await this.setOnline(workerId)
				recoveredWorkerIds.push(workerId)
			}
		}

		return {
			expiredLeaseIds: expired.map((l) => l.id),
			failedRunIds,
			recoveredWorkerIds,
		}
	}
}
