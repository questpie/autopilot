import { Hono } from 'hono'
import { describeRoute } from 'hono-openapi'
import { resolver } from 'hono-openapi'
import { z } from 'zod'
import { readdir, stat } from 'node:fs/promises'
import { resolve, join, extname, relative } from 'node:path'
import { FsEntrySchema } from '@questpie/autopilot-spec'
import type { AppEnv } from '../app'
import { isDeniedPath } from '../../auth/deny-patterns'

const CONTENT_TYPE_MAP: Record<string, string> = {
	'.md': 'text/markdown; charset=utf-8',
	'.yaml': 'text/yaml; charset=utf-8',
	'.yml': 'text/yaml; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.txt': 'text/plain; charset=utf-8',
	'.html': 'text/html; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.ts': 'text/typescript; charset=utf-8',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.svg': 'image/svg+xml',
	'.pdf': 'application/pdf',
}

/**
 * Resolve the requested sub-path against the company root and guard against
 * path traversal.
 */
function safePath(root: string, subPath: string): string {
	const resolvedRoot = resolve(root)
	const target = resolve(resolvedRoot, subPath)
	if (!target.startsWith(resolvedRoot)) {
		throw new Error('path traversal detected')
	}
	return target
}

const fsBrowser = new Hono<AppEnv>().get(
	'/*',
	describeRoute({
		tags: ['fs-browser'],
		description:
			'Raw filesystem browser — returns directory listings as JSON or file contents with the appropriate Content-Type',
		responses: {
			200: {
				description: 'Directory listing or file contents',
				content: {
					'application/json': {
						schema: resolver(z.array(FsEntrySchema)),
					},
				},
			},
			403: { description: 'Path traversal blocked' },
			404: { description: 'Path not found' },
		},
	}),
	async (c) => {
		const root = c.get('companyRoot')
		const subPath = c.req.path.replace(/^\/fs\/?/, '') || '.'

		let target: string
		try {
			target = safePath(root, subPath)
		} catch {
			return c.json({ error: 'path traversal blocked' }, 403)
		}

		// ── Compute relative path for policy checks ───────────────────────
		const relativePath = relative(resolve(root), target)

		// ── Actor-based access checks ─────────────────────────────────────
		const actor = c.get('actor')

		// Deny patterns apply to agents (not human users who may need config access)
		if (actor?.type === 'agent' && isDeniedPath(relativePath)) {
			return c.json({ error: 'access denied' }, 403)
		}

		// Role-based scope for viewers
		if (actor?.role === 'viewer') {
			const VIEWER_ALLOWED = ['knowledge/', 'dashboard/', 'team/']
			const isAllowed = VIEWER_ALLOWED.some(
				(prefix) => relativePath === prefix.slice(0, -1) || relativePath.startsWith(prefix),
			)
			if (!isAllowed) {
				return c.json({ error: 'access denied' }, 403)
			}
		}

		let info: Awaited<ReturnType<typeof stat>>
		try {
			info = await stat(target)
		} catch {
			return c.json({ error: 'not found' }, 404)
		}

		// ── Directory listing ────────────────────────────────────────────
		if (info.isDirectory()) {
			const entries = await readdir(target)

			const listing = await Promise.all(
				entries
					.filter((name) => !name.startsWith('.'))
					.filter((name) => {
						if (actor?.type !== 'agent') return true
						const entryRelative = join(relativePath, name)
						return !isDeniedPath(entryRelative)
					})
					.map(async (name) => {
						const entryPath = join(target, name)
						try {
							const entryStat = await stat(entryPath)
							return {
								name,
								type: entryStat.isDirectory() ? ('directory' as const) : ('file' as const),
								size: entryStat.isDirectory() ? 0 : entryStat.size,
							}
						} catch {
							return { name, type: 'file' as const, size: 0 }
						}
					}),
			)

			return c.json(listing)
		}

		// ── File serving ─────────────────────────────────────────────────
		const ext = extname(target).toLowerCase()
		const contentType = CONTENT_TYPE_MAP[ext] ?? 'application/octet-stream'

		const file = Bun.file(target)
		return new Response(file.stream(), {
			headers: { 'Content-Type': contentType, 'Content-Length': String(info.size) },
		})
	},
)

export { fsBrowser }
