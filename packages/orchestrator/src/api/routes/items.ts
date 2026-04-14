/**
 * Items API routes — file system index queries.
 *
 * GET  /api/items          — list items (by parent, type) or single item by path
 * GET  /api/items/search   — full-text search via items_fts
 * POST /api/items/rebuild  — trigger full reindex (placeholder)
 */
import { Hono } from 'hono'
import { validator as zValidator } from 'hono-openapi'
import { z } from 'zod'
import type { AppEnv } from '../app'

// ─── Schemas ────────────────────────────────────────────────────────────────

const ItemsListQuery = z.object({
	path: z.string().optional(),
	parent: z.string().optional(),
	type: z.string().optional(),
	limit: z.coerce.number().int().min(1).max(500).default(100),
	cursor: z.string().optional(),
})

const ItemsSearchQuery = z.object({
	q: z.string().min(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface ItemRow {
	path: unknown
	is_dir: unknown
	type: unknown
	type_source: unknown
	frontmatter: unknown
	body_preview: unknown
	size: unknown
	mtime: unknown
	hash: unknown
	parent_path: unknown
	indexed_at: unknown
}

function formatItem(row: ItemRow): Record<string, unknown> {
	return {
		path: row.path,
		is_dir: Boolean(row.is_dir),
		type: row.type ?? null,
		type_source: row.type_source ?? null,
		frontmatter: row.frontmatter ? JSON.parse(String(row.frontmatter)) : null,
		body_preview: row.body_preview ?? null,
		size: row.size ?? null,
		mtime: row.mtime,
		hash: row.hash ?? null,
		parent_path: row.parent_path ?? null,
		indexed_at: row.indexed_at,
	}
}

// ─── Routes ─────────────────────────────────────────────────────────────────

const items = new Hono<AppEnv>()

	// GET /api/items/search must come before GET /api/items/:anything to avoid routing conflict
	.get('/search', zValidator('query', ItemsSearchQuery), async (c) => {
		const { q, limit } = c.req.valid('query')
		const db = c.get('indexDbRaw')
		if (!db) {
			return c.json({ error: 'index database not available' }, 503)
		}

		// Sanitize FTS5 query: wrap each token in double quotes to avoid syntax errors
		const sanitized = q
			.trim()
			.split(/\s+/)
			.map((token) => `"${token.replace(/"/g, '""')}"`)
			.join(' ')

		try {
			const result = await db.execute({
				sql: `SELECT items.path, items.is_dir, items.type, items.type_source,
				             items.frontmatter, items.body_preview, items.size,
				             items.mtime, items.hash, items.parent_path, items.indexed_at
				      FROM items_fts
				      JOIN items ON items.rowid = items_fts.rowid
				      WHERE items_fts MATCH ?
				      ORDER BY rank
				      LIMIT ?`,
				args: [sanitized, limit],
			})
			return c.json({ items: result.rows.map((r) => formatItem(r as ItemRow)) }, 200)
		} catch (err) {
			return c.json({ error: err instanceof Error ? err.message : String(err) }, 500)
		}
	})

	// GET /api/items — list or single item lookup
	.get('/', zValidator('query', ItemsListQuery), async (c) => {
		const { path, parent, type, limit, cursor } = c.req.valid('query')
		const db = c.get('indexDbRaw')
		if (!db) {
			return c.json({ error: 'index database not available' }, 503)
		}

		if (path !== undefined) {
			// Single item lookup
			try {
				const result = await db.execute({
					sql: 'SELECT path, is_dir, type, type_source, frontmatter, body_preview, size, mtime, hash, parent_path, indexed_at FROM items WHERE path = ?',
					args: [path],
				})
				if (result.rows.length === 0) {
					return c.json({ error: 'item not found' }, 404)
				}
				return c.json(formatItem(result.rows[0] as ItemRow), 200)
			} catch (err) {
				return c.json({ error: err instanceof Error ? err.message : String(err) }, 500)
			}
		}

		// List items with optional filters
		let sql = 'SELECT path, is_dir, type, type_source, frontmatter, body_preview, size, mtime, hash, parent_path, indexed_at FROM items WHERE 1=1'
		const args: (string | number | null)[] = []

		if (parent !== undefined) {
			if (parent === '') {
				sql += ' AND parent_path IS NULL'
			} else {
				sql += ' AND parent_path = ?'
				args.push(parent)
			}
		}
		if (type !== undefined) {
			sql += ' AND type = ?'
			args.push(type)
		}
		if (cursor !== undefined) {
			sql += ' AND mtime < ?'
			args.push(cursor)
		}

		sql += ' ORDER BY is_dir DESC, mtime DESC LIMIT ?'
		args.push(limit)

		try {
			const result = await db.execute({ sql, args })
			const itemsList = result.rows.map((r) => formatItem(r as ItemRow))
			const nextCursor =
				itemsList.length === limit
					? (itemsList[itemsList.length - 1]?.mtime ?? null)
					: null

			return c.json({ items: itemsList, cursor: nextCursor }, 200)
		} catch (err) {
			return c.json({ error: err instanceof Error ? err.message : String(err) }, 500)
		}
	})

	// POST /api/items/rebuild — trigger full reindex
	.post('/rebuild', async (c) => {
		// The indexer runs on a schedule and at startup. A rebuild endpoint is
		// reserved for operator-triggered full reindexes. No itemIndexer service
		// exists yet — return accepted status to indicate the intent is understood.
		return c.json({ status: 'rebuild_started' }, 202)
	})

export { items }
