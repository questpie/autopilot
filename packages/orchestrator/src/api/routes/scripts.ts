/**
 * Script REST API — read-only in Phase 1 (config-driven).
 */
import { Hono } from 'hono'
import { validator as zValidator } from 'hono-openapi'
import { z } from 'zod'
import type { AppEnv } from '../app'

export const scripts = new Hono<AppEnv>()
	.get('/', async (c) => {
		const { scriptService } = c.get('services')
		return c.json(scriptService.list(), 200)
	})
	.get('/:id', zValidator('param', z.object({ id: z.string() })), async (c) => {
		const { scriptService } = c.get('services')
		const { id } = c.req.valid('param')
		const script = scriptService.get(id)
		if (!script) return c.json({ error: 'script not found' }, 404)
		return c.json(script, 200)
	})
