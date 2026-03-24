import { Hono } from 'hono'
import { describeRoute } from 'hono-openapi'
import { resolver, validator as zValidator } from 'hono-openapi'
import { z } from 'zod'
import { ActivityQuerySchema } from '@questpie/autopilot-spec'
import type { AppEnv } from '../app'

const ActivityEntrySchema = z.object({
	at: z.string(),
	agent: z.string(),
	type: z.string(),
	summary: z.string(),
	details: z.record(z.string(), z.unknown()).optional(),
})

const activity = new Hono<AppEnv>().get(
	'/',
	describeRoute({
		tags: ['activity'],
		description: 'Activity feed with optional agent and limit filters',
		responses: {
			200: {
				description: 'Array of activity entries',
				content: { 'application/json': { schema: resolver(z.array(ActivityEntrySchema)) } },
			},
		},
	}),
	zValidator('query', ActivityQuerySchema),
	async (c) => {
		const storage = c.get('storage')
		const { agent, limit } = c.req.valid('query')

		const filter: Record<string, unknown> = {}
		if (agent) filter.agent = agent
		if (limit) filter.limit = limit

		const entries = await storage.readActivity(filter)
		return c.json(entries)
	},
)

export { activity }
