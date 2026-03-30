import { Hono } from 'hono'
import { describeRoute } from 'hono-openapi'
import { resolver } from 'hono-openapi'
import { InboxResponseSchema } from '@questpie/autopilot-spec'
import { listPins } from '../../fs/pins'
import type { AppEnv } from '../app'

const inbox = new Hono<AppEnv>().get(
	'/',
	describeRoute({
		tags: ['inbox'],
		description: 'Tasks needing attention: review + blocked tasks, plus pins with actions',
		responses: {
			200: {
				description: 'Inbox with tasks and action pins',
				content: { 'application/json': { schema: resolver(InboxResponseSchema) } },
			},
		},
	}),
	async (c) => {
		const storage = c.get('storage')
		const actor = c.get('actor')

		const db = c.get('db')
		let [reviewTasks, blockedTasks, allPins] = await Promise.all([
			storage.listTasks({ status: 'review' }).catch(() => []),
			storage.listTasks({ status: 'blocked' }).catch(() => []),
			listPins(db).catch(() => []),
		])

		// Non-admin/owner users only see tasks assigned to or created by them
		if (actor && actor.role !== 'admin' && actor.role !== 'owner') {
			reviewTasks = reviewTasks.filter(
				(t) => t.assigned_to === actor.id || t.created_by === actor.id,
			)
			blockedTasks = blockedTasks.filter(
				(t) => t.assigned_to === actor.id || t.created_by === actor.id,
			)
		}

		const actionPins = allPins.filter(
			(p) => p.metadata?.actions && p.metadata.actions.length > 0,
		)

		return c.json({
			tasks: [...reviewTasks, ...blockedTasks],
			pins: actionPins,
		})
	},
)

export { inbox }
