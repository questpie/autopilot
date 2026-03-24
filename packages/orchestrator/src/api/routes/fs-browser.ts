import { Hono } from 'hono'
import { describeRoute } from 'hono-openapi'
import { resolver } from 'hono-openapi'
import { z } from 'zod'
import { readdir, stat } from 'node:fs/promises'
import { resolve, join, extname } from 'node:path'
import { FsEntrySchema } from '@questpie/autopilot-spec'
import type { AppEnv } from '../app'

const fsBrowser = new Hono<AppEnv>()

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

fsBrowser.get(
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
