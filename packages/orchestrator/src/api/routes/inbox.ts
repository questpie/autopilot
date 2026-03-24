import { Hono } from 'hono'
import { describeRoute } from 'hono-openapi'
import { resolver } from 'hono-openapi'
import { InboxResponseSchema } from '@questpie/autopilot-spec'
import { listPins } from '../../fs/pins'
import type { AppEnv } from '../app'

const inbox = new Hono<AppEnv>()

inbox.get(
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
		const root = c.get('companyRoot')
		const storage = c.get('storage')

		const [reviewTasks, blockedTasks, allPins] = await Promise.all([
			storage.listTasks({ status: 'review' }).catch(() => []),
			storage.listTasks({ status: 'blocked' }).catch(() => []),
			listPins(root),
		])

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
