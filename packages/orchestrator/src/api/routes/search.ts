/**
 * Search API route — GET /search?q=<query>&scope=<scope>
 */
import { Hono } from 'hono'
import { validator as zValidator } from 'hono-openapi'
import { z } from 'zod'
import type { AppEnv } from '../app'
import { search, type SearchScope } from '../../services/search'

const scopeSchema = z.enum(['tasks', 'runs', 'context', 'schedules', 'all'])

const searchRoute = new Hono<AppEnv>().get(
	'/',
	zValidator(
		'query',
		z.object({
			q: z.string().min(1),
			scope: scopeSchema.optional(),
		}),
	),
	async (c) => {
		const { q, scope } = c.req.valid('query')
		const rawClient = c.get('indexDbRaw')
		if (!rawClient) {
			return c.json({ error: 'search index not available' }, 503)
		}
		const resolvedScope: SearchScope = scope ?? 'all'
		try {
			const results = await search(rawClient, q, resolvedScope)
			return c.json({ results, query: q, scope: resolvedScope }, 200)
		} catch (err) {
			return c.json({ error: err instanceof Error ? err.message : String(err) }, 500)
		}
	},
)

export { searchRoute }
