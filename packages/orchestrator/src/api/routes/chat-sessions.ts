/**
 * Dashboard v2 chat-session routes.
 *
 * GET  /api/chat-sessions              — list dashboard sessions
 * GET  /api/chat-sessions/:id          — get session detail
 * GET  /api/chat-sessions/:id/messages — get messages for session
 * POST /api/chat-sessions              — create new chat session
 * POST /api/chat-sessions/:id/messages — continue existing session
 * PATCH /api/chat-sessions/:id/stream-offset — persist stream offset
 */
import { randomBytes } from 'node:crypto'
import { Hono } from 'hono'
import { validator as zValidator } from 'hono-openapi'
import { z } from 'zod'
import { buildQueryInstructions } from '../../services/queries'
import type { AppEnv } from '../app'

function safeParseJson(raw: string | null | undefined): Record<string, unknown> {
	if (!raw) return {}
	try {
		return JSON.parse(raw) as Record<string, unknown>
	} catch {
		return {}
	}
}

const attachmentSchema = z
	.object({
		type: z.string(),
		name: z.string().optional(),
		url: z.string().optional(),
		content: z.string().optional(),
		mimeType: z.string().optional(),
	})
	.passthrough()

const chatSessions = new Hono<AppEnv>()
	.get(
		'/',
		zValidator(
			'query',
			z.object({
				limit: z.string().optional(),
				offset: z.string().optional(),
			}),
		),
		async (c) => {
			const { sessionService } = c.get('services')
			const query = c.req.valid('query')
			const limit = query.limit ? Number.parseInt(query.limit, 10) : 20
			const offset = query.offset ? Number.parseInt(query.offset, 10) : 0

			const all = await sessionService.list({ provider_id: 'dashboard', status: 'active' })
			const sessions = all.slice(offset, offset + limit)
			return c.json({ sessions }, 200)
		},
	)
	.get('/:id', zValidator('param', z.object({ id: z.string() })), async (c) => {
		const { sessionService } = c.get('services')
		const { id } = c.req.valid('param')
		const session = await sessionService.get(id)
		if (!session) return c.json({ error: 'session not found' }, 404)
		return c.json(session, 200)
	})
	.get(
		'/:id/messages',
		zValidator('param', z.object({ id: z.string() })),
		zValidator(
			'query',
			z.object({
				limit: z.string().optional(),
				offset: z.string().optional(),
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

			// Sort chronologically
			enriched.sort((a, b) => a.created_at.localeCompare(b.created_at))

			return c.json(enriched, 200)
		},
	)
	.post(
		'/',
		zValidator(
			'json',
			z.object({
				agentId: z.string(),
				message: z.string(),
				attachments: z.array(attachmentSchema).optional(),
			}),
		),
		async (c) => {
			const { sessionService, sessionMessageService, queryService, runService } = c.get('services')
			const authoredConfig = c.get('authoredConfig')
			const body = c.req.valid('json')

			const externalConversationId = crypto.randomUUID()
			const session = await sessionService.findOrCreate({
				provider_id: 'dashboard',
				external_conversation_id: externalConversationId,
				external_thread_id: '__chat__',
			})

			const msgMetadata = body.attachments
				? JSON.stringify({ attachments: body.attachments })
				: undefined
			const userMsg = await sessionMessageService.create({
				session_id: session.id,
				role: 'user',
				content: body.message,
				metadata: msgMetadata,
			})

			const agentId = body.agentId || authoredConfig.defaults.task_assignee
			if (!agentId) {
				return c.json({ error: 'No agent specified and no default agent configured' }, 400)
			}
			const agentConfig = authoredConfig.agents.get(agentId)

			const instructions = buildQueryInstructions(body.message, {
				sessionMessages: [],
				allowMutation: true,
				hasResume: false,
				currentAttachments: body.attachments,
			})

			const query = await queryService.create({
				prompt: body.message,
				agent_id: agentId,
				allow_repo_mutation: true,
				session_id: session.id,
				created_by: 'dashboard',
			})

			await sessionMessageService.markConsumed([userMsg.id], query.id)

			const runId = `run-${Date.now()}-${randomBytes(6).toString('hex')}`
			await runService.create({
				id: runId,
				agent_id: agentId,
				runtime: authoredConfig.defaults.runtime,
				model: agentConfig?.model,
				provider: agentConfig?.provider,
				variant: agentConfig?.variant,
				initiated_by: 'dashboard',
				instructions,
			})

			await queryService.linkRun(query.id, runId)

			return c.json(
				{
					session_id: session.id,
					query_id: query.id,
					run_id: runId,
				},
				200,
			)
		},
	)
	.post(
		'/:id/messages',
		zValidator('param', z.object({ id: z.string() })),
		zValidator(
			'json',
			z.object({
				message: z.string(),
				attachments: z.array(attachmentSchema).optional(),
			}),
		),
		async (c) => {
			const {
				sessionService,
				sessionMessageService,
				queryService,
				runService,
				workerService,
			} = c.get('services')
			const authoredConfig = c.get('authoredConfig')
			const { id } = c.req.valid('param')
			const body = c.req.valid('json')

			const session = await sessionService.get(id)
			if (!session) return c.json({ error: 'session not found' }, 404)

			const msgMetadata = body.attachments
				? JSON.stringify({ attachments: body.attachments })
				: undefined
			const userMsg = await sessionMessageService.create({
				session_id: session.id,
				role: 'user',
				content: body.message,
				metadata: msgMetadata,
			})

			const activeQuery = await queryService.findActiveForSession(session.id)
			if (activeQuery?.run_id) {
				const activeRun = await runService.get(activeQuery.run_id)
				if (
					activeRun &&
					(activeRun.status === 'pending' ||
						activeRun.status === 'claimed' ||
						activeRun.status === 'running')
				) {
					return c.json(
						{
							queued: true as const,
							session_id: session.id,
							query_id: activeQuery.id,
							run_id: activeQuery.run_id,
							streamUrl: null,
							streamOffset: null,
						},
						200,
					)
				}
			}

			const agentId = authoredConfig.defaults.task_assignee
			if (!agentId) {
				return c.json({ error: 'No default agent configured' }, 400)
			}
			const agentConfig = authoredConfig.agents.get(agentId)

			const hasResume = !!session.runtime_session_ref
			let effectiveResume = hasResume
			if (hasResume && session.preferred_worker_id) {
				const worker = await workerService.get(session.preferred_worker_id)
				if (workerService.isUnavailable(worker, 90_000)) {
					await sessionService.updateResumeState(session.id, null, null)
					effectiveResume = false
				}
			}

			const recent = await sessionMessageService.listRecent(session.id)
			const instructionMessages = effectiveResume ? [] : recent.filter((m) => m.id !== userMsg.id)

			const instructions = buildQueryInstructions(body.message, {
				sessionMessages: instructionMessages,
				allowMutation: true,
				hasResume: effectiveResume,
				currentAttachments: body.attachments,
			})

			const query = await queryService.create({
				prompt: body.message,
				agent_id: agentId,
				allow_repo_mutation: true,
				session_id: session.id,
				created_by: 'dashboard',
			})

			await sessionMessageService.markConsumed([userMsg.id], query.id)

			const runId = `run-${Date.now()}-${randomBytes(6).toString('hex')}`
			await runService.create({
				id: runId,
				agent_id: agentId,
				runtime: authoredConfig.defaults.runtime,
				model: agentConfig?.model,
				provider: agentConfig?.provider,
				variant: agentConfig?.variant,
				initiated_by: 'dashboard',
				instructions,
				runtime_session_ref: effectiveResume
					? (session.runtime_session_ref ?? undefined)
					: undefined,
				preferred_worker_id: effectiveResume
					? (session.preferred_worker_id ?? undefined)
					: undefined,
			})

			await queryService.linkRun(query.id, runId)

			return c.json(
				{
					session_id: session.id,
					query_id: query.id,
					run_id: runId,
					streamUrl: null,
					streamOffset: null,
				},
				200,
			)
		},
	)
	.patch(
		'/:id/stream-offset',
		zValidator('param', z.object({ id: z.string() })),
		zValidator(
			'json',
			z.object({
				offset: z.string(),
			}),
		),
		async (c) => {
			const { sessionService } = c.get('services')
			const { id } = c.req.valid('param')
			const { offset } = c.req.valid('json')

			const session = await sessionService.get(id)
			if (!session) return c.json({ error: 'session not found' }, 404)

			const existing = safeParseJson(session.metadata)
			const updated = { ...existing, streamOffset: offset }
			await sessionService.updateMetadata(id, updated)

			return c.json({ streamOffset: offset }, 200)
		},
	)

export { chatSessions }
