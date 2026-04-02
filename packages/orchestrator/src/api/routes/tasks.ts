import { Hono } from 'hono'
import { validator as zValidator } from 'hono-openapi'
import { z } from 'zod'
import type { AppEnv } from '../app'
import { eventBus } from '../../events/event-bus'

const tasks = new Hono<AppEnv>()
	// GET /tasks — list with optional filters
	.get(
		'/',
		zValidator(
			'query',
			z.object({
				status: z.string().optional(),
				assigned_to: z.string().optional(),
				workflow_id: z.string().optional(),
			}),
		),
		async (c) => {
			const { taskService } = c.get('services')
			const filter = c.req.valid('query')
			const result = await taskService.list(filter)
			return c.json(result, 200)
		},
	)
	// GET /tasks/:id — single task
	.get(
		'/:id',
		zValidator('param', z.object({ id: z.string() })),
		async (c) => {
			const { taskService } = c.get('services')
			const { id } = c.req.valid('param')
			const task = await taskService.get(id)
			if (!task) return c.json({ error: 'task not found' }, 404)
			return c.json(task, 200)
		},
	)
	// POST /tasks — create a new task
	.post(
		'/',
		zValidator(
			'json',
			z.object({
				title: z.string().min(1),
				type: z.string().min(1),
				description: z.string().optional(),
				status: z.string().optional(),
				priority: z.string().optional(),
				assigned_to: z.string().optional(),
				workflow_id: z.string().optional(),
				workflow_step: z.string().optional(),
				context: z.string().optional(),
				metadata: z.string().optional(),
				created_by: z.string().optional(),
			}),
		),
		async (c) => {
			const { taskService, workflowEngine } = c.get('services')
			const actor = c.get('actor')
			const body = c.req.valid('json')
			const id = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
			const task = await taskService.create({
				id,
				...body,
				created_by: body.created_by ?? actor?.id ?? 'system',
			})
			if (!task) return c.json({ error: 'failed to create task' }, 500)

			// Workflow-driven intake: resolve assignee, attach workflow, process first step
			const intakeResult = await workflowEngine.intake(id)

			// Return the task after intake (may have updated fields)
			const final = intakeResult?.task ?? task
			return c.json(final, 201)
		},
	)
	// PATCH /tasks/:id — update task
	.patch(
		'/:id',
		zValidator('param', z.object({ id: z.string() })),
		zValidator(
			'json',
			z.object({
				title: z.string().optional(),
				description: z.string().optional(),
				status: z.string().optional(),
				priority: z.string().optional(),
				assigned_to: z.string().optional(),
				workflow_id: z.string().optional(),
				workflow_step: z.string().optional(),
				context: z.string().optional(),
				metadata: z.string().optional(),
			}),
		),
		async (c) => {
			const { taskService } = c.get('services')
			const { id } = c.req.valid('param')
			const body = c.req.valid('json')

			const existing = await taskService.get(id)
			if (!existing) return c.json({ error: 'task not found' }, 404)

			const result = await taskService.update(id, body)
			if (!result) return c.json({ error: 'update failed' }, 500)

			eventBus.emit({
				type: 'task_changed',
				taskId: id,
				status: result.status,
			})

			return c.json(result, 200)
		},
	)
	// POST /tasks/:id/approve — approve a human_approval step
	.post(
		'/:id/approve',
		zValidator('param', z.object({ id: z.string() })),
		async (c) => {
			const { workflowEngine } = c.get('services')
			const { id } = c.req.valid('param')

			const result = await workflowEngine.approve(id)
			if (!result) {
				return c.json({ error: 'task not found or not on a human_approval step' }, 400)
			}

			return c.json(result, 200)
		},
	)

export { tasks }
