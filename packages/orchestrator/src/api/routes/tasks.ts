import { Hono } from 'hono'
import { describeRoute } from 'hono-openapi'
import { resolver, validator as zValidator } from 'hono-openapi'
import { z } from 'zod'
import {
	TaskSchema,
	TaskQuerySchema,
	TaskRejectRequestSchema,
	OkResponseSchema,
} from '@questpie/autopilot-spec'
import type { AppEnv } from '../app'

const tasks = new Hono<AppEnv>()
	// GET /tasks — list with query filters
	.get(
		'/',
		describeRoute({
			tags: ['tasks'],
			description: 'List tasks with optional status, agent, and project filters',
			responses: {
				200: {
					description: 'Array of tasks',
					content: { 'application/json': { schema: resolver(z.array(TaskSchema)) } },
				},
			},
		}),
		zValidator('query', TaskQuerySchema),
		async (c) => {
			const storage = c.get('storage')
			const { status, agent, project } = c.req.valid('query')

			const filter: Record<string, string> = {}
			if (status) filter.status = status
			if (agent) filter.assigned_to = agent
			if (project) filter.project = project

			const result = await storage.listTasks(filter)
			return c.json(result)
		},
	)
	// POST /tasks — create a new task
	.post(
		'/',
		describeRoute({
			tags: ['tasks'],
			description: 'Create a new task',
			responses: {
				201: {
					description: 'Created task',
					content: { 'application/json': { schema: resolver(TaskSchema) } },
				},
			},
		}),
		zValidator(
			'json',
			TaskSchema.partial().required({ title: true, type: true }),
		),
		async (c) => {
			const storage = c.get('storage')
			const body = c.req.valid('json')
			const now = new Date().toISOString()
			const task = await storage.createTask({
				id: body.id ?? `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
				status: body.status ?? 'backlog',
				created_by: body.created_by ?? 'human',
				created_at: body.created_at ?? now,
				updated_at: body.updated_at ?? now,
				...body,
			} as z.output<typeof TaskSchema>)
			return c.json(task, 201)
		},
	)
	// GET /tasks/:id — single task
	.get(
		'/:id',
		describeRoute({
			tags: ['tasks'],
			description: 'Get a single task by ID',
			responses: {
				200: {
					description: 'Task detail',
					content: { 'application/json': { schema: resolver(TaskSchema) } },
				},
				404: { description: 'Task not found' },
			},
		}),
		zValidator('param', z.object({ id: z.string() })),
		async (c) => {
			const storage = c.get('storage')
			const { id } = c.req.valid('param')
			const task = await storage.readTask(id)
			if (!task) return c.json({ error: 'task not found' }, 404)
			return c.json(task)
		},
	)
	// POST /tasks/:id/approve — move task to done
	.post(
		'/:id/approve',
		describeRoute({
			tags: ['tasks'],
			description: 'Approve (complete) a task — moves it to done',
			responses: {
				200: {
					description: 'Approval result',
					content: {
						'application/json': {
							schema: resolver(OkResponseSchema.extend({ taskId: z.string(), status: z.literal('done') })),
						},
					},
				},
				404: { description: 'Task not found' },
			},
		}),
		zValidator('param', z.object({ id: z.string() })),
		async (c) => {
			const storage = c.get('storage')
			const { id } = c.req.valid('param')
			const task = await storage.readTask(id)
			if (!task) return c.json({ error: 'task not found' }, 404)

			await storage.moveTask(id, 'done', 'human')
			return c.json({ ok: true as const, taskId: id, status: 'done' as const })
		},
	)
	// POST /tasks/:id/reject — move task to blocked
	.post(
		'/:id/reject',
		describeRoute({
			tags: ['tasks'],
			description: 'Reject (block) a task with an optional reason',
			responses: {
				200: {
					description: 'Rejection result',
					content: {
						'application/json': {
							schema: resolver(
								OkResponseSchema.extend({
									taskId: z.string(),
									status: z.literal('blocked'),
									reason: z.string(),
								}),
							),
						},
					},
				},
				404: { description: 'Task not found' },
			},
		}),
		zValidator('param', z.object({ id: z.string() })),
		zValidator('json', TaskRejectRequestSchema),
		async (c) => {
			const storage = c.get('storage')
			const { id } = c.req.valid('param')
			const { reason } = c.req.valid('json')
			const task = await storage.readTask(id)
			if (!task) return c.json({ error: 'task not found' }, 404)

			const rejectReason = reason ?? 'Rejected by human'
			await storage.moveTask(id, 'blocked', 'human', { reason: rejectReason })
			return c.json({ ok: true as const, taskId: id, status: 'blocked' as const, reason: rejectReason })
		},
	)

export { tasks }
