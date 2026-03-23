import { readdir } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { PATHS } from '@questpie/autopilot-spec'
import type { AutopilotDb } from './index'
import { indexEntity, removeEntity, searchFts, type SearchResult } from './search-index'

/**
 * Full reindex of all knowledge .md files at startup.
 * Writes into the unified search_index table via indexEntity().
 */
export async function reindexKnowledge(db: AutopilotDb, companyRoot: string): Promise<number> {
	const knowledgeDir = join(companyRoot, PATHS.KNOWLEDGE_DIR.replace(/^\/company/, ''))
	let count = 0

	async function indexDir(dir: string): Promise<void> {
		let entries: import('node:fs').Dirent[]
		try {
			entries = await readdir(dir, { withFileTypes: true })
		} catch {
			return
		}

		for (const entry of entries) {
			const fullPath = join(dir, entry.name)
			if (entry.isDirectory()) {
				await indexDir(fullPath)
			} else if (entry.name.endsWith('.md')) {
				try {
					const content = await Bun.file(fullPath).text()
					const relPath = relative(knowledgeDir, fullPath)
					const title = extractTitle(content, entry.name)
					await indexEntity(db, 'knowledge', relPath, title, content)
					count++
				} catch {
					// Skip unreadable files
				}
			}
		}
	}

	await indexDir(knowledgeDir)
	return count
}

/**
 * Incrementally reindex a single file.
 * Removes the old entry (if any) and inserts the updated content.
 */
export async function reindexFile(
	db: AutopilotDb,
	companyRoot: string,
	filePath: string,
): Promise<void> {
	const knowledgeDir = join(companyRoot, PATHS.KNOWLEDGE_DIR.replace(/^\/company/, ''))
	const relPath = relative(knowledgeDir, filePath)

	try {
		const file = Bun.file(filePath)
		if (await file.exists()) {
			const content = await file.text()
			const title = extractTitle(content, relPath.split('/').pop() ?? relPath)
			await indexEntity(db, 'knowledge', relPath, title, content)
		} else {
			await removeEntity(db, 'knowledge', relPath)
		}
	} catch {
		// File was deleted or unreadable — remove from index
		await removeEntity(db, 'knowledge', relPath)
	}
}

/**
 * Search the knowledge index using the unified FTS5 search.
 * Returns matching documents with snippet previews and rank scores.
 */
export function searchKnowledge(
	db: AutopilotDb,
	query: string,
	maxResults = 10,
): Array<{ path: string; title: string; snippet: string; rank: number }> {
	try {
		const results = searchFtsSync(db, query, maxResults)
		return results.map((r) => ({
			path: r.entityId,
			title: r.title ?? '',
			snippet: r.snippet,
			rank: r.score,
		}))
	} catch {
		return []
	}
}

/**
 * Synchronous wrapper for searchFts — knowledge search is called synchronously
 * in existing code paths.
 */
function searchFtsSync(
	db: AutopilotDb,
	query: string,
	limit: number,
): SearchResult[] {
	const { Database } = require('bun:sqlite') as typeof import('bun:sqlite')
	const raw = (db as unknown as { $client: InstanceType<typeof Database> }).$client

	try {
		const rows = raw.prepare(`
			SELECT
				si.entity_type,
				si.entity_id,
				si.title,
				snippet(search_fts, 1, '<b>', '</b>', '...', 40) as snippet,
				search_fts.rank as score
			FROM search_fts
			JOIN search_index si ON si.id = search_fts.rowid
			WHERE search_fts MATCH ?
			AND si.entity_type = 'knowledge'
			ORDER BY search_fts.rank
			LIMIT ?
		`).all(query, limit) as Array<{
			entity_type: string
			entity_id: string
			title: string | null
			snippet: string
			score: number
		}>

		return rows.map((r) => ({
			entityType: r.entity_type as 'knowledge',
			entityId: r.entity_id,
			title: r.title,
			snippet: r.snippet,
			score: r.score,
		}))
	} catch {
		return []
	}
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function extractTitle(content: string, fallback: string): string {
	// Extract first heading from markdown
	const match = content.match(/^#\s+(.+)$/m)
	if (match?.[1]) return match[1].trim()
	// Fallback to filename without extension
	return fallback.replace(/\.md$/, '')
}
