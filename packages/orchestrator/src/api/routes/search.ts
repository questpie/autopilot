import { Hono } from 'hono'
import { describeRoute } from 'hono-openapi'
import { resolver, validator as zValidator } from 'hono-openapi'
import { SearchQuerySchema, SearchResponseSchema } from '@questpie/autopilot-spec'
import { searchFts, searchHybrid } from '../../db/search-index'
import type { EntityType, SearchResult } from '../../db/search-index'
import type { AppEnv } from '../app'
import { container } from '../../container'
import { embeddingServiceFactory } from '../../embeddings'

const search = new Hono<AppEnv>().get(
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
		let actualMode = mode ?? 'fts'

		if (mode === 'fts') {
			results = await searchFts(db, q, { type: typeFilter, limit })
		} else {
			// hybrid mode — embed the query text for vector search
			let embedding: Float32Array | null = null
			try {
				const { embeddingService } = await container.resolveAsync([embeddingServiceFactory])
				if (embeddingService && embeddingService.providerName !== 'none') {
					embedding = await embeddingService.embedQuery(q)
				}
			} catch {
				// Embedding service not available — fallback to FTS only
			}

			if (!embedding) {
				actualMode = 'fts'
			}

			results = await searchHybrid(db, q, embedding, { type: typeFilter, limit })
		}

		return c.json({
			results,
			query: q,
			mode: actualMode,
			total: results.length,
		})
	},
)

export { search }
