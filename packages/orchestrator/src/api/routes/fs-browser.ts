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

async function browseFs(
	root: string,
	subPath: string,
	actor: { type?: string; role?: string; id?: string } | null,
) {
	const pathToResolve = subPath || '.'

	let target: string
	try {
		target = safePath(root, pathToResolve)
	} catch {
		return { error: 'path traversal blocked' as const, status: 403 as const }
	}

	const relativePath = relative(resolve(root), target)

	if (actor?.type === 'agent' && isDeniedPath(relativePath)) {
		return { error: 'access denied' as const, status: 403 as const }
	}

	if (actor?.role === 'viewer') {
		const VIEWER_ALLOWED = ['knowledge/', 'dashboard/', 'team/']
		const isAllowed = VIEWER_ALLOWED.some(
			(prefix) => relativePath === prefix.slice(0, -1) || relativePath.startsWith(prefix),
		)
		if (!isAllowed) {
			return { error: 'access denied' as const, status: 403 as const }
		}
	}

	let info: Awaited<ReturnType<typeof stat>>
	try {
		info = await stat(target)
	} catch {
		return { error: 'not found' as const, status: 404 as const }
	}

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

		return { data: listing }
	}

	// File serving — return a raw Response
	const ext = extname(target).toLowerCase()
	const contentType = CONTENT_TYPE_MAP[ext] ?? 'application/octet-stream'
	const file = Bun.file(target)
	return {
		response: new Response(file.stream(), {
			headers: { 'Content-Type': contentType, 'Content-Length': String(info.size) },
		}),
	}
}

const fsBrowser = new Hono<AppEnv>()
	// ── GET / — root directory listing ───────────────────────────────
	.get(
		'/',
		describeRoute({
			tags: ['fs-browser'],
			description: 'Raw filesystem browser — root directory listing',
			responses: {
				200: {
					description: 'Directory listing',
					content: {
						'application/json': {
							schema: resolver(z.array(FsEntrySchema)),
						},
					},
				},
			},
		}),
		async (c) => {
			const result = await browseFs(c.get('companyRoot'), '', c.get('actor'))
			if ('error' in result) return c.json({ error: result.error }, result.status)
			if ('response' in result) return result.response
			return c.json(result.data, 200)
		},
	)
	// ── GET /:path — sub-path browsing ───────────────────────────────
	.get(
		'/:path{.+}',
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
			const subPath = c.req.param('path')
			const result = await browseFs(c.get('companyRoot'), subPath, c.get('actor'))
			if ('error' in result) return c.json({ error: result.error }, result.status)
			if ('response' in result) return result.response
			return c.json(result.data, 200)
		},
	)

export { fsBrowser }
