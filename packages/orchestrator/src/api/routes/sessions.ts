/**
 * Session inspection routes.
 *
 * GET /api/sessions               — list sessions (filterable by provider, status, mode, task_id)
 * GET /api/sessions/:id           — get single session
 * GET /api/sessions/:id/messages  — get enriched messages for session
 */
import { Hono } from 'hono'
import { validator as zValidator } from 'hono-openapi'
import { z } from 'zod'
import type { AppEnv } from '../app'

function safeParseJson(raw: string | null | undefined): Record<string, unknown> {
	if (!raw) return {}
	try {
		return JSON.parse(raw) as Record<string, unknown>
	} catch {
		return {}
	}
}

const sessionsRoute = new Hono<AppEnv>()
	.get(
		'/',
		zValidator(
			'query',
			z.object({
				provider_id: z.string().optional(),
				status: z.string().optional(),
				mode: z.string().optional(),
				task_id: z.string().optional(),
			}),
		),
		async (c) => {
			const { sessionService } = c.get('services')
			const { task_id, ...filter } = c.req.valid('query')
			if (task_id) {
				const result = await sessionService.listForTask(task_id)
				return c.json(result, 200)
			}
			const result = await sessionService.list(filter)
			return c.json(result, 200)
		},
	)
	.get(
		'/:id',
		zValidator('param', z.object({ id: z.string() })),
		async (c) => {
			const { sessionService } = c.get('services')
			const { id } = c.req.valid('param')
			const session = await sessionService.get(id)
			if (!session) return c.json({ error: 'session not found' }, 404)
			return c.json(session, 200)
		},
	)
	.get(
		'/:id/messages',
		zValidator('param', z.object({ id: z.string() })),
		zValidator(
			'query',
			z.object({
				limit: z.string().optional(),
			}),
		),
		async (c) => {
			const { sessionMessageService } = c.get('services')
			const { id } = c.req.valid('param')
			const query = c.req.valid('query')
			const limit = query.limit ? Number.parseInt(query.limit, 10) : 200

			const messages = await sessionMessageService.listRecent(id, limit)
			const enriched = messages.map((msg) => {
				const meta = safeParseJson(msg.metadata)
				const attachments = Array.isArray(meta.attachments) ? meta.attachments : null
				return { ...msg, attachments }
			})

			enriched.sort((a, b) => a.created_at.localeCompare(b.created_at))

			return c.json(enriched, 200)
		},
	)

export { sessionsRoute }
