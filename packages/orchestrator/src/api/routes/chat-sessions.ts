import { join } from 'node:path'
import type { Client } from '@libsql/client'
import { MessageSchema } from '@questpie/autopilot-spec/schemas'
import { Hono } from 'hono'
import { describeRoute } from 'hono-openapi'
import { resolver, validator as zValidator } from 'hono-openapi'
import { z } from 'zod'
import { spawnAgent } from '../../agent/spawner'
import { logger } from '../../logger'
import { container } from '../../container'
import { loadAgents, loadCompany } from '../../fs/company'
import { fileExists, readYamlUnsafe, writeYaml } from '../../fs/yaml'
import { streamManagerFactory } from '../../session/stream'
import type { AppEnv } from '../app'

const ONBOARDING_TRIGGER_MESSAGE = '__onboarding__'
const ONBOARDING_DISPLAY_MESSAGE = "Let's set up my company."
const SESSION_FIRST_MESSAGE_SQL = `
	COALESCE(
		first_message,
		(
			SELECT m.content
			FROM messages m
			WHERE m.session_id = agent_sessions.id
			ORDER BY m.created_at ASC
			LIMIT 1
		)
	)
`

const CreateChatSessionSchema = z.object({
	agentId: z.string().min(1),
	message: z.string().min(1),
	channelId: z.string().min(1).optional(),
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

const ChatSessionMessageCreateSchema = z.object({
	message: z.string().min(1),
})

const ChatSessionSummarySchema = z.object({
	id: z.string(),
	agentId: z.string(),
	agentName: z.string(),
	status: z.string(),
	startedAt: z.string(),
	endedAt: z.string().nullable(),
	channelId: z.string().nullable(),
	firstMessage: z.string().nullable(),
	toolCalls: z.number(),
	tokensUsed: z.number(),
})

const ChatSessionListSchema = z.object({
	sessions: z.array(ChatSessionSummarySchema),
})

const ChatSessionDetailSchema = ChatSessionSummarySchema.extend({
	streamUrl: z.string(),
})

const ChatSessionStreamSchema = z.object({
	sessionId: z.string(),
	channelId: z.string().optional(),
	streamUrl: z.string(),
})

type SessionLookupResult =
	| { kind: 'owned'; row: Record<string, unknown> }
	| { kind: 'forbidden' }
	| { kind: 'missing' }

function getRawDb(db: AppEnv['Variables']['db']): Client {
	return (db as unknown as { $client: Client }).$client
}

async function markOnboardingChatStarted(root: string): Promise<void> {
	const companyPath = join(root, 'company.yaml')
	const existing = (await fileExists(companyPath))
		? ((await readYamlUnsafe(companyPath)) as Record<string, unknown>)
		: {}

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

function createMessageId(actorId: string): string {
	return `msg-${Date.now().toString(36)}-${actorId}`
}

function toSessionSummary(
	row: Record<string, unknown>,
	agentsById: Map<string, { name: string }>,
) {
	return {
		id: String(row.id),
		agentId: String(row.agent_id),
		agentName: getAgentName(String(row.agent_id), agentsById),
		status: String(row.status),
		startedAt: String(row.started_at),
		endedAt: row.ended_at ? String(row.ended_at) : null,
		channelId: row.channel_id ? String(row.channel_id) : null,
		firstMessage: row.first_message ? String(row.first_message) : null,
		toolCalls: Number(row.tool_calls ?? 0),
		tokensUsed: Number(row.tokens_used ?? 0),
	}
}

async function getOwnedSessionRow(
	raw: Client,
	sessionId: string,
	actorId: string,
): Promise<SessionLookupResult> {
	const result = await raw.execute({
		sql: `
			SELECT
				id,
				agent_id,
				status,
				started_at,
				ended_at,
				channel_id,
				${SESSION_FIRST_MESSAGE_SQL} AS first_message,
				tool_calls,
				tokens_used
			FROM agent_sessions
			WHERE id = ? AND initiated_by = ?
			LIMIT 1
		`,
		args: [sessionId, actorId],
	})

	if (result.rows[0]) {
		return {
			kind: 'owned',
			row: result.rows[0] as Record<string, unknown>,
		}
	}

	const anyResult = await raw.execute({
		sql: 'SELECT id FROM agent_sessions WHERE id = ? LIMIT 1',
		args: [sessionId],
	})

	return anyResult.rows[0] ? { kind: 'forbidden' } : { kind: 'missing' }
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
			const raw = getRawDb(c.get('db'))
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
				channelId = (await storage.getOrCreateDirectChannel(actor.id, agent.id)).id
			}

			const sessionId = `session-${Date.now().toString(36)}-${agent.id}`
			const startedAt = new Date().toISOString()
			const triggerMessage =
				body.message === ONBOARDING_TRIGGER_MESSAGE ? ONBOARDING_TRIGGER_MESSAGE : body.message
			const displayMessage =
				body.message === ONBOARDING_TRIGGER_MESSAGE ? ONBOARDING_DISPLAY_MESSAGE : body.message
			const { streamManager } = container.resolve([streamManagerFactory])
			let streamCreated = false

			try {
				streamManager.createStream(sessionId, agent.id)
				streamCreated = true

				await raw.execute({
					sql: `INSERT INTO agent_sessions (
						id, agent_id, task_id, initiated_by, channel_id, first_message,
						trigger_type, status, started_at, tool_calls, tokens_used
					) VALUES (?, ?, ?, ?, ?, ?, ?, 'running', ?, 0, 0)`,
					args: [
						sessionId,
						agent.id,
						null,
						actor.id,
						channelId,
						displayMessage,
						'chat',
						startedAt,
					],
				})

				await storage.sendMessage({
					id: createMessageId(actor.id),
					channel: channelId,
					session_id: sessionId,
					from: actor.id,
					content: displayMessage,
					at: startedAt,
					mentions: [],
					references: [],
					reactions: [],
					thread: null,
					external: true,
					metadata: { sessionId },
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
					},
					200,
				)
			} catch (error) {
				if (streamCreated) {
					await raw
						.execute({
							sql: `UPDATE agent_sessions SET status = ?, ended_at = ?, error = ? WHERE id = ?`,
							args: [
								'failed',
								new Date().toISOString(),
								error instanceof Error ? error.message : 'Failed to create chat session',
								sessionId,
							],
						})
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
			const raw = getRawDb(c.get('db'))
			const { limit, offset } = c.req.valid('query')
			const agents = await loadAgents(root)
			const agentsById = new Map(agents.map((agent) => [agent.id, { name: agent.name }]))
			const result = await raw.execute({
				sql: `
					SELECT
						id,
						agent_id,
						status,
						started_at,
						ended_at,
						channel_id,
						${SESSION_FIRST_MESSAGE_SQL} AS first_message,
						tool_calls,
						tokens_used
					FROM agent_sessions
					WHERE initiated_by = ?
					ORDER BY started_at DESC
					LIMIT ? OFFSET ?
				`,
				args: [actor.id, limit, offset],
			})

			return c.json(
				{
					sessions: result.rows.map((row) =>
						toSessionSummary(row as Record<string, unknown>, agentsById),
					),
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
			const raw = getRawDb(c.get('db'))
			const { id } = c.req.valid('param')
			const sessionLookup = await getOwnedSessionRow(raw, id, actor.id)

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
			const raw = getRawDb(c.get('db'))
			const { id } = c.req.valid('param')
			const { limit, offset } = c.req.valid('query')
			const sessionLookup = await getOwnedSessionRow(raw, id, actor.id)

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
			const raw = getRawDb(c.get('db'))
			const { id } = c.req.valid('param')
			const { message } = c.req.valid('json')
			const sessionLookup = await getOwnedSessionRow(raw, id, actor.id)

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
			let streamCreated = false

			try {
				streamManager.createStream(id, agent.id)
				streamCreated = true

				await raw.execute({
					sql: `
						UPDATE agent_sessions
						SET status = 'running',
							ended_at = NULL,
							error = NULL
						WHERE id = ?
					`,
					args: [id],
				})

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
					},
					200,
				)
			} catch (error) {
				if (streamCreated) {
					await raw
						.execute({
							sql: `UPDATE agent_sessions SET status = ?, ended_at = ?, error = ? WHERE id = ?`,
							args: [
								'failed',
								new Date().toISOString(),
								error instanceof Error ? error.message : 'Failed to continue chat session',
								id,
							],
						})
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
