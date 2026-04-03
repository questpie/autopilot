import { Hono } from 'hono'
import { validator as zValidator } from 'hono-openapi'
import { z } from 'zod'
import {
	WorkerEventSchema,
	RunCompletionSchema,
	CreateRunRequestSchema,
	ContinueRunRequestSchema,
} from '@questpie/autopilot-spec'
import type { AppEnv } from '../app'
import { eventBus } from '../../events/event-bus'

const runs = new Hono<AppEnv>()
	// GET /runs — list runs (optional status/agent/task filter)
	.get(
		'/',
		zValidator(
			'query',
			z.object({
				status: z.string().optional(),
				agent_id: z.string().optional(),
				task_id: z.string().optional(),
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
	// GET /runs/:id/artifacts — get run artifacts
	.get(
		'/:id/artifacts',
		zValidator('param', z.object({ id: z.string() })),
		async (c) => {
			const { artifactService } = c.get('services')
			const { id } = c.req.valid('param')
			const arts = await artifactService.listForRun(id)
			return c.json(arts, 200)
		},
	)
	// POST /runs — create a new pending run
	.post('/', zValidator('json', CreateRunRequestSchema), async (c) => {
		const { runService } = c.get('services')
		const actor = c.get('actor')
		const body = c.req.valid('json')
		const id = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
		const { targeting, ...rest } = body
		const run = await runService.create({
			id,
			...rest,
			initiated_by: body.initiated_by ?? actor?.id ?? 'system',
			targeting: targeting ? JSON.stringify(targeting) : undefined,
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

			// Verify authenticated worker owns this run
			const authWorkerId = c.get('workerId')
			if (authWorkerId && run.worker_id && run.worker_id !== authWorkerId) {
				return c.json({ error: `Run ${id} belongs to worker ${run.worker_id}, not ${authWorkerId}` }, 403)
			}

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
			const { runService, workerService, workflowEngine, artifactService } = c.get('services')
			const { id } = c.req.valid('param')
			const body = c.req.valid('json')

			const run = await runService.get(id)
			if (!run) return c.json({ error: 'run not found' }, 404)

			// Verify authenticated worker owns this run
			const authWorkerId = c.get('workerId')
			if (authWorkerId && run.worker_id && run.worker_id !== authWorkerId) {
				return c.json({ error: `Run ${id} belongs to worker ${run.worker_id}, not ${authWorkerId}` }, 403)
			}

			const result = await runService.complete(id, {
				status: body.status,
				summary: body.summary,
				tokens_input: body.tokens?.input,
				tokens_output: body.tokens?.output,
				error: body.error,
				runtime_session_ref: body.runtime_session_ref,
				resumable: body.resumable,
			})

			// Register artifacts reported by the worker
			let hasPreviewFiles = false
			let previewEntry: string | null = null
			if (body.artifacts?.length) {
				for (const art of body.artifacts) {
					await artifactService.create({
						id: `art-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
						run_id: id,
						task_id: run.task_id ?? undefined,
						kind: art.kind,
						title: art.title,
						ref_kind: art.ref_kind,
						ref_value: art.ref_value,
						mime_type: art.mime_type,
						metadata: art.metadata ? JSON.stringify(art.metadata) : undefined,
					})
					if (art.kind === 'preview_file') {
						hasPreviewFiles = true
						if (!previewEntry && art.title.endsWith('index.html')) {
							previewEntry = art.title
						}
					}
				}
			}

			// Auto-create preview_url artifact if preview files were stored
			if (hasPreviewFiles) {
				const entry = previewEntry ?? 'index.html'
				const origin = new URL(c.req.url).origin
				const previewUrl = `${origin}/api/previews/${id}/${entry}`
				await artifactService.create({
					id: `art-preview-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
					run_id: id,
					task_id: run.task_id ?? undefined,
					kind: 'preview_url',
					title: 'Preview',
					ref_kind: 'url',
					ref_value: previewUrl,
					mime_type: 'text/html',
					metadata: JSON.stringify({ entry, run_id: id }),
				})
			}

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

			// Workflow progression: if run completed successfully and has a task, advance workflow
			// Pass the completing run's ID as the source for context forwarding
			if (body.status === 'completed' && run.task_id) {
				await workflowEngine.advance(run.task_id, body.outputs, id)
			}

			return c.json(result, 200)
		},
	)
	// POST /runs/:id/cancel — cancel a pending/claimed/running run
	.post(
		'/:id/cancel',
		zValidator('param', z.object({ id: z.string() })),
		zValidator('json', z.object({ reason: z.string().optional() }).optional()),
		async (c) => {
			const { runService, workerService } = c.get('services')
			const { id } = c.req.valid('param')
			const body = c.req.valid('json')

			const run = await runService.get(id)
			if (!run) return c.json({ error: 'run not found' }, 404)

			const result = await runService.cancel(id, body?.reason)
			if (!result) {
				return c.json({ error: `run ${id} is already ${run.status} — cannot cancel` }, 400)
			}

			// Release worker lease if claimed/running
			if (run.worker_id) {
				const lease = await workerService.getActiveLeaseForWorker(run.worker_id)
				if (lease) {
					await workerService.completeLease(lease.id, 'failed')
				}
				await workerService.setOnline(run.worker_id)
			}

			eventBus.emit({ type: 'run_completed', runId: id, status: 'failed' })

			return c.json(result, 200)
		},
	)
	// POST /runs/:id/continue — create a continuation run
	.post(
		'/:id/continue',
		zValidator('param', z.object({ id: z.string() })),
		zValidator('json', ContinueRunRequestSchema),
		async (c) => {
			const { runService, workerService } = c.get('services')
			const { id } = c.req.valid('param')
			const body = c.req.valid('json')
			const actor = c.get('actor')

			const original = await runService.get(id)
			if (!original) return c.json({ error: 'run not found' }, 404)

			if (original.status !== 'completed' && original.status !== 'failed') {
				return c.json({ error: 'can only continue completed or failed runs' }, 400)
			}

			if (!original.resumable) {
				return c.json({ error: 'run is not resumable (no local session)' }, 400)
			}

			// Check if preferred worker is online
			if (original.worker_id) {
				const worker = await workerService.get(original.worker_id)
				if (!worker || worker.status === 'offline') {
					return c.json(
						{
							error: `original worker ${original.worker_id} is offline — cannot resume session`,
						},
						409,
					)
				}
			}

			const continuation = await runService.createContinuation(id, {
				message: body.message,
				initiated_by: body.initiated_by ?? actor?.id ?? 'system',
			})

			if (!continuation) {
				return c.json({ error: 'failed to create continuation run' }, 500)
			}

			eventBus.emit({
				type: 'task_changed',
				taskId: continuation.task_id ?? continuation.id,
				status: 'pending',
			})

			return c.json(continuation, 201)
		},
	)

export { runs }
