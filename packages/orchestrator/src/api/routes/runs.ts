import { Hono } from 'hono'
import { validator as zValidator } from 'hono-openapi'
import { z } from 'zod'
import {
	WorkerEventSchema,
	RunCompletionSchema,
	CreateRunRequestSchema,
} from '@questpie/autopilot-spec'
import type { AppEnv } from '../app'
import { eventBus } from '../../events/event-bus'

const runs = new Hono<AppEnv>()
	// GET /runs — list runs (optional status/agent filter)
	.get(
		'/',
		zValidator(
			'query',
			z.object({
				status: z.string().optional(),
				agent_id: z.string().optional(),
			}),
		),
		async (c) => {
			const { runService } = c.get('services')
			const filter = c.req.valid('query')
			const result = await runService.list(filter)
			return c.json(result, 200)
		},
	)
	// GET /runs/:id — get run detail
	.get(
		'/:id',
		zValidator('param', z.object({ id: z.string() })),
		async (c) => {
			const { runService } = c.get('services')
			const { id } = c.req.valid('param')
			const run = await runService.get(id)
			if (!run) return c.json({ error: 'run not found' }, 404)
			return c.json(run, 200)
		},
	)
	// GET /runs/:id/events — get run events
	.get(
		'/:id/events',
		zValidator('param', z.object({ id: z.string() })),
		async (c) => {
			const { runService } = c.get('services')
			const { id } = c.req.valid('param')
			const run = await runService.get(id)
			if (!run) return c.json({ error: 'run not found' }, 404)
			const events = await runService.getEvents(id)
			return c.json(events, 200)
		},
	)
	// POST /runs — create a new pending run
	.post('/', zValidator('json', CreateRunRequestSchema), async (c) => {
		const { runService } = c.get('services')
		const actor = c.get('actor')
		const body = c.req.valid('json')
		const id = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
		const run = await runService.create({
			id,
			...body,
			initiated_by: body.initiated_by ?? actor?.id ?? 'system',
		})
		if (!run) return c.json({ error: 'failed to create run' }, 500)

		eventBus.emit({
			type: 'task_changed',
			taskId: body.task_id ?? id,
			status: 'pending',
		})

		return c.json(run, 201)
	})
	// POST /runs/:id/events — append event (from worker)
	.post(
		'/:id/events',
		zValidator('param', z.object({ id: z.string() })),
		zValidator('json', WorkerEventSchema),
		async (c) => {
			const { runService } = c.get('services')
			const { id } = c.req.valid('param')
			const body = c.req.valid('json')

			const run = await runService.get(id)
			if (!run) return c.json({ error: 'run not found' }, 404)

			// If first event is 'started', transition to running
			if (run.status === 'claimed' && body.type === 'started') {
				await runService.start(id)
			}

			await runService.appendEvent(id, {
				type: body.type,
				summary: body.summary,
				metadata: body.metadata ? JSON.stringify(body.metadata) : undefined,
			})

			eventBus.emit({
				type: 'run_event',
				runId: id,
				eventType: body.type,
				summary: body.summary,
			})

			return c.json({ ok: true as const }, 200)
		},
	)
	// POST /runs/:id/complete — complete run (from worker)
	.post(
		'/:id/complete',
		zValidator('param', z.object({ id: z.string() })),
		zValidator('json', RunCompletionSchema),
		async (c) => {
			const { runService, workerService } = c.get('services')
			const { id } = c.req.valid('param')
			const body = c.req.valid('json')

			const run = await runService.get(id)
			if (!run) return c.json({ error: 'run not found' }, 404)

			const result = await runService.complete(id, {
				status: body.status,
				summary: body.summary,
				tokens_input: body.tokens?.input,
				tokens_output: body.tokens?.output,
				error: body.error,
			})

			// Release worker lease + set worker back to online
			if (run.worker_id) {
				const lease = await workerService.getActiveLeaseForWorker(run.worker_id)
				if (lease) {
					await workerService.completeLease(lease.id, body.status)
				}
				await workerService.setOnline(run.worker_id)
			}

			eventBus.emit({
				type: 'run_completed',
				runId: id,
				status: body.status,
			})

			return c.json(result, 200)
		},
	)

export { runs }
