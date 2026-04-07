import { Hono } from 'hono'
import { validator as zValidator } from 'hono-openapi'
import { z } from 'zod'
import type { AppEnv } from '../app'

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
