import { watch as fsWatch } from 'node:fs'
import { readFile, readdir, stat } from 'node:fs/promises'
import { join, dirname, extname } from 'node:path'
import { createHash } from 'node:crypto'
import { parse as parseYaml } from 'yaml'
import type { Client } from '@libsql/client'
import type { EventBus } from '../events/event-bus'

// ─── Type resolver contract ────────────────────────────────────────────────
// These interfaces will be replaced with imports from the type-schema-registry
// once that agent's work is merged.

export interface ResolverInput {
	path: string
	is_dir: boolean
	frontmatter: Record<string, unknown> | null
}

export interface ResolverResult {
	type: string | null
	source: string
}

export type TypeResolverFn = (input: ResolverInput) => ResolverResult

// ─── Options ───────────────────────────────────────────────────────────────

export interface ItemIndexerOptions {
	companyRoot: string
	indexDb: Client
	eventBus: EventBus
	resolveType: TypeResolverFn
	debounceMs?: number
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function parseYamlSafe(content: string): Record<string, unknown> | null {
	try {
		const result = parseYaml(content, { logLevel: 'silent' })
		return typeof result === 'object' && result !== null ? (result as Record<string, unknown>) : null
	} catch {
		return null
	}
}

function parseFrontmatter(content: string, relPath?: string): {
	frontmatter: Record<string, unknown> | null
	body: string | null
} {
	const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
	if (!match) {
		// Try parsing entire file as YAML — only for .yaml/.yml files without --- fences
		const ext = relPath ? extname(relPath).toLowerCase() : ''
		if (ext === '.yaml' || ext === '.yml') {
			return { frontmatter: parseYamlSafe(content), body: null }
		}
		return { frontmatter: null, body: content }
	}
	return {
		frontmatter: parseYamlSafe(match[1]!),
		body: match[2] ?? null,
	}
}

/** File extensions that are binary or not worth parsing for frontmatter. */
const BINARY_EXTENSIONS = new Set([
	'.pdf', '.eps', '.ai', '.psd', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico',
	'.svg', '.webp', '.avif', '.tiff', '.tif',
	'.mp3', '.mp4', '.wav', '.ogg', '.webm', '.mov', '.avi',
	'.zip', '.tar', '.gz', '.bz2', '.rar', '.7z',
	'.woff', '.woff2', '.ttf', '.otf', '.eot',
	'.exe', '.dll', '.so', '.dylib', '.bin',
	'.db', '.sqlite', '.sqlite3',
	'.lock', '.map',
])

// ─── ItemIndexer ───────────────────────────────────────────────────────────

export class ItemIndexer {
	private readonly companyRoot: string
	private readonly db: Client
	private readonly eventBus: EventBus
	private readonly resolveType: TypeResolverFn
	private readonly debounceMs: number
	private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>()
	private watcher: ReturnType<typeof fsWatch> | null = null

	constructor(options: ItemIndexerOptions) {
		this.companyRoot = options.companyRoot
		this.db = options.indexDb
		this.eventBus = options.eventBus
		this.resolveType = options.resolveType
		this.debounceMs = options.debounceMs ?? 300
	}

	/** Start watching and do initial full scan. */
	async start(): Promise<void> {
		console.log('[item-indexer] Starting initial scan...')
		await this.fullRebuild()
		console.log('[item-indexer] Initial scan complete, starting watcher')
		this.startWatcher()
	}

	/** Stop the watcher and cancel pending debounce timers. */
	stop(): void {
		if (this.watcher) {
			this.watcher.close()
			this.watcher = null
		}
		for (const timer of this.debounceTimers.values()) {
			clearTimeout(timer)
		}
		this.debounceTimers.clear()
	}

	/** Truncate items table and re-scan everything from companyRoot. */
	async fullRebuild(): Promise<void> {
		await this.db.execute('DELETE FROM items')
		await this.walkAndIndex('')
	}

	// ─── Private ─────────────────────────────────────────────────────────────

	private startWatcher(): void {
		this.watcher = fsWatch(this.companyRoot, { recursive: true }, (_, filename) => {
			if (!filename) return
			const relPath = filename.replace(/\\/g, '/')
			if (this.shouldIgnore(relPath)) return

			const existing = this.debounceTimers.get(relPath)
			if (existing) clearTimeout(existing)
			this.debounceTimers.set(
				relPath,
				setTimeout(() => {
					this.debounceTimers.delete(relPath)
					void this.handleChange(relPath)
				}, this.debounceMs),
			)
		})
	}

