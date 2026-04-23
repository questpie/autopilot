import { Hono } from 'hono'
import { validator as zValidator } from 'hono-openapi'
import { z } from 'zod'
import type { AppEnv } from '../app'

const preferences = new Hono<AppEnv>()
	.get('/', async (c) => {
		const actor = c.get('actor')
		if (!actor || actor.type !== 'human') return c.json({ error: 'human actor required' }, 403)

		const { userPreferenceService } = c.get('services')
		const result = await userPreferenceService.list(actor.id)
		return c.json(result, 200)
	})
	.get(
		'/:key',
		zValidator('param', z.object({ key: z.string().min(1) })),
		async (c) => {
			const actor = c.get('actor')
			if (!actor || actor.type !== 'human') return c.json({ error: 'human actor required' }, 403)

			const { userPreferenceService } = c.get('services')
			const { key } = c.req.valid('param')
			const result = await userPreferenceService.get(actor.id, key)
			if (!result) return c.json({ error: 'preference not found' }, 404)
			return c.json(result, 200)
		},
	)
	.put(
		'/:key',
		zValidator('param', z.object({ key: z.string().min(1) })),
		zValidator('json', z.object({ value: z.unknown() })),
		async (c) => {
			const actor = c.get('actor')
			if (!actor || actor.type !== 'human') return c.json({ error: 'human actor required' }, 403)

			const { userPreferenceService } = c.get('services')
			const { key } = c.req.valid('param')
			const { value } = c.req.valid('json')
			const result = await userPreferenceService.set(actor.id, key, value)
			return c.json(result, 200)
		},
	)
	.delete(
		'/:key',
		zValidator('param', z.object({ key: z.string().min(1) })),
		async (c) => {
			const actor = c.get('actor')
			if (!actor || actor.type !== 'human') return c.json({ error: 'human actor required' }, 403)

			const { userPreferenceService } = c.get('services')
			const { key } = c.req.valid('param')
			const deleted = await userPreferenceService.delete(actor.id, key)
			if (!deleted) return c.json({ error: 'preference not found' }, 404)
			return c.json({ ok: true as const }, 200)
		},
	)

export { preferences }
