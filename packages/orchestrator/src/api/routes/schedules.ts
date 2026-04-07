import { Hono } from 'hono'
import { validator as zValidator } from 'hono-openapi'
import { z } from 'zod'
import type { AppEnv } from '../app'
import { SchedulerDaemon } from '../../services/scheduler-daemon'

const schedules = new Hono<AppEnv>()
	// GET /schedules — list all
	.get('/', async (c) => {
		const { scheduleService } = c.get('services')
		const result = await scheduleService.list()
		return c.json(result, 200)
	})
	// GET /schedules/:id — detail
	.get(
		'/:id',
		zValidator('param', z.object({ id: z.string() })),
		async (c) => {
			const { scheduleService } = c.get('services')
			const { id } = c.req.valid('param')
			const schedule = await scheduleService.get(id)
			if (!schedule) return c.json({ error: 'schedule not found' }, 404)
			return c.json(schedule, 200)
		},
	)
	// GET /schedules/:id/history — execution history
	.get(
		'/:id/history',
		zValidator('param', z.object({ id: z.string() })),
		zValidator('query', z.object({ limit: z.coerce.number().optional() })),
		async (c) => {
			const { scheduleService } = c.get('services')
			const { id } = c.req.valid('param')
			const { limit } = c.req.valid('query')

			const schedule = await scheduleService.get(id)
			if (!schedule) return c.json({ error: 'schedule not found' }, 404)

			const executions = await scheduleService.listExecutions(id, limit ?? 50)
			return c.json(executions, 200)
		},
	)
	// POST /schedules/:id/trigger — manual trigger
	.post(
		'/:id/trigger',
		zValidator('param', z.object({ id: z.string() })),
		async (c) => {
			const { scheduleService, workflowEngine, queryService, activityService } = c.get('services')
			const { id } = c.req.valid('param')

			const schedule = await scheduleService.get(id)
			if (!schedule) return c.json({ error: 'schedule not found' }, 404)

			const daemon = new SchedulerDaemon(scheduleService, workflowEngine, queryService, activityService)
			try {
				await daemon.execute(schedule, new Date())
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err)
				return c.json({ error: `trigger failed: ${msg}` }, 500)
			}

			return c.json({ ok: true, schedule_id: id }, 200)
		},
	)
	// POST /schedules — create
	.post(
		'/',
		zValidator(
			'json',
			z.object({
				name: z.string().min(1),
				description: z.string().optional(),
				cron: z.string().min(1),
				timezone: z.string().optional(),
				agent_id: z.string().min(1),
				workflow_id: z.string().optional(),
				task_template: z.string().optional(),
				mode: z.enum(['task', 'query']).optional(),
				query_template: z.string().optional(),
				concurrency_policy: z.enum(['skip', 'allow', 'queue']).optional(),
				enabled: z.boolean().optional(),
			}),
		),
		async (c) => {
			const { scheduleService } = c.get('services')
			const actor = c.get('actor')
			const body = c.req.valid('json')

			const result = await scheduleService.create({
				...body,
				created_by: actor?.id ?? 'system',
			})
			if (!result) return c.json({ error: 'failed to create schedule' }, 500)
			return c.json(result, 201)
		},
	)
	// PATCH /schedules/:id — update
	.patch(
		'/:id',
		zValidator('param', z.object({ id: z.string() })),
		zValidator(
			'json',
			z.object({
				name: z.string().optional(),
				description: z.string().optional(),
				cron: z.string().optional(),
				timezone: z.string().optional(),
				agent_id: z.string().optional(),
				workflow_id: z.string().optional(),
				task_template: z.string().optional(),
				mode: z.enum(['task', 'query']).optional(),
				query_template: z.string().optional(),
				concurrency_policy: z.enum(['skip', 'allow', 'queue']).optional(),
				enabled: z.boolean().optional(),
			}),
		),
		async (c) => {
			const { scheduleService } = c.get('services')
			const { id } = c.req.valid('param')
			const body = c.req.valid('json')

			const result = await scheduleService.update(id, body)
			if (!result) return c.json({ error: 'schedule not found' }, 404)
			return c.json(result, 200)
		},
	)
	// DELETE /schedules/:id — delete
	.delete(
		'/:id',
		zValidator('param', z.object({ id: z.string() })),
		async (c) => {
			const { scheduleService } = c.get('services')
			const { id } = c.req.valid('param')

			const deleted = await scheduleService.delete(id)
			if (!deleted) return c.json({ error: 'schedule not found' }, 404)
			return c.json(deleted, 200)
		},
	)

export { schedules }
