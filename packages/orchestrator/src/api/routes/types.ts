/**
 * Types API routes — registered rendering type definitions.
 *
 * GET  /api/types      — list all registered types
 * GET  /api/types/:id  — get single type definition
 *
 * Type definitions are managed by the TypeRegistry (not yet implemented).
 * These endpoints return an empty list until the rendering system is wired in.
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
	.get('/', zValidator('query', TypesListQuery), async (c) => {
		// TypeRegistry is not yet wired to AppEnv. Return empty list as a
		// stable contract — callers can always expect this shape.
		return c.json({ types: [] }, 200)
	})

	// GET /api/types/:id — get single type definition
	.get('/:id', async (c) => {
		const id = c.req.param('id')
		// TypeRegistry not yet wired — no type can be resolved.
		return c.json({ error: `type '${id}' not found` }, 404)
	})

export { types }
