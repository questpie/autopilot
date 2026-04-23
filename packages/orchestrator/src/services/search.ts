/**
 * Search service — FTS5 full-text search against the index database.
 */
import type { Client } from '@libsql/client'

export type SearchScope = 'tasks' | 'runs' | 'context' | 'schedules' | 'knowledge' | 'all'

export interface SearchResult {
	entityType: string
	entityId: string
	title: string | null
	snippet: string
	rank: number
}

/**
 * Search the FTS5 index for matching content.
 *
 * Uses SQLite FTS5 rank function for relevance ordering.
 * Scope filters by entity_type when not 'all'.
 */
export async function search(
	raw: Client,
	query: string,
	scope: SearchScope = 'all',
): Promise<SearchResult[]> {
	if (!query.trim()) return []

	// Sanitize FTS5 query: wrap each token in double quotes to prevent syntax errors
	const sanitized = query
		.trim()
		.split(/\s+/)
		.map((token) => `"${token.replace(/"/g, '""')}"`)
		.join(' ')

	const scopeMap: Record<string, string> = {
		tasks: 'task',
		runs: 'run',
		schedules: 'schedule',
		context: 'context',
		knowledge: 'knowledge',
	}
	const entityType = scope !== 'all' ? scopeMap[scope] : null

	const result = await raw.execute({
		sql: `
			SELECT
				si.entity_type,
				si.entity_id,
				si.title,
				snippet(search_fts, 1, '<b>', '</b>', '...', 32) AS snippet,
				rank
			FROM search_fts
			JOIN search_index si ON search_fts.rowid = si.id
			WHERE search_fts MATCH ?
			${entityType ? 'AND si.entity_type = ?' : ''}
			ORDER BY rank
			LIMIT 50
		`,
		args: entityType ? [sanitized, entityType] : [sanitized],
	})

	return result.rows.map((row) => ({
		entityType: String(row.entity_type),
		entityId: String(row.entity_id),
		title: row.title ? String(row.title) : null,
		snippet: String(row.snippet),
		rank: Number(row.rank),
	}))
}
