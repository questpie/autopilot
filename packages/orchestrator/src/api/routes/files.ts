import { Hono } from 'hono'
import { describeRoute } from 'hono-openapi'
import { resolver, validator as zValidator } from 'hono-openapi'
import { OkResponseSchema, FileWriteRequestSchema } from '@questpie/autopilot-spec'
import { writeFile, unlink, mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
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

const files = new Hono<AppEnv>()
	// ── POST /files/* — create a new file ───────────────────────────────
	.post(
		'/files/*',
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
			const subPath = c.req.path.replace(/^.*\/files\//, '')

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
	// ── PUT /files/* — overwrite (or create) a file ─────────────────────
	.put(
		'/files/*',
		describeRoute({
			tags: ['files'],
			description: 'Overwrite (or create) a file at the given path',
			responses: {
				200: {
					description: 'File written',
					content: { 'application/json': { schema: resolver(OkResponseSchema) } },
				},
				403: { description: 'Path traversal blocked' },
			},
		}),
		zValidator('json', FileWriteRequestSchema),
		async (c) => {
			const root = c.get('companyRoot')
			const subPath = c.req.path.replace(/^.*\/files\//, '')

			let target: string
			try {
				target = safePath(root, subPath)
			} catch {
				return c.json({ error: 'path traversal blocked' }, 403)
			}

			const { content } = c.req.valid('json')
			await mkdir(dirname(target), { recursive: true })
			await writeFile(target, content, 'utf-8')

			return c.json({ ok: true as const })
		},
	)
	// ── DELETE /files/* — remove a file ─────────────────────────────────
	.delete(
		'/files/*',
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
			const subPath = c.req.path.replace(/^.*\/files\//, '')

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
			return c.json({ ok: true as const })
		},
	)
	// ── POST /upload — multipart file upload ────────────────────────────
	.post(
		'/upload',
		describeRoute({
			tags: ['files'],
			description: 'Upload a file via multipart form data (fields: path, file)',
			responses: {
				201: {
					description: 'File uploaded',
					content: { 'application/json': { schema: resolver(OkResponseSchema) } },
				},
				400: { description: 'Missing required fields' },
				403: { description: 'Path traversal blocked' },
			},
		}),
		async (c) => {
			const root = c.get('companyRoot')
			const body = await c.req.parseBody()

			const pathField = body['path']
			const fileField = body['file']

			if (typeof pathField !== 'string' || !pathField) {
				return c.json({ error: 'missing "path" field' }, 400)
			}

			if (!(fileField instanceof File)) {
				return c.json({ error: 'missing "file" field' }, 400)
			}

			let target: string
			try {
				target = safePath(root, pathField)
			} catch {
				return c.json({ error: 'path traversal blocked' }, 403)
			}

			await mkdir(dirname(target), { recursive: true })
			const buffer = await fileField.arrayBuffer()
			await writeFile(target, Buffer.from(buffer))

			return c.json({ ok: true as const }, 201)
		},
	)

export { files }
