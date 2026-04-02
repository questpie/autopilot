import { Hono } from 'hono'
import { validator as zValidator } from 'hono-openapi'
import {
	WorkerRegisterRequestSchema,
	WorkerHeartbeatRequestSchema,
	WorkerClaimRequestSchema,
	WorkerDeregisterRequestSchema,
} from '@questpie/autopilot-spec'
import type { AppEnv } from '../app'
import { eventBus } from '../../events/event-bus'

const workers = new Hono<AppEnv>()
	// POST /workers/register — register a worker
	.post('/register', zValidator('json', WorkerRegisterRequestSchema), async (c) => {
		const { workerService } = c.get('services')
		const body = c.req.valid('json')
		const worker = await workerService.register({
			...body,
			capabilities: JSON.stringify(body.capabilities),
		})
		if (!worker) return c.json({ error: 'failed to register worker' }, 500)

		eventBus.emit({ type: 'worker_registered', workerId: body.id })

		return c.json({ workerId: worker.id, status: worker.status }, 201)
	})
	// POST /workers/heartbeat — worker heartbeat
	.post('/heartbeat', zValidator('json', WorkerHeartbeatRequestSchema), async (c) => {
		const { workerService } = c.get('services')
		const { worker_id } = c.req.valid('json')
		await workerService.heartbeat(worker_id)
		return c.json({ ok: true as const }, 200)
	})
	// POST /workers/claim — claim next pending run (one-at-a-time)
	.post('/claim', zValidator('json', WorkerClaimRequestSchema), async (c) => {
		const { runService, workerService, taskService } = c.get('services')
		const { worker_id, runtime } = c.req.valid('json')

		// Expire stale leases before checking — prevents crashed workers from being stuck forever
		await workerService.expireStaleAndRecover(async (runId) => {
			await runService.complete(runId, { status: 'failed', error: 'lease expired' })
		})

		// Recover worker status if it has no remaining active leases (e.g. stuck as busy)
		const activeLease = await workerService.getActiveLeaseForWorker(worker_id)
		if (!activeLease) {
			await workerService.setOnline(worker_id)
		}

		// Concurrency guard: if worker already has an active lease, reject
		if (activeLease) {
			return c.json({ run: null, lease_id: null }, 200)
		}

		const run = await runService.claim(worker_id, runtime)
		if (!run) return c.json({ run: null, lease_id: null }, 200)

		// Create a lease for the claimed run
		const leaseId = `lease-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
		const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 min
		await workerService.createLease({
			id: leaseId,
			worker_id,
			run_id: run.id,
			expires_at: expiresAt,
		})
		await workerService.setBusy(worker_id)

		// Look up task context if task_id exists
		let taskTitle: string | null = null
		let taskDescription: string | null = null
		if (run.task_id) {
			const task = await taskService.get(run.task_id)
			if (task) {
				taskTitle = task.title
				taskDescription = task.description ?? null
			}
		}

		return c.json(
			{
				run: {
					id: run.id,
					agent_id: run.agent_id,
					task_id: run.task_id,
					runtime: run.runtime,
					status: run.status,
					task_title: taskTitle,
					task_description: taskDescription,
					instructions: run.instructions ?? null,
				},
				lease_id: leaseId,
			},
			200,
		)
	})
	// POST /workers/deregister — deregister a worker
	.post('/deregister', zValidator('json', WorkerDeregisterRequestSchema), async (c) => {
		const { workerService } = c.get('services')
		const { worker_id } = c.req.valid('json')
		await workerService.setOffline(worker_id)

		eventBus.emit({ type: 'worker_offline', workerId: worker_id })

		return c.json({ ok: true as const }, 200)
	})

export { workers }
