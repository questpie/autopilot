import { Database } from 'bun:sqlite'
import { readdir } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { PATHS } from '@questpie/autopilot-spec'
import type { AutopilotDb } from './index'

/**
 * Initialize the FTS5 knowledge index virtual table.
 * Uses raw SQL because Drizzle ORM does not support virtual tables.
 */
export function initKnowledgeFts(db: AutopilotDb): void {
	const raw = getRawDb(db)

	try {
		raw.exec(`
			CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
				path,
				title,
				content,
				tokenize='porter unicode61'
			)
		`)
	} catch {
		// Already exists
	}
}

/**
 * Full reindex of all knowledge .md files at startup.
 * Clears the existing index and re-scans the knowledge directory.
 */
export async function reindexKnowledge(db: AutopilotDb, companyRoot: string): Promise<number> {
	const raw = getRawDb(db)
	initKnowledgeFts(db)

	// Clear existing index
	raw.exec("DELETE FROM knowledge_fts")

	const knowledgeDir = join(companyRoot, PATHS.KNOWLEDGE_DIR.replace(/^\/company/, ''))
	let count = 0

	const insertStmt = raw.prepare(
		'INSERT INTO knowledge_fts(path, title, content) VALUES (?, ?, ?)',
	)

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
					insertStmt.run(relPath, title, content)
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
	const raw = getRawDb(db)
	initKnowledgeFts(db)

	const knowledgeDir = join(companyRoot, PATHS.KNOWLEDGE_DIR.replace(/^\/company/, ''))
	const relPath = relative(knowledgeDir, filePath)

	// Remove old entry
	raw.prepare("DELETE FROM knowledge_fts WHERE path = ?").run(relPath)

	// Re-add if file still exists
	try {
		const file = Bun.file(filePath)
		if (await file.exists()) {
			const content = await file.text()
			const title = extractTitle(content, relPath.split('/').pop() ?? relPath)
			raw.prepare(
				'INSERT INTO knowledge_fts(path, title, content) VALUES (?, ?, ?)',
			).run(relPath, title, content)
		}
	} catch {
		// File was deleted or unreadable — removal is enough
	}
}

/**
 * Search the knowledge index using FTS5 queries.
 * Returns matching documents with snippet previews and rank scores.
 */
export function searchKnowledge(
	db: AutopilotDb,
	query: string,
	maxResults = 10,
): Array<{ path: string; title: string; snippet: string; rank: number }> {
	const raw = getRawDb(db)

	try {
		const rows = raw.prepare(`
			SELECT
				path,
				title,
				snippet(knowledge_fts, 2, '<b>', '</b>', '...', 40) as snippet,
				rank
			FROM knowledge_fts
			WHERE knowledge_fts MATCH ?
			ORDER BY rank
			LIMIT ?
		`).all(query, maxResults) as Array<{
			path: string
			title: string
			snippet: string
			rank: number
		}>

		return rows
	} catch {
		return []
	}
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function getRawDb(db: AutopilotDb): Database {
	return (db as unknown as { $client: Database }).$client
}

function extractTitle(content: string, fallback: string): string {
	// Extract first heading from markdown
	const match = content.match(/^#\s+(.+)$/m)
	if (match?.[1]) return match[1].trim()
	// Fallback to filename without extension
	return fallback.replace(/\.md$/, '')
}
