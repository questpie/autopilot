/**
 * Session inspection routes.
 *
 * GET /api/sessions       — list sessions (filterable by provider, status, mode)
 * GET /api/sessions/:id   — get single session
 */
import { Hono } from 'hono'
import { validator as zValidator } from 'hono-openapi'
import { z } from 'zod'
import type { AppEnv } from '../app'

const sessionsRoute = new Hono<AppEnv>()
	.get(
		'/',
		zValidator(
			'query',
			z.object({
				provider_id: z.string().optional(),
				status: z.string().optional(),
				mode: z.string().optional(),
			}),
		),
		async (c) => {
			const { sessionService } = c.get('services')
			const filter = c.req.valid('query')
			const result = await sessionService.list(filter)
			return c.json(result, 200)
		},
	)
	.get(
		'/:id',
		zValidator('param', z.object({ id: z.string() })),
		async (c) => {
			const { sessionService } = c.get('services')
			const { id } = c.req.valid('param')
			const session = await sessionService.get(id)
			if (!session) return c.json({ error: 'session not found' }, 404)
			return c.json(session, 200)
		},
	)

export { sessionsRoute }
