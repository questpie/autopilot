import { join } from 'node:path'
import { AttachmentSchema, MessageSchema } from '@questpie/autopilot-spec/schemas'
import { and, desc, eq, max, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { describeRoute } from 'hono-openapi'
import { resolver, validator as zValidator } from 'hono-openapi'
import { z } from 'zod'
import { spawnAgent } from '../../agent/spawner'
import { logger } from '../../logger'
import { container } from '../../container'
import * as schema from '../../db/schema'
import { loadAgents, loadCompany } from '../../fs/company'
import { fileExists, readYamlUnsafe, writeYaml } from '../../fs/yaml'
import { streamManagerFactory } from '../../session/stream'
import type { AppEnv } from '../app'

const ONBOARDING_TRIGGER_MESSAGE = '__onboarding__'
const ONBOARDING_DISPLAY_MESSAGE = "Let's set up my company."

const ChatAttachmentSchema = AttachmentSchema.extend({
	url: z.string().min(1),
})

const CreateChatSessionSchema = z
	.object({
		agentId: z.string().min(1),
		message: z.string().trim().default(''),
		attachments: z.array(ChatAttachmentSchema).default([]),
		channelId: z.string().min(1).optional(),
	})
	.refine((value) => value.message.length > 0 || value.attachments.length > 0, {
		message: 'Provide a message or at least one attachment',
		path: ['message'],
	})

const ChatSessionListQuerySchema = z.object({
	limit: z.coerce.number().int().min(1).max(100).default(20),
	offset: z.coerce.number().int().min(0).default(0),
})

const ChatSessionMessagesQuerySchema = z.object({
	limit: z.coerce.number().int().min(1).max(500).default(200),
	offset: z.coerce.number().int().min(0).default(0),
})

const ChatSessionParamSchema = z.object({
	id: z.string().min(1),
})

const ChatSessionMessageCreateSchema = z
	.object({
		message: z.string().trim().default(''),
		attachments: z.array(ChatAttachmentSchema).default([]),
	})
	.refine((value) => value.message.length > 0 || value.attachments.length > 0, {
		message: 'Provide a message or at least one attachment',
		path: ['message'],
	})

const ChatSessionSummarySchema = z.object({
	id: z.string(),
	agentId: z.string(),
	agentName: z.string(),
	status: z.string(),
	startedAt: z.string(),
	endedAt: z.string().nullable(),
	channelId: z.string().nullable(),
	channelName: z.string().nullable(),
	firstMessage: z.string().nullable(),
	lastMessageAt: z.string(),
	toolCalls: z.number(),
	tokensUsed: z.number(),
})

const ChatSessionListSchema = z.object({
	sessions: z.array(ChatSessionSummarySchema),
})

const ChatSessionDetailSchema = ChatSessionSummarySchema.extend({
	streamUrl: z.string(),
	streamOffset: z.string(),
})

const ChatSessionStreamSchema = z.object({
	sessionId: z.string(),
	channelId: z.string().optional(),
	streamUrl: z.string(),
	streamOffset: z.string(),
})

const ChatSessionStreamOffsetSchema = z.object({
	streamOffset: z.string(),
})

const ChatSessionStreamOffsetUpdateSchema = z.object({
	offset: z.string().min(1),
})

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function markOnboardingChatStarted(root: string): Promise<void> {
	const companyPath = join(root, 'company.yaml')
	let existing: Record<string, unknown> = {}

	if (await fileExists(companyPath)) {
		const parsed = await readYamlUnsafe(companyPath)
		if (isRecord(parsed)) {
			existing = parsed
		}
	}

	if (existing.onboarding_chat_completed === true) {
		return
	}

	await writeYaml(companyPath, {
		...existing,
		onboarding_chat_completed: true,
	})
}

function getAgentName(
	agentId: string,
	agentsById: Map<string, { name: string }>,
): string {
	return agentsById.get(agentId)?.name ?? agentId
}

function getStreamUrl(sessionId: string): string {
	return `/api/agent-sessions/${encodeURIComponent(sessionId)}/stream?live=sse`
}

function normalizeStreamOffset(offset: string | null | undefined): string {
	if (!offset) {
		return '-1'
	}

	const trimmed = offset.trim()
	if (!trimmed || trimmed === '0') {
		return '-1'
	}

	return trimmed
}

function buildStreamOffsetUpdateSql(normalizedOffset: string) {
	const currentOffset = schema.agentSessions.stream_offset

	if (normalizedOffset === '-1') {
		return sql<string>`CASE
			WHEN ${currentOffset} IS NULL OR trim(${currentOffset}) = '' THEN '-1'
			ELSE ${currentOffset}
		END`
	}

	// Durable Streams offsets are opaque tokens, but the current server
	// implementation zero-pads them specifically so lexicographic ordering is
	// the correct monotonic comparison for saved checkpoints.
	return sql<string>`CASE
		WHEN ${currentOffset} IS NULL
			OR trim(${currentOffset}) = ''
			OR ${currentOffset} = '-1'
		THEN ${normalizedOffset}
		WHEN ${currentOffset} < ${normalizedOffset}
		THEN ${normalizedOffset}
		ELSE ${currentOffset}
	END`
}

function createMessageId(actorId: string): string {
	return `msg-${Date.now().toString(36)}-${actorId}`
}

function normalizeAttachmentPath(value: string): string {
	return value.replace(/\\/g, '/').replace(/^\/+/, '').trim()
}

function normalizeAttachments(
	attachments: z.infer<typeof ChatAttachmentSchema>[],
): z.infer<typeof ChatAttachmentSchema>[] {
	return attachments
		.map((attachment) => ({
			...attachment,
			url: normalizeAttachmentPath(attachment.url),
		}))
		.filter((attachment) => attachment.url.length > 0)
}

function buildSessionPreview(
	message: string,
	attachments: z.infer<typeof ChatAttachmentSchema>[],
): string {
	if (message.trim().length > 0) {
		return message
	}

	if (attachments.length === 1) {
		return `Attached ${attachments[0]!.filename}`
	}

	return `Attached ${attachments.length} files`
}

function createSessionSummaryQuery(db: AppEnv['Variables']['db']) {
	const sessionLastMessage = db
		.select({
			session_id: schema.messages.session_id,
			last_message_at: max(schema.messages.created_at).as('last_message_at'),
		})
		.from(schema.messages)
		.groupBy(schema.messages.session_id)
		.as('session_last_message')

	const query = db
		.select({
			id: schema.agentSessions.id,
			agent_id: schema.agentSessions.agent_id,
			status: schema.agentSessions.status,
			started_at: schema.agentSessions.started_at,
			ended_at: schema.agentSessions.ended_at,
			channel_id: schema.agentSessions.channel_id,
			channel_name: schema.channels.name,
			first_message: schema.agentSessions.first_message,
			last_message_at: sessionLastMessage.last_message_at,
			tool_calls: schema.agentSessions.tool_calls,
			tokens_used: schema.agentSessions.tokens_used,
			stream_offset: schema.agentSessions.stream_offset,
		})
		.from(schema.agentSessions)
		.leftJoin(schema.channels, eq(schema.channels.id, schema.agentSessions.channel_id))
		.leftJoin(sessionLastMessage, eq(sessionLastMessage.session_id, schema.agentSessions.id))

	return {
		query,
		sessionLastMessage,
	}
}

async function selectOwnedSessionRow(
	db: AppEnv['Variables']['db'],
	sessionId: string,
	actorId: string,
) {
	const { query } = createSessionSummaryQuery(db)

	return query
		.where(
			and(
				eq(schema.agentSessions.id, sessionId),
				eq(schema.agentSessions.initiated_by, actorId),
			),
		)
		.get()
}

async function listOwnedSessionRows(
	db: AppEnv['Variables']['db'],
	actorId: string,
	limit: number,
	offset: number,
) {
	const { query, sessionLastMessage } = createSessionSummaryQuery(db)

	return query
		.where(eq(schema.agentSessions.initiated_by, actorId))
		.orderBy(desc(sessionLastMessage.last_message_at), desc(schema.agentSessions.started_at))
		.limit(limit)
		.offset(offset)
}

type SessionRow = NonNullable<Awaited<ReturnType<typeof selectOwnedSessionRow>>>

type SessionLookupResult =
	| { kind: 'owned'; row: SessionRow }
	| { kind: 'forbidden' }
	| { kind: 'missing' }

function toSessionSummary(
	row: SessionRow,
	agentsById: Map<string, { name: string }>,
) {
	return {
		id: row.id,
		agentId: row.agent_id,
		agentName: getAgentName(row.agent_id, agentsById),
		status: row.status,
		startedAt: row.started_at,
		endedAt: row.ended_at,
		channelId: row.channel_id,
		channelName: row.channel_name,
		firstMessage: row.first_message,
		lastMessageAt: row.last_message_at ?? row.started_at,
		toolCalls: row.tool_calls ?? 0,
		tokensUsed: row.tokens_used ?? 0,
	}
}

async function getOwnedSessionRow(
	db: AppEnv['Variables']['db'],
	sessionId: string,
	actorId: string,
): Promise<SessionLookupResult> {
	const row = await selectOwnedSessionRow(db, sessionId, actorId)

	if (row) {
		return {
			kind: 'owned',
			row,
		}
	}

	const anyResult = await db
		.select({ id: schema.agentSessions.id })
		.from(schema.agentSessions)
		.where(eq(schema.agentSessions.id, sessionId))
		.get()

	return anyResult ? { kind: 'forbidden' } : { kind: 'missing' }
}

const chatSessions = new Hono<AppEnv>()
	.post(
		'/',
		describeRoute({
			tags: ['chat-sessions'],
			description: 'Create a chat session and return its durable stream URL immediately.',
			responses: {
				200: {
					description: 'Created chat session',
					content: { 'application/json': { schema: resolver(ChatSessionStreamSchema) } },
				},
				403: { description: 'Only authenticated humans can create chat sessions' },
				404: { description: 'Agent or channel not found' },
			},
		}),
		zValidator('json', CreateChatSessionSchema),
		async (c) => {
			const actor = c.get('actor')
			if (!actor || actor.type !== 'human') {
				return c.json({ error: 'Only authenticated humans can create chat sessions' }, 403)
			}

			const root = c.get('companyRoot')
			const storage = c.get('storage')
			const db = c.get('db')
			const body = c.req.valid('json')
			const agents = await loadAgents(root)
			const agent = agents.find((item) => item.id === body.agentId)

			if (!agent) {
				return c.json({ error: `Agent not found: ${body.agentId}` }, 404)
			}

			let channelId = body.channelId
			if (channelId) {
				const channel = await storage.readChannel(channelId)
				if (!channel) {
					return c.json({ error: `Channel not found: ${channelId}` }, 404)
				}

				if (actor.role !== 'admin' && actor.role !== 'owner') {
					const isMember = await storage.isChannelMember(channelId, actor.id)
					if (!isMember) {
						return c.json({ error: 'Not a member of this channel' }, 403)
					}
				}
			} else {
				channelId = (await storage.getOrCreateSessionChannel(actor.id, agent.id)).id
			}

			const sessionId = `session-${crypto.randomUUID()}`
			const startedAt = new Date().toISOString()
			const attachments = normalizeAttachments(body.attachments ?? [])
			if (body.message.length === 0 && attachments.length === 0) {
				return c.json({ error: 'Provide a message or at least one attachment' }, 400)
			}
			const triggerMessage =
				body.message === ONBOARDING_TRIGGER_MESSAGE ? ONBOARDING_TRIGGER_MESSAGE : body.message
			const displayMessage =
				body.message === ONBOARDING_TRIGGER_MESSAGE
					? ONBOARDING_DISPLAY_MESSAGE
					: buildSessionPreview(body.message, attachments)
			const { streamManager } = container.resolve([streamManagerFactory])
			let streamCreated = false

			try {
				streamManager.createStream(sessionId, agent.id)
				streamCreated = true

				await db.insert(schema.agentSessions).values({
					id: sessionId,
					agent_id: agent.id,
					task_id: null,
					initiated_by: actor.id,
					channel_id: channelId,
					first_message: displayMessage,
					trigger_type: 'chat',
					status: 'running',
					started_at: startedAt,
					tool_calls: 0,
					tokens_used: 0,
					stream_offset: '-1',
				})

				await storage.sendMessage({
					id: createMessageId(actor.id),
					channel: channelId,
					session_id: sessionId,
					from: actor.id,
					content: body.message,
					at: startedAt,
					mentions: [],
					references: [],
					reactions: [],
					thread: null,
					external: true,
					metadata: { sessionId },
					attachments,
				})

				if (body.message === ONBOARDING_TRIGGER_MESSAGE) {
					await markOnboardingChatStarted(root)
				}

				const company = await loadCompany(root)

				void spawnAgent({
					sessionId,
					agent,
					company,
					allAgents: agents,
					storage,
					trigger: { type: 'chat' },
					message: triggerMessage,
					mode: 'chat',
					channelId,
					initiatedBy: actor.id,
				}).catch((err) => {
					logger.error('chat-sessions', `spawn failed for new session ${sessionId}`, {
						error: err instanceof Error ? err.message : String(err),
						stack: err instanceof Error ? err.stack : undefined,
					})
				})

				return c.json(
					{
						sessionId,
						channelId,
						streamUrl: getStreamUrl(sessionId),
						streamOffset: '-1',
					},
					200,
				)
			} catch (error) {
				if (streamCreated) {
					await db
						.update(schema.agentSessions)
						.set({
							status: 'failed',
							ended_at: new Date().toISOString(),
							error: error instanceof Error ? error.message : 'Failed to create chat session',
						})
						.where(eq(schema.agentSessions.id, sessionId))
						.catch(() => {})
					streamManager.endStream(sessionId)
				}

				return c.json(
					{
						error: error instanceof Error ? error.message : 'Failed to create chat session',
					},
					500,
				)
			}
		},
	)
	.get(
		'/',
		describeRoute({
			tags: ['chat-sessions'],
			description: 'List chat sessions started by the current user.',
			responses: {
				200: {
					description: 'Chat sessions',
					content: { 'application/json': { schema: resolver(ChatSessionListSchema) } },
				},
			},
		}),
		zValidator('query', ChatSessionListQuerySchema),
		async (c) => {
			const actor = c.get('actor')
			if (!actor || actor.type !== 'human') {
				return c.json({ sessions: [] }, 200)
			}

			const root = c.get('companyRoot')
			const db = c.get('db')
			const { limit, offset } = c.req.valid('query')
			const agents = await loadAgents(root)
			const agentsById = new Map(agents.map((agent) => [agent.id, { name: agent.name }]))
			const rows = await listOwnedSessionRows(db, actor.id, limit, offset)

			return c.json(
				{
					sessions: rows.map((row) => toSessionSummary(row, agentsById)),
				},
				200,
			)
		},
	)
	.get(
		'/:id',
		describeRoute({
			tags: ['chat-sessions'],
			description: 'Get metadata for a single chat session.',
			responses: {
				200: {
					description: 'Chat session detail',
					content: { 'application/json': { schema: resolver(ChatSessionDetailSchema) } },
				},
				403: { description: 'Access denied' },
				404: { description: 'Chat session not found' },
			},
		}),
		zValidator('param', ChatSessionParamSchema),
		async (c) => {
			const actor = c.get('actor')
			if (!actor || actor.type !== 'human') {
				return c.json({ error: 'Only authenticated humans can access chat sessions' }, 403)
			}

			const root = c.get('companyRoot')
			const db = c.get('db')
			const { id } = c.req.valid('param')
			const sessionLookup = await getOwnedSessionRow(db, id, actor.id)

			if (sessionLookup.kind === 'forbidden') {
				return c.json({ error: 'Access denied' }, 403)
			}

			if (sessionLookup.kind === 'missing') {
				return c.json({ error: 'Chat session not found' }, 404)
			}

			const agents = await loadAgents(root)
			const agentsById = new Map(agents.map((agent) => [agent.id, { name: agent.name }]))
			const session = toSessionSummary(sessionLookup.row, agentsById)

			return c.json(
				{
					...session,
					streamUrl: getStreamUrl(session.id),
					streamOffset: normalizeStreamOffset(sessionLookup.row.stream_offset),
				},
				200,
			)
		},
	)
	.patch(
		'/:id/stream-offset',
		describeRoute({
			tags: ['chat-sessions'],
			description: 'Persist the last seen durable stream offset for the current session owner.',
			responses: {
				200: {
					description: 'Stream offset persisted',
					content: { 'application/json': { schema: resolver(ChatSessionStreamOffsetSchema) } },
				},
				403: { description: 'Access denied' },
				404: { description: 'Chat session not found' },
			},
		}),
		zValidator('param', ChatSessionParamSchema),
		zValidator('json', ChatSessionStreamOffsetUpdateSchema),
		async (c) => {
			const actor = c.get('actor')
			if (!actor || actor.type !== 'human') {
				return c.json({ error: 'Only authenticated humans can update chat stream offsets' }, 403)
			}

			const db = c.get('db')
			const { id } = c.req.valid('param')
			const { offset } = c.req.valid('json')
			const normalizedOffset = normalizeStreamOffset(offset)
			const sessionLookup = await getOwnedSessionRow(db, id, actor.id)

			if (sessionLookup.kind === 'forbidden') {
				return c.json({ error: 'Access denied' }, 403)
			}

			if (sessionLookup.kind === 'missing') {
				return c.json({ error: 'Chat session not found' }, 404)
			}

			await db
				.update(schema.agentSessions)
				.set({
					stream_offset: buildStreamOffsetUpdateSql(normalizedOffset),
				})
				.where(
					and(
						eq(schema.agentSessions.id, id),
						eq(schema.agentSessions.initiated_by, actor.id),
					),
				)

			const updatedSessionLookup = await getOwnedSessionRow(db, id, actor.id)
			if (updatedSessionLookup.kind !== 'owned') {
				return c.json({ error: 'Chat session not found' }, 404)
			}

			return c.json(
				{
					streamOffset: normalizeStreamOffset(updatedSessionLookup.row.stream_offset),
				},
				200,
			)
		},
	)
	.get(
		'/:id/messages',
		describeRoute({
			tags: ['chat-sessions'],
			description: 'Get messages for a single chat session.',
			responses: {
				200: {
					description: 'Session messages',
					content: { 'application/json': { schema: resolver(z.array(MessageSchema)) } },
				},
				403: { description: 'Access denied' },
				404: { description: 'Chat session not found' },
			},
		}),
		zValidator('param', ChatSessionParamSchema),
		zValidator('query', ChatSessionMessagesQuerySchema),
		async (c) => {
			const actor = c.get('actor')
			if (!actor || actor.type !== 'human') {
				return c.json({ error: 'Only authenticated humans can access chat sessions' }, 403)
			}

			const storage = c.get('storage')
			const db = c.get('db')
			const { id } = c.req.valid('param')
			const { limit, offset } = c.req.valid('query')
			const sessionLookup = await getOwnedSessionRow(db, id, actor.id)

			if (sessionLookup.kind === 'forbidden') {
				return c.json({ error: 'Access denied' }, 403)
			}

			if (sessionLookup.kind === 'missing') {
				return c.json({ error: 'Chat session not found' }, 404)
			}

			const messages = await storage.readMessages({
				session_id: id,
				limit,
				offset,
			})

			return c.json(messages, 200)
		},
	)
	.post(
		'/:id/messages',
		describeRoute({
			tags: ['chat-sessions'],
			description: 'Append a user message to an existing chat session and continue the same conversation.',
			responses: {
				200: {
					description: 'Chat session continued',
					content: { 'application/json': { schema: resolver(ChatSessionStreamSchema) } },
				},
				403: { description: 'Access denied' },
				404: { description: 'Chat session not found' },
				409: { description: 'Chat session is already running or cannot be continued' },
			},
		}),
		zValidator('param', ChatSessionParamSchema),
		zValidator('json', ChatSessionMessageCreateSchema),
		async (c) => {
			const actor = c.get('actor')
			if (!actor || actor.type !== 'human') {
				return c.json({ error: 'Only authenticated humans can continue chat sessions' }, 403)
			}

			const root = c.get('companyRoot')
			const storage = c.get('storage')
			const db = c.get('db')
			const { id } = c.req.valid('param')
			const { message, attachments: rawAttachments } = c.req.valid('json')
			const sessionLookup = await getOwnedSessionRow(db, id, actor.id)

			if (sessionLookup.kind === 'forbidden') {
				return c.json({ error: 'Access denied' }, 403)
			}

			if (sessionLookup.kind === 'missing') {
				return c.json({ error: 'Chat session not found' }, 404)
			}

			const sessionRow = sessionLookup.row
			if (String(sessionRow.status) === 'running') {
				return c.json({ error: 'Chat session is already running' }, 409)
			}

			const channelId = sessionRow.channel_id ? String(sessionRow.channel_id) : null
			if (!channelId) {
				return c.json({ error: 'Chat session is missing channel context' }, 409)
			}

			const agents = await loadAgents(root)
			const agentId = String(sessionRow.agent_id)
			const agent = agents.find((item) => item.id === agentId)

			if (!agent) {
				return c.json({ error: `Agent not found: ${agentId}` }, 404)
			}

			const { streamManager } = container.resolve([streamManagerFactory])
			const messageAt = new Date().toISOString()
			const attachments = normalizeAttachments(rawAttachments ?? [])
			if (message.length === 0 && attachments.length === 0) {
				return c.json({ error: 'Provide a message or at least one attachment' }, 400)
			}
			let streamCreated = false

			try {
				streamManager.createStream(id, agent.id)
				streamCreated = true

				await db
					.update(schema.agentSessions)
					.set({
						status: 'running',
						ended_at: null,
						error: null,
					})
					.where(eq(schema.agentSessions.id, id))

				await storage.sendMessage({
					id: createMessageId(actor.id),
					channel: channelId,
					session_id: id,
					from: actor.id,
					content: message,
					at: messageAt,
					mentions: [],
					references: [],
					reactions: [],
					thread: null,
					external: true,
					metadata: { sessionId: id },
					attachments,
				})

				const company = await loadCompany(root)

				void spawnAgent({
					sessionId: id,
					agent,
					company,
					allAgents: agents,
					storage,
					trigger: { type: 'chat' },
					message,
					mode: 'chat',
					channelId,
					initiatedBy: actor.id,
				}).catch((err) => {
					logger.error('chat-sessions', `spawn failed for continue session ${id}`, {
						error: err instanceof Error ? err.message : String(err),
						stack: err instanceof Error ? err.stack : undefined,
					})
				})

				return c.json(
					{
						sessionId: id,
						channelId,
						streamUrl: getStreamUrl(id),
						streamOffset: normalizeStreamOffset(sessionRow.stream_offset),
					},
					200,
				)
			} catch (error) {
				if (streamCreated) {
					await db
						.update(schema.agentSessions)
						.set({
							status: 'failed',
							ended_at: new Date().toISOString(),
							error: error instanceof Error ? error.message : 'Failed to continue chat session',
						})
						.where(eq(schema.agentSessions.id, id))
						.catch(() => {})
					streamManager.endStream(id)
				}

				return c.json(
					{
						error: error instanceof Error ? error.message : 'Failed to continue chat session',
					},
					500,
				)
			}
		},
	)

export { chatSessions }
