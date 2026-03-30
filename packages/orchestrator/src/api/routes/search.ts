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

		// Filter message results by channel membership (non-admin/owner only)
		const actor = c.get('actor')
		if (actor && actor.role !== 'admin' && actor.role !== 'owner') {
			const messageResults = results.filter((r) => r.entityType === 'message')
			if (messageResults.length > 0) {
				const storage = c.get('storage')
				// Get all channels where the actor is a member
				const allChannels = await storage.listChannels()
				const memberChannelIds = new Set<string>()
				for (const ch of allChannels) {
					if (await storage.isChannelMember(ch.id, actor.id)) {
						memberChannelIds.add(ch.id)
					}
				}
				// Look up each message's channel and filter
				const allowedMessageIds = new Set<string>()
				for (const r of messageResults) {
					const msg = await storage.readMessage(r.entityId)
					if (msg && msg.channel && memberChannelIds.has(msg.channel)) {
						allowedMessageIds.add(r.entityId)
					}
				}
				results = results.filter((r) => {
					if (r.entityType === 'message') return allowedMessageIds.has(r.entityId)
					return true
				})
			}
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