	private shouldIgnore(relPath: string): boolean {
		if (relPath.startsWith('.git/') || relPath.includes('/.git/')) return true
		if (relPath.includes('node_modules/')) return true
		if (relPath.includes('.DS_Store')) return true
		if (relPath.startsWith('.autopilot/')) return true
		if (relPath.startsWith('.data/')) return true
		return false
	}

	/** Returns true for file extensions that are binary / not worth frontmatter-parsing. */
	private isBinaryExt(relPath: string): boolean {
		const ext = extname(relPath).toLowerCase()
		return BINARY_EXTENSIONS.has(ext)
	}

	private async handleChange(relPath: string): Promise<void> {
		const absPath = join(this.companyRoot, relPath)
		try {
			const stats = await stat(absPath).catch(() => null)
			if (!stats) {
				await this.removeItem(relPath)
				return
			}
			await this.indexPath(relPath, stats.isDirectory(), stats)
		} catch (err) {
			console.error(
				`[item-indexer] Error handling change for ${relPath}:`,
				err instanceof Error ? err.message : String(err),
			)
		}
	}

	private async indexPath(
		relPath: string,
		isDir: boolean,
		stats?: Awaited<ReturnType<typeof stat>> | null,
	): Promise<void> {
		const absPath = join(this.companyRoot, relPath)

		const resolvedStats = stats ?? (await stat(absPath).catch(() => null))
		if (!resolvedStats) return

		let frontmatter: Record<string, unknown> | null = null
		let bodyPreview: string | null = null
		let hash: string | null = null

		if (isDir) {
			const folderYaml = join(absPath, '.folder.yaml')
			try {
				const content = await readFile(folderYaml, 'utf-8')
				frontmatter = parseYamlSafe(content)
			} catch {
				// No .folder.yaml — that's fine
			}
		} else if (!this.isBinaryExt(relPath)) {
			try {
				const content = await readFile(absPath, 'utf-8')
				hash = createHash('sha256').update(content).digest('hex').slice(0, 16)

				const existing = await this.db.execute({
					sql: 'SELECT hash FROM items WHERE path = ?',
					args: [relPath],
				})
				if (existing.rows.length > 0 && existing.rows[0]!['hash'] === hash) {
					return
				}

				const parsed = parseFrontmatter(content, relPath)
				frontmatter = parsed.frontmatter
				bodyPreview = parsed.body?.slice(0, 500) ?? null
			} catch {
				// Unreadable file — index with minimal metadata
			}
		}

		const parentPath = relPath.includes('/') ? dirname(relPath) : null
		const resolved = this.resolveType({ path: relPath, is_dir: isDir, frontmatter })
		const now = new Date().toISOString()

		await this.db.execute({
			sql: `INSERT OR REPLACE INTO items (path, is_dir, type, type_source, frontmatter, body_preview, size, mtime, hash, parent_path, indexed_at)
			      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			args: [
				relPath,
				isDir ? 1 : 0,
				resolved.type,
				resolved.source,
				frontmatter ? JSON.stringify(frontmatter) : null,
				bodyPreview,
				isDir ? null : resolvedStats.size,
				resolvedStats.mtime.toISOString(),
				hash,
				parentPath,
				now,
			],
		})

		this.emitItemsChanged([relPath])
	}

	private async removeItem(relPath: string): Promise<void> {
		await this.db.execute({
			sql: 'DELETE FROM items WHERE path = ? OR path LIKE ?',
			args: [relPath, `${relPath}/%`],
		})
		this.emitItemsChanged([relPath])
	}

	private async walkAndIndex(dirRelPath: string): Promise<void> {
		const absDir = dirRelPath ? join(this.companyRoot, dirRelPath) : this.companyRoot

		// Index the directory itself first (except root)
		if (dirRelPath) {
			const dirStats = await stat(absDir).catch(() => null)
			if (dirStats) {
				await this.indexPath(dirRelPath, true, dirStats)
			}
		}

		let names: string[]
		try {
			names = await readdir(absDir)
		} catch {
			return
		}

		for (const name of names) {
			const entryRelPath = dirRelPath ? `${dirRelPath}/${name}` : name
			if (this.shouldIgnore(entryRelPath)) continue

			const entryStats = await stat(join(absDir, name)).catch(() => null)
			if (!entryStats) continue

			if (entryStats.isDirectory()) {
				await this.walkAndIndex(entryRelPath)
			} else {
				await this.indexPath(entryRelPath, false, entryStats)
			}
		}
	}

	private emitItemsChanged(paths: string[]): void {
		this.eventBus.emit({ type: 'items_changed', paths })
	}
}
