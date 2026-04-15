/**
 * Types API routes — registered rendering type definitions.
 *
 * GET  /api/types      — list all registered types
 * GET  /api/types/:id  — get single type definition
 */
import { Hono } from 'hono'
import { validator as zValidator } from 'hono-openapi'
import { z } from 'zod'
import type { AppEnv } from '../app'

// ─── Schemas ────────────────────────────────────────────────────────────────

const TypesListQuery = z.object({
	category: z.enum(['file', 'folder']).optional(),
})

// ─── Routes ─────────────────────────────────────────────────────────────────

const types = new Hono<AppEnv>()

	// GET /api/types — list all registered types
	.get('/', zValidator('query', TypesListQuery), (c) => {
		const registry = c.get('typeRegistry')
		if (!registry) return c.json({ types: [] }, 200)
		const { category } = c.req.valid('query')
		const all = category ? registry.byCategory(category) : registry.all()
		return c.json({ types: all }, 200)
	})

	// GET /api/types/:id — get single type definition
	.get('/:id', (c) => {
		const id = c.req.param('id')
		const registry = c.get('typeRegistry')
		if (!registry) return c.json({ error: `type '${id}' not found` }, 404)
		const def = registry.get(id)
		if (!def) return c.json({ error: `type '${id}' not found` }, 404)
		return c.json(def, 200)
	})

export { types }
