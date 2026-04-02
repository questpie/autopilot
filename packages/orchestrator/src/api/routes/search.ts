/**
 * Search route — placeholder for unified search.
 *
 * Full FTS5 + hybrid search will be rebuilt once the index service
 * is created. For now this returns empty results.
 */
import { Hono } from 'hono'
import { validator as zValidator } from 'hono-openapi'
import { z } from 'zod'
import type { AppEnv } from '../app'

const SearchQuerySchema = z.object({
	q: z.string().min(1),
	type: z.string().optional(),
	mode: z.enum(['fts', 'hybrid']).default('fts'),
	limit: z.coerce.number().int().min(1).max(100).default(20),
})

const search = new Hono<AppEnv>().get(
	'/',
	zValidator('query', SearchQuerySchema),
	async (c) => {
		const { q, mode } = c.req.valid('query')

		// TODO: wire up to IndexDb + search service
		return c.json({
			results: [],
			query: q,
			mode,
			total: 0,
		})
	},
)

export { search }
