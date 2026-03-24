import { Hono } from 'hono'
import { describeRoute } from 'hono-openapi'
import { resolver, validator as zValidator } from 'hono-openapi'
import { SearchQuerySchema, SearchResponseSchema } from '@questpie/autopilot-spec'
import { searchFts, searchHybrid } from '../../db/search-index'
import type { EntityType, SearchResult } from '../../db/search-index'
import type { AppEnv } from '../app'

const search = new Hono<AppEnv>()

search.get(
	'/',
	describeRoute({
		tags: ['search'],
		description: 'Unified FTS / hybrid search across all indexed entities',
		responses: {
			200: {
				description: 'Search results',
				content: { 'application/json': { schema: resolver(SearchResponseSchema) } },
			},
		},
	}),
	zValidator('query', SearchQuerySchema),
	async (c) => {
		const db = c.get('db')
		const { q, type, mode, limit } = c.req.valid('query')

		const typeFilter = type?.split(',').map((t) => t.trim())[0] as EntityType | undefined

		let results: SearchResult[]

		if (mode === 'fts') {
			results = await searchFts(db, q, { type: typeFilter, limit })
		} else {
			// hybrid mode — pass null embedding for now (FTS-only fallback)
			results = await searchHybrid(db, q, null, { type: typeFilter, limit })
		}

		return c.json({
			results,
			query: q,
			mode,
			total: results.length,
		})
	},
)

export { search }
