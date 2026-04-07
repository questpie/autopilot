import { Hono } from 'hono'
import { validator as zValidator } from 'hono-openapi'
import { z } from 'zod'
import type { AppEnv } from '../app'

const queues = new Hono<AppEnv>()
	// GET /queues — list all configured queues with status
	.get(
		'/',
		async (c) => {
			const { taskService } = c.get('services')
			const authoredConfig = c.get('authoredConfig')
			const queueConfigs = authoredConfig.queues ?? {}

			const result: Array<{
				name: string
				max_concurrent: number
				priority_order: string
				active_count: number
				pending_tasks: number
			}> = []

			for (const [name, config] of Object.entries(queueConfigs)) {
				const activeCount = await taskService.countActiveInQueue(name)
				const allInQueue = await taskService.listByQueue(name)
				const pendingCount = allInQueue.filter(
					(t) => t.status === 'backlog' || t.status === 'active',
				).length

				result.push({
					name,
					max_concurrent: config.max_concurrent,
					priority_order: config.priority_order,
					active_count: activeCount,
					pending_tasks: pendingCount,
				})
			}

			return c.json(result, 200)
		},
	)
	// GET /queues/:name — show a single queue with its tasks
	.get(
		'/:name',
		zValidator('param', z.object({ name: z.string() })),
		async (c) => {
			const { taskService } = c.get('services')
			const authoredConfig = c.get('authoredConfig')
			const { name } = c.req.valid('param')

			const config = (authoredConfig.queues ?? {})[name]
			if (!config) {
				return c.json({ error: `queue "${name}" not configured` }, 404)
			}

			const activeCount = await taskService.countActiveInQueue(name)
			const allTasks = await taskService.listByQueue(name)

			const running = allTasks.filter((t) => t.status === 'active')
			const pending = allTasks.filter((t) => t.status === 'backlog')
			const done = allTasks.filter((t) => t.status === 'done')
			const failed = allTasks.filter((t) => t.status === 'failed')

			return c.json({
				name,
				max_concurrent: config.max_concurrent,
				priority_order: config.priority_order,
				active_count: activeCount,
				summary: {
					running: running.length,
					pending: pending.length,
					done: done.length,
					failed: failed.length,
					total: allTasks.length,
				},
				tasks: allTasks.map((t) => ({
					id: t.id,
					title: t.title,
					status: t.status,
					priority: t.priority,
					created_at: t.created_at,
				})),
			}, 200)
		},
	)

export { queues }
