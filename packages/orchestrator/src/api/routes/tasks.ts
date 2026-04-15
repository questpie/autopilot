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
				queue: z.string().optional(),
				start_after: z.string().optional(),
				scheduled_by: z.string().optional(),
				depends_on: z.array(z.string()).optional(),
				created_by: z.string().optional(),
			}),
		),
		async (c) => {
			const { workflowEngine, taskRelationService } = c.get('services')
			const actor = c.get('actor')
			const body = c.req.valid('json')
			const { depends_on, ...taskInput } = body
			const result = await workflowEngine.materializeTask({
				...taskInput,
				created_by: taskInput.created_by ?? actor?.id ?? 'system',
			})
			if (!result) return c.json({ error: 'failed to create task' }, 500)

			// Add dependencies if specified
			if (depends_on?.length) {
				for (const depId of depends_on) {
					try {
						await taskRelationService.addDependency({
							task_id: result.task.id,
							depends_on_task_id: depId,
							created_by: taskInput.created_by ?? actor?.id ?? 'system',
						})
					} catch (err) {
						console.warn(`[tasks] failed to add dependency ${result.task.id} → ${depId}:`, err instanceof Error ? err.message : String(err))
					}
				}
			}

			return c.json(result.task, 201)
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
			const actor = c.get('actor')
			const { id } = c.req.valid('param')

			const result = await workflowEngine.approve(id, actor?.id)
			if (!result) {
				return c.json({ error: 'task not found or not on a human_approval step' }, 400)
			}

			return c.json(result, 200)
		},
	)
	// POST /tasks/:id/reject — reject a human_approval step
	.post(
		'/:id/reject',
		zValidator('param', z.object({ id: z.string() })),
		zValidator('json', z.object({ message: z.string().min(1) })),
		async (c) => {
			const { workflowEngine } = c.get('services')
			const actor = c.get('actor')
			const { id } = c.req.valid('param')
			const { message } = c.req.valid('json')

			const result = await workflowEngine.reject(id, message, actor?.id)
			if (!result) {
				return c.json({ error: 'task not found or not on a human_approval step' }, 400)
			}

			return c.json(result, 200)
		},
	)
	// POST /tasks/:id/reply — reply to a human_approval step with a message
	.post(
		'/:id/reply',
		zValidator('param', z.object({ id: z.string() })),
		zValidator('json', z.object({ message: z.string().min(1) })),
		async (c) => {
			const { workflowEngine } = c.get('services')
			const actor = c.get('actor')
			const { id } = c.req.valid('param')
			const { message } = c.req.valid('json')

			const result = await workflowEngine.reply(id, message, actor?.id)
			if (!result) {
				return c.json({ error: 'task not found or not on a human_approval step' }, 400)
			}

			return c.json(result, 200)
		},
	)
	// POST /tasks/:id/retry — retry a failed task
	.post(
		'/:id/retry',
		zValidator('param', z.object({ id: z.string() })),
		async (c) => {
			const { workflowEngine } = c.get('services')
			const actor = c.get('actor')
			const { id } = c.req.valid('param')

			const result = await workflowEngine.retry(id, actor?.id)
			if (!result) {
				return c.json({ error: 'task not found or not in failed status' }, 400)
			}

			return c.json(result, 200)
		},
	)
	// POST /tasks/:id/cancel — cancel an active task
	.post(
		'/:id/cancel',
		zValidator('param', z.object({ id: z.string() })),
		async (c) => {
			const { workflowEngine } = c.get('services')
			const actor = c.get('actor')
			const { id } = c.req.valid('param')
			const body = await c.req.json().catch(() => ({})) as { reason?: string }

			const result = await workflowEngine.cancel(id, body?.reason, actor?.id)
			if (!result) {
				return c.json({ error: 'task not found or already completed/failed' }, 400)
			}

			return c.json(result, 200)
		},
	)
	// DELETE /tasks/:id — delete task with cascade
	.delete(
		'/:id',
		zValidator('param', z.object({ id: z.string() })),
		zValidator('query', z.object({ force: z.string().optional() })),
		async (c) => {
			const { taskService, runService } = c.get('services')
			const { id } = c.req.valid('param')
			const { force } = c.req.valid('query')

			// Block deletion if active runs exist (unless ?force=true)
			if (force !== 'true') {
				const taskRuns = await runService.list({ task_id: id })
				const activeRuns = taskRuns.filter((r) => r.status === 'running' || r.status === 'claimed')
				if (activeRuns.length > 0) {
					return c.json({ error: 'Cannot delete task with active runs. Cancel runs first.' }, 409)
				}
			}

			const deleted = await taskService.deleteCascade(id)
			if (!deleted) return c.json({ error: 'task not found' }, 404)

			return c.json(deleted, 200)
		},
	)
	// GET /tasks/:id/activity — approval/rejection/reply history
	.get(
		'/:id/activity',
		zValidator('param', z.object({ id: z.string() })),
		async (c) => {
			const { activityService } = c.get('services')
			const { id } = c.req.valid('param')
			const entries = await activityService.listForTask(id)
			return c.json(entries, 200)
		},
	)

export { tasks }
