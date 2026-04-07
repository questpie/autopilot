import { eq, and } from 'drizzle-orm'
import { workers, workerLeases } from '../db/company-schema'
import type { CompanyDb } from '../db'

function _getWorker(db: CompanyDb, id: string) {
	return db.select().from(workers).where(eq(workers.id, id)).get()
}

function _getLease(db: CompanyDb, id: string) {
	return db.select().from(workerLeases).where(eq(workerLeases.id, id)).get()
}

export type WorkerRow = NonNullable<Awaited<ReturnType<typeof _getWorker>>>
export type WorkerLeaseRow = NonNullable<Awaited<ReturnType<typeof _getLease>>>

export class WorkerService {
	constructor(private db: CompanyDb) {}

	// ─── Worker registration ───────────────────────────────────────────────

	async register(input: {
		id: string
		device_id?: string
		name?: string
		capabilities?: string
	}) {
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

	async get(id: string) {
		return _getWorker(this.db, id)
	}

	async list(filter?: { status?: string }) {
		if (filter?.status) {
			return this.db.select().from(workers).where(eq(workers.status, filter.status)).all()
		}
		return this.db.select().from(workers).all()
	}

	/** Update heartbeat timestamp and renew all active leases for this worker. */
	async heartbeat(workerId: string): Promise<void> {
		const now = new Date().toISOString()
		await this.db
			.update(workers)
			.set({ last_heartbeat: now })
			.where(eq(workers.id, workerId))

		// Renew all active leases — extend by 30 min from now
		const activeLeases = await this.getActiveLeasesForWorker(workerId)
		if (activeLeases.length > 0) {
			const newExpiry = new Date(Date.now() + 30 * 60 * 1000).toISOString()
			for (const lease of activeLeases) {
				await this.db
					.update(workerLeases)
					.set({ expires_at: newExpiry })
					.where(eq(workerLeases.id, lease.id))
			}
		}
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
	}) {
		await this.db.insert(workerLeases).values({
			...input,
			status: 'active',
			claimed_at: new Date().toISOString(),
		})
		return this.getLease(input.id)
	}

	async getLease(id: string) {
		return _getLease(this.db, id)
	}

	async getActiveLeaseForWorker(workerId: string) {
		return this.db
			.select()
			.from(workerLeases)
			.where(and(eq(workerLeases.worker_id, workerId), eq(workerLeases.status, 'active')))
			.get()
	}

	/** Get all active leases for a worker (for concurrency-aware scheduling). */
	async getActiveLeasesForWorker(workerId: string) {
		return this.db
			.select()
			.from(workerLeases)
			.where(and(eq(workerLeases.worker_id, workerId), eq(workerLeases.status, 'active')))
			.all()
	}

	/** Count active leases for a worker. */
	async getActiveLeaseCountForWorker(workerId: string): Promise<number> {
		const leases = await this.getActiveLeasesForWorker(workerId)
		return leases.length
	}

	/** Get the max concurrent runs a worker advertises (from capabilities JSON). */
	getMaxConcurrentFromCapabilities(capabilitiesJson: string | null): number {
		if (!capabilitiesJson) return 1
		try {
			const caps = JSON.parse(capabilitiesJson) as Array<{ maxConcurrent?: number }>
			if (!Array.isArray(caps) || caps.length === 0) return 1
			// Use the max across all runtime capabilities
			return Math.max(...caps.map((c) => c.maxConcurrent ?? 1))
		} catch {
			return 1
		}
	}

	/** Find the active lease for a specific run on a specific worker. */
	async getActiveLeaseForRun(workerId: string, runId: string) {
		return this.db
			.select()
			.from(workerLeases)
			.where(
				and(
					eq(workerLeases.worker_id, workerId),
					eq(workerLeases.run_id, runId),
					eq(workerLeases.status, 'active'),
				),
			)
			.get()
	}

	async completeLease(leaseId: string, status: 'completed' | 'failed'): Promise<void> {
		await this.db.update(workerLeases).set({ status }).where(eq(workerLeases.id, leaseId))
	}

	/**
	 * Expire leases that have passed their expires_at timestamp.
	 * Returns the expired lease rows (with worker_id and run_id intact).
	 */
	async expireLeases() {
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
