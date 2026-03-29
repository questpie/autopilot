import { z } from 'zod'
import type { ToolDefinition } from '../tools'

export function createSearchTool(companyRoot: string): ToolDefinition {
	return {
		name: 'search_index',
		description: 'Search the internal index across all entities (tasks, messages, knowledge, pins, agents, channels, skills). Returns ranked results.',
		schema: z.object({
			query: z.string().describe('Search query'),
			type: z.enum(['task', 'message', 'knowledge', 'pin', 'agent', 'channel', 'skill']).optional().describe('Filter by entity type'),
			scope: z.string().optional().describe('Path prefix filter, e.g. "technical" for knowledge/technical/'),
			limit: z.number().optional().describe('Max results, default 10'),
		}),
		execute: async (args) => {
			const maxResults = args.limit ?? 10
			try {
				const { createDb } = await import('../../db')
				const { searchFts: fts } = await import('../../db/search-index')
				const { db } = await createDb(companyRoot)
				const typeFilter = args.type as import('../../db/search-index').EntityType | undefined
				let results = await fts(db, args.query, { type: typeFilter, limit: maxResults * 2 })

				// Apply scope filter (path prefix) for knowledge and other path-based entities
				if (args.scope) {
					results = results.filter((r) => r.entityId.startsWith(args.scope!))
				}

				results = results.slice(0, maxResults)

				if (results.length === 0) {
					return { content: [{ type: 'text' as const, text: 'No results found.' }] }
				}

				const text = results
					.map((r) => `- [${r.entityType}] **${r.entityId}** ${r.title ? `(${r.title})` : ''}: ${r.snippet}`)
					.join('\n')
				return { content: [{ type: 'text' as const, text }] }
			} catch {
				return { content: [{ type: 'text' as const, text: 'Search index not available.' }] }
			}
		},
	}
}
