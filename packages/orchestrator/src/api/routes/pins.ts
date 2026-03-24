import { Hono } from 'hono'
import { describeRoute } from 'hono-openapi'
import { resolver } from 'hono-openapi'
import { z } from 'zod'
import { PinSchema } from '@questpie/autopilot-spec'
import { listPins } from '../../fs/pins'
import type { AppEnv } from '../app'

const pins = new Hono<AppEnv>().get(
	'/',
	describeRoute({
		tags: ['pins'],
		description: 'List all dashboard pins',
		responses: {
			200: {
				description: 'Array of pins',
				content: { 'application/json': { schema: resolver(z.array(PinSchema)) } },
			},
		},
	}),
	async (c) => {
		const root = c.get('companyRoot')
		const result = await listPins(root)
		return c.json(result)
	},
)

export { pins }
