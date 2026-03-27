import { Hono } from 'hono'
import { describeRoute } from 'hono-openapi'
import { resolver, validator as zValidator } from 'hono-openapi'
import { z } from 'zod'
import { OkResponseSchema, FileWriteRequestSchema } from '@questpie/autopilot-spec'
import { writeFile, unlink, mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { acquireLock, releaseLock, getLockStatus, computeFileHash } from '../../fs/file-locks'
import { eventBus } from '../../events/event-bus'
import type { AppEnv } from '../app'

/**
 * Resolve the requested sub-path against the company root and guard against
 * path traversal. Returns the absolute path or throws a 403.
 */
function safePath(root: string, subPath: string): string {
	const resolvedRoot = resolve(root)
	const target = resolve(resolvedRoot, subPath)
	if (!target.startsWith(resolvedRoot)) {
		throw new Error('path traversal detected')
	}
	return target
}

const LockResponseSchema = z.object({
	path: z.string(),
	locked_by: z.string(),
	locked_at: z.number(),
	expires_at: z.number(),
})

const files = new Hono<AppEnv>()
	// ── GET /files/:path — read file content ────────────────────────────
	.get(
		'/files/:path{.+}',
		describeRoute({
			tags: ['files'],
			description: 'Read a file at the given path',
			responses: {
				200: { description: 'File content' },
				403: { description: 'Path traversal blocked' },
				404: { description: 'File not found' },
			},
		}),
		async (c) => {
			const root = c.get('companyRoot')
			const subPath = c.req.param('path')

			let target: string
			try {
				target = safePath(root, subPath)
			} catch {
				return c.json({ error: 'path traversal blocked' }, 403)
			}

			const file = Bun.file(target)
			if (!(await file.exists())) {
				return c.json({ error: 'file not found' }, 404)
			}

			const content = await file.text()
			const hash = await computeFileHash(content)

			// Return ETag header so clients can use If-Match on PUT
			c.header('ETag', `"${hash}"`)
			return c.json({ content, hash }, 200)
		},
	)
	// ── POST /files/:path — create a new file ───────────────────────────
	.post(
		'/files/:path{.+}',
		describeRoute({
			tags: ['files'],
			description: 'Create a new file at the given path (fails if file already exists)',
			responses: {
				201: {
					description: 'File created',
					content: { 'application/json': { schema: resolver(OkResponseSchema) } },
				},
				403: { description: 'Path traversal blocked' },
				409: { description: 'File already exists' },
			},
		}),
		zValidator('json', FileWriteRequestSchema),
		async (c) => {
			const root = c.get('companyRoot')
			const subPath = c.req.param('path')

			let target: string
			try {
				target = safePath(root, subPath)
			} catch {
				return c.json({ error: 'path traversal blocked' }, 403)
			}

			const file = Bun.file(target)
			if (await file.exists()) {
				return c.json({ error: 'file already exists' }, 409)
			}

			const { content } = c.req.valid('json')
			await mkdir(dirname(target), { recursive: true })
			await writeFile(target, content, 'utf-8')

			return c.json({ ok: true as const }, 201)
		},
	)
	// ── PUT /files/:path — overwrite (or create) a file ─────────────────
	.put(
		'/files/:path{.+}',
		describeRoute({
			tags: ['files'],
			description: 'Overwrite (or create) a file at the given path. Supports If-Match header for optimistic concurrency.',
			responses: {
				200: {
					description: 'File written',
					content: { 'application/json': { schema: resolver(OkResponseSchema) } },
				},
				403: { description: 'Path traversal blocked' },
				409: { description: 'Conflict — file changed since last read' },
				423: { description: 'Locked — file is locked by another actor' },
			},
		}),
		zValidator('json', FileWriteRequestSchema),
		async (c) => {
			const root = c.get('companyRoot')
			const db = c.get('db')
			const actor = c.get('actor')
			const subPath = c.req.param('path')

			let target: string
			try {
				target = safePath(root, subPath)
			} catch {
				return c.json({ error: 'path traversal blocked' }, 403)
			}

			// Check file lock
			const lock = await getLockStatus(db, subPath)
			if (lock && actor && lock.locked_by !== actor.id) {
				return c.json({
					error: 'File is locked',
					locked_by: lock.locked_by,
					expires_at: lock.expires_at,
				}, 423)
			}

			// Optimistic concurrency: If-Match header
			const ifMatch = c.req.header('If-Match')
			if (ifMatch) {
				const expectedHash = ifMatch.replace(/^"/, '').replace(/"$/, '')
				const file = Bun.file(target)
				if (await file.exists()) {
					const currentContent = await file.text()
					const currentHash = await computeFileHash(currentContent)

					if (currentHash !== expectedHash) {
						return c.json({
							error: 'Conflict — file changed since last read',
							current_hash: currentHash,
							current_content: currentContent,
						}, 409)
					}
				}
			}

			const { content } = c.req.valid('json')
			await mkdir(dirname(target), { recursive: true })
			await writeFile(target, content, 'utf-8')

			return c.json({ ok: true as const }, 200)
		},
	)
	// ── DELETE /files/:path — remove a file ─────────────────────────────
	.delete(
		'/files/:path{.+}',
		describeRoute({
			tags: ['files'],
			description: 'Delete a file at the given path',
			responses: {
				200: {
					description: 'File deleted',
					content: { 'application/json': { schema: resolver(OkResponseSchema) } },
				},
				403: { description: 'Path traversal blocked' },
				404: { description: 'File not found' },
			},
		}),
		async (c) => {
			const root = c.get('companyRoot')
			const subPath = c.req.param('path')

			let target: string
			try {
				target = safePath(root, subPath)
			} catch {
				return c.json({ error: 'path traversal blocked' }, 403)
			}

			const file = Bun.file(target)
			if (!(await file.exists())) {
				return c.json({ error: 'file not found' }, 404)
			}

			await unlink(target)
			return c.json({ ok: true as const }, 200)
		},
	)
	// ── POST /files/:path/lock — acquire a lock ─────────────────────────
	.post(
		'/files/:path{.+}/lock',
		describeRoute({
			tags: ['files'],
			description: 'Acquire an advisory lock on a file (expires after 60s)',
			responses: {
				200: {
					description: 'Lock acquired',
					content: { 'application/json': { schema: resolver(LockResponseSchema) } },
				},
				423: { description: 'File already locked by another actor' },
			},
		}),
		async (c) => {
			const db = c.get('db')
			const actor = c.get('actor')
			const subPath = c.req.param('path')
			const actorId = actor?.id ?? 'anonymous'

			const lock = await acquireLock(db, subPath, actorId)
			if (!lock) {
				const current = await getLockStatus(db, subPath)
				return c.json({
					error: 'File is locked by another actor',
					locked_by: current?.locked_by,
					expires_at: current?.expires_at,
				}, 423)
			}

			eventBus.emit({ type: 'file_locked', path: subPath, lockedBy: actorId })
			return c.json(lock, 200)
		},
	)
	// ── DELETE /files/:path/lock — release a lock ───────────────────────
	.delete(
		'/files/:path{.+}/lock',
		describeRoute({
			tags: ['files'],
			description: 'Release an advisory lock on a file',
			responses: {
				200: {
					description: 'Lock released',
					content: { 'application/json': { schema: resolver(z.object({ ok: z.literal(true) })) } },
				},
				404: { description: 'No lock found' },
			},
		}),
		async (c) => {
			const db = c.get('db')
			const actor = c.get('actor')
			const subPath = c.req.param('path')
			const actorId = actor?.id ?? 'anonymous'

			const released = await releaseLock(db, subPath, actorId)
			if (!released) {
				return c.json({ error: 'No lock found or not owned by you' }, 404)
			}

			eventBus.emit({ type: 'file_unlocked', path: subPath })
			return c.json({ ok: true as const }, 200)
		},
	)
	// ── GET /files/:path/lock — check lock status ───────────────────────
	.get(
		'/files/:path{.+}/lock',
		describeRoute({
			tags: ['files'],
			description: 'Check the lock status of a file',
			responses: {
				200: {
					description: 'Lock status',
					content: { 'application/json': { schema: resolver(LockResponseSchema.nullable()) } },
				},
			},
		}),
		async (c) => {
			const db = c.get('db')
			const subPath = c.req.param('path')

			const lock = await getLockStatus(db, subPath)
			return c.json({ lock }, 200)
		},
	)

export { files }
