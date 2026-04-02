import { Hono } from 'hono'
import { validator as zValidator } from 'hono-openapi'
import { z } from 'zod'
import type { AppEnv } from '../app'
import { eventBus } from '../../events/event-bus'

const workers = new Hono<AppEnv>()
	// POST /workers/register — register a worker
	.post(
		'/register',
		zValidator(
			'json',
			z.object({
				id: z.string().min(1),
				device_id: z.string().optional(),
				name: z.string().optional(),
				capabilities: z.array(z.string()).optional(),
			}),
		),
		async (c) => {
			const { workerService } = c.get('services')
			const body = c.req.valid('json')
			const worker = await workerService.register({
				...body,
				capabilities: body.capabilities ? JSON.stringify(body.capabilities) : undefined,
			})
			if (!worker) return c.json({ error: 'failed to register worker' }, 500)

			eventBus.emit({ type: 'worker_registered', workerId: body.id })

			return c.json(worker, 201)
		},
	)
	// POST /workers/heartbeat — worker heartbeat
	.post(
		'/heartbeat',
		zValidator('json', z.object({ worker_id: z.string().min(1) })),
		async (c) => {
			const { workerService } = c.get('services')
			const { worker_id } = c.req.valid('json')
			await workerService.heartbeat(worker_id)
			return c.json({ ok: true as const }, 200)
		},
	)
	// POST /workers/claim — claim next pending run
	.post(
		'/claim',
		zValidator(
			'json',
			z.object({
				worker_id: z.string().min(1),
				runtime: z.string().optional(),
			}),
		),
		async (c) => {
			const { runService, workerService } = c.get('services')
			const { worker_id, runtime } = c.req.valid('json')

			const run = await runService.claim(worker_id, runtime)
			if (!run) return c.json({ error: 'no pending runs' }, 404)

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

			return c.json(run, 200)
		},
	)
	// POST /workers/deregister — deregister a worker
	.post(
		'/deregister',
		zValidator('json', z.object({ worker_id: z.string().min(1) })),
		async (c) => {
			const { workerService } = c.get('services')
			const { worker_id } = c.req.valid('json')
			await workerService.setOffline(worker_id)

			eventBus.emit({ type: 'worker_offline', workerId: worker_id })

			return c.json({ ok: true as const }, 200)
		},
	)

export { workers }
