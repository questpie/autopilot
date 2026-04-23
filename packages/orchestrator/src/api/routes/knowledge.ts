import { Hono } from 'hono'
import { validator as zValidator } from 'hono-openapi'
import { z } from 'zod'
import type { KnowledgeScopeInput } from '../../services/knowledge'
import type { AppEnv } from '../app'

const scopeQuerySchema = z.object({
	path: z.string().optional(),
	scope_type: z.enum(['company', 'project', 'task']).optional(),
	scope_id: z.string().optional(),
	project_id: z.string().optional(),
	task_id: z.string().optional(),
})

const writeBodySchema = z.object({
	content: z.string(),
	title: z.string().optional(),
	mime_type: z.string().optional(),
	scope_type: z.enum(['company', 'project', 'task']).optional(),
	scope_id: z.string().optional(),
	project_id: z.string().optional(),
	task_id: z.string().optional(),
})

function scopeFrom(
	input: z.infer<typeof scopeQuerySchema> | z.infer<typeof writeBodySchema>,
): KnowledgeScopeInput {
	return {
		scope_type: input.scope_type,
		scope_id: input.scope_id,
		project_id: input.project_id,
		task_id: input.task_id,
	}
}

function pathFromRequest(url: string): string {
	const pathname = new URL(url).pathname
	const marker = '/api/knowledge/'
	const index = pathname.indexOf(marker)
	if (index === -1) return ''
	return decodeURIComponent(pathname.slice(index + marker.length))
}

function serviceUnavailable() {
	return Response.json({ error: 'knowledge service not available' }, { status: 503 })
}

const knowledgeRoute = new Hono<AppEnv>()
	.get('/', zValidator('query', scopeQuerySchema), async (c) => {
		const { knowledgeService } = c.get('services')
		if (!knowledgeService) return serviceUnavailable()
		const query = c.req.valid('query')
		return c.json(await knowledgeService.list({ ...scopeFrom(query), path: query.path }), 200)
	})
	.get(
		'/search',
		zValidator('query', scopeQuerySchema.extend({ q: z.string().min(1) })),
		async (c) => {
			const { knowledgeService } = c.get('services')
			if (!knowledgeService) return serviceUnavailable()
			const query = c.req.valid('query')
			return c.json({ results: await knowledgeService.search(query.q, scopeFrom(query)) }, 200)
		},
	)
	.get('/*', zValidator('query', scopeQuerySchema), async (c) => {
		const { knowledgeService } = c.get('services')
		if (!knowledgeService) return serviceUnavailable()
		const doc = await knowledgeService.get(
			pathFromRequest(c.req.url),
			scopeFrom(c.req.valid('query')),
		)
		if (!doc) return c.json({ error: 'knowledge document not found' }, 404)
		return c.json(doc, 200)
	})
	.put('/*', zValidator('query', scopeQuerySchema), async (c) => {
		const { knowledgeService } = c.get('services')
		if (!knowledgeService) return serviceUnavailable()
		const query = c.req.valid('query')
		const contentType = c.req.header('content-type') ?? ''
		if (contentType.includes('application/json')) {
			const body = writeBodySchema.parse(await c.req.json())
			return c.json(
				await knowledgeService.write({
					...scopeFrom({ ...query, ...body }),
					path: pathFromRequest(c.req.url),
					content: body.content,
					title: body.title,
					mime_type: body.mime_type,
				}),
				200,
			)
		}

		const content = Buffer.from(await c.req.arrayBuffer())
		return c.json(
			await knowledgeService.write({
				...scopeFrom(query),
				path: pathFromRequest(c.req.url),
				content,
				mime_type: contentType || undefined,
			}),
			200,
		)
	})
	.delete('/*', zValidator('query', scopeQuerySchema), async (c) => {
		const { knowledgeService } = c.get('services')
		if (!knowledgeService) return serviceUnavailable()
		const deleted = await knowledgeService.delete(
			pathFromRequest(c.req.url),
			scopeFrom(c.req.valid('query')),
		)
		if (!deleted) return c.json({ error: 'knowledge document not found' }, 404)
		return c.json({ deleted: true }, 200)
	})

export { knowledgeRoute }
