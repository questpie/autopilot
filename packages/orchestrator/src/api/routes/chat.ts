import { Hono } from 'hono'
import { describeRoute } from 'hono-openapi'
import { resolver, validator as zValidator } from 'hono-openapi'
import { z } from 'zod'
import { ChatRequestSchema } from '@questpie/autopilot-spec'
import { loadAgents } from '../../fs/company'
import { routeMessage } from '../../router'
import type { AppEnv } from '../app'

const ChatResponseSchema = z.object({
	agent: z.object({ id: z.string() }).passthrough(),
	reason: z.string(),
})

const ChatErrorResponseSchema = z.object({
	routed_to: z.null(),
	reason: z.string(),
})

const chat = new Hono<AppEnv>().post(
	'/',
	describeRoute({
		tags: ['chat'],
		description: 'Route a message to the most relevant agent',
		responses: {
			200: {
				description: 'Routing result with target agent and reason',
				content: {
					'application/json': {
						schema: resolver(z.union([ChatResponseSchema, ChatErrorResponseSchema])),
					},
				},
			},
		},
	}),
	zValidator('json', ChatRequestSchema),
	async (c) => {
		const root = c.get('companyRoot')
		const { message } = c.req.valid('json')

		try {
			const agentsList = await loadAgents(root)
			const result = await routeMessage(message, agentsList, root)
			return c.json(result)
		} catch (err) {
			return c.json({
				routed_to: null,
				reason: err instanceof Error ? err.message : 'routing failed',
			})
		}
	},
)

export { chat }
