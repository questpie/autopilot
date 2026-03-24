import { Hono } from 'hono'
import { describeRoute } from 'hono-openapi'
import { resolver } from 'hono-openapi'
import { z } from 'zod'
import { AgentSchema } from '@questpie/autopilot-spec'
import { loadAgents } from '../../fs/company'
import type { AppEnv } from '../app'

const agents = new Hono<AppEnv>().get(
	'/',
	describeRoute({
		tags: ['agents'],
		description: 'List all agents defined in agents.yaml',
		responses: {
			200: {
				description: 'Array of agents',
				content: { 'application/json': { schema: resolver(z.array(AgentSchema)) } },
			},
		},
	}),
	async (c) => {
		const root = c.get('companyRoot')
		const result = await loadAgents(root)
		return c.json(result)
	},
)

export { agents }
