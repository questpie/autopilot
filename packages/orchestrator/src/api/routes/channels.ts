import { logger } from '../../logger'
import { Hono } from 'hono'
import { describeRoute } from 'hono-openapi'
import { resolver, validator as zValidator } from 'hono-openapi'
import { z } from 'zod'
import {
	ChannelSchema,
	ChannelMemberSchema,
	MessageSchema,
	OkResponseSchema,
	CreateChannelRequestSchema,
	ChannelMessagesQuerySchema,
	SendChannelMessageRequestSchema,
	ManageMembersRequestSchema,
	ReactionSchema,
	PinnedMessageSchema,
} from '@questpie/autopilot-spec'
import { eventBus } from '../../events/event-bus'
import { loadAgents, loadCompany } from '../../fs/company'
import { routeMessage } from '../../router'
import { spawnAgent } from '../../agent/spawner'
import type { AppEnv } from '../app'
import type { Context } from 'hono'

// ─── Shared param validators ────────────────────────────────────────────────

const ChannelIdParam = z.object({ id: z.string() })
const MessageParam = z.object({ id: z.string(), msgId: z.string() })

/** Resolve actor ID from context, falling back to 'anonymous'. */
function getActorId(c: Context<AppEnv>): string {
	return c.get('actor')?.id ?? 'anonymous'
}

const channels = new Hono<AppEnv>()
	// GET /channels — list channels
	.get(
		'/',
		describeRoute({
			tags: ['channels'],
			description: 'List channels. Admins/owners see all; others see only their memberships.',
			responses: {
				200: {
					description: 'Array of channels',
					content: { 'application/json': { schema: resolver(z.array(ChannelSchema)) } },
				},
			},
		}),
		async (c) => {
			const storage = c.get('storage')
			const actor = c.get('actor')

			if (actor && (actor.role === 'admin' || actor.role === 'owner')) {
				const result = await storage.listChannels()
				return c.json(result)
			}

			const result = await storage.listChannels(
				actor ? { actor_id: actor.id } : undefined,
			)
			return c.json(result)
		},
	)
	// POST /channels — create a new channel
	.post(
		'/',
		describeRoute({
			tags: ['channels'],
			description: 'Create a new channel',
			responses: {
				201: {
					description: 'Created channel',
					content: { 'application/json': { schema: resolver(ChannelSchema) } },
				},
			},
		}),
		zValidator('json', CreateChannelRequestSchema),
		async (c) => {
			const storage = c.get('storage')
			const actor = c.get('actor')
			const body = c.req.valid('json')

			const id = body.name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
			const now = new Date().toISOString()

			const channel = await storage.createChannel({
				id,
				name: body.name,
				type: body.type ?? 'group',
				description: body.description,
				created_by: actor?.id ?? 'system',
				created_at: now,
				updated_at: now,
				metadata: {},
			})

			// Add creator as owner
			if (actor) {
				await storage.addChannelMember(id, actor.id, actor.type ?? 'human', 'owner')
			}

			// Add optional members
			if (body.members?.length) {
				for (const member of body.members) {
					await storage.addChannelMember(id, member.actor_id, member.actor_type, 'member')
				}
			}

			eventBus.emit({ type: 'channel_created', channelId: id, name: body.name })

			return c.json(channel, 201)
		},
	)
	// GET /channels/:id — get channel with members
	.get(
		'/:id',
		describeRoute({
			tags: ['channels'],
			description: 'Get a single channel by ID, including its members',
			responses: {
				200: {
					description: 'Channel with members',
					content: {
						'application/json': {
							schema: resolver(ChannelSchema.extend({ members: z.array(ChannelMemberSchema) })),
						},
					},
				},
				404: { description: 'Channel not found' },
			},
		}),
		zValidator('param', ChannelIdParam),
		async (c) => {
			const storage = c.get('storage')
			const { id } = c.req.valid('param')
			const channel = await storage.readChannel(id)
			if (!channel) return c.json({ error: 'channel not found' }, 404)
			return c.json(channel)
		},
	)
	// DELETE /channels/:id — delete a channel
	.delete(
		'/:id',
		describeRoute({
			tags: ['channels'],
			description: 'Delete a channel',
			responses: {
				200: {
					description: 'Deletion result',
					content: { 'application/json': { schema: resolver(OkResponseSchema) } },
				},
				404: { description: 'Channel not found' },
			},
		}),
		zValidator('param', ChannelIdParam),
		async (c) => {
			const storage = c.get('storage')
			const { id } = c.req.valid('param')
			const channel = await storage.readChannel(id)
			if (!channel) return c.json({ error: 'channel not found' }, 404)

			await storage.deleteChannel(id)
			eventBus.emit({ type: 'channel_deleted', channelId: id })

			return c.json({ ok: true as const })
		},
	)
	// GET /channels/:id/messages — read messages
	.get(
		'/:id/messages',
		describeRoute({
			tags: ['channels'],
			description: 'Read messages from a channel',
			responses: {
				200: {
					description: 'Array of messages',
					content: { 'application/json': { schema: resolver(z.array(MessageSchema)) } },
				},
			},
		}),
		zValidator('param', ChannelIdParam),
		zValidator('query', ChannelMessagesQuerySchema),
		async (c) => {
			const storage = c.get('storage')
			const { id } = c.req.valid('param')
			const { limit, thread_id } = c.req.valid('query')

			const messages = await storage.readMessages({
				channel: id,
				limit,
				thread_id,
			})

			return c.json(messages)
		},
	)
	// POST /channels/:id/messages — send message to channel
	.post(
		'/:id/messages',
		describeRoute({
			tags: ['channels'],
			description: 'Send a message to a channel and route to relevant agent',
			responses: {
				201: {
					description: 'Sent message with optional routing info',
					content: {
						'application/json': {
							schema: resolver(
								MessageSchema.extend({
									routed_to: z.string().optional(),
									route_reason: z.string().optional(),
								}),
							),
						},
					},
				},
				404: { description: 'Channel not found' },
			},
		}),
		zValidator('param', ChannelIdParam),
		zValidator('json', SendChannelMessageRequestSchema),
		async (c) => {
			const storage = c.get('storage')
			const root = c.get('companyRoot')
			const { id: channelId } = c.req.valid('param')
			const body = c.req.valid('json')

			const channel = await storage.readChannel(channelId)
			if (!channel) return c.json({ error: 'channel not found' }, 404)

			const now = new Date().toISOString()
			const fromId = getActorId(c)

			const message = await storage.sendMessage({
				id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
				channel: channelId,
				from: fromId,
				at: now,
				content: body.content,
				thread: body.thread ?? null,
				thread_id: body.thread_id ?? undefined,
				mentions: body.mentions ?? [],
				references: body.references ?? [],
				reactions: [],
				external: true,
			})

			eventBus.emit({
				type: 'message',
				channel: channelId,
				from: fromId,
				content: body.content,
			})

			// Route to agent and spawn in background
			let routedTo: string | undefined
			let routeReason: string | undefined

			try {
				const recentMessages = await storage.readMessages({ channel: channelId, limit: 10 })
				const allAgents = await loadAgents(root)
				const members = await storage.getChannelMembers(channelId)
				const agentMembers = allAgents.filter((a) =>
					members.some((m) => m.actor_id === a.id),
				)

				if (agentMembers.length > 0) {
					const result = await routeMessage(body.content, agentMembers, root, {
						channelId,
						recentMessages,
						storage,
					})
					routedTo = result.agent.id
					routeReason = result.reason

					const company = await loadCompany(root)

					// Spawn in background, don't await
					spawnAgent({
						agent: result.agent,
						company,
						allAgents,
						storage,
						trigger: { type: 'channel_message', task_id: undefined },
						message: body.content,
					}).catch((err) =>
						logger.error('api', 'channels spawn error', { error: err instanceof Error ? err.message : String(err) }),
					)
				}
			} catch (err) {
				logger.error('api', 'channels routing error', { error: err instanceof Error ? err.message : String(err) })
			}

			return c.json(
				{ ...message, routed_to: routedTo, route_reason: routeReason },
				201,
			)
		},
	)
	// PUT /channels/:id/members — manage membership
	.put(
		'/:id/members',
		describeRoute({
			tags: ['channels'],
			description: 'Add or remove channel members',
			responses: {
				200: {
					description: 'Membership updated',
					content: { 'application/json': { schema: resolver(OkResponseSchema) } },
				},
				404: { description: 'Channel not found' },
			},
		}),
		zValidator('param', ChannelIdParam),
		zValidator('json', ManageMembersRequestSchema),
		async (c) => {
			const storage = c.get('storage')
			const { id } = c.req.valid('param')
			const body = c.req.valid('json')

			const channel = await storage.readChannel(id)
			if (!channel) return c.json({ error: 'channel not found' }, 404)

			if (body.add?.length) {
				for (const member of body.add) {
					await storage.addChannelMember(id, member.actor_id, member.actor_type, member.role ?? 'member')
					eventBus.emit({ type: 'channel_member_changed', channelId: id, actorId: member.actor_id, action: 'added' })
				}
			}

			if (body.remove?.length) {
				for (const actorId of body.remove) {
					await storage.removeChannelMember(id, actorId)
					eventBus.emit({ type: 'channel_member_changed', channelId: id, actorId, action: 'removed' })
				}
			}

			return c.json({ ok: true as const })
		},
	)
	// GET /channels/:id/members — list members
	.get(
		'/:id/members',
		describeRoute({
			tags: ['channels'],
			description: 'List members of a channel',
			responses: {
				200: {
					description: 'Array of channel members',
					content: {
						'application/json': { schema: resolver(z.array(ChannelMemberSchema)) },
					},
				},
			},
		}),
		zValidator('param', ChannelIdParam),
		async (c) => {
			const storage = c.get('storage')
			const { id } = c.req.valid('param')
			const members = await storage.getChannelMembers(id)
			return c.json(members)
		},
	)
	// PATCH /channels/:id/messages/:msgId — edit message
	.patch(
		'/:id/messages/:msgId',
		describeRoute({
			tags: ['channels'],
			description: 'Edit a message (only by the original sender)',
			responses: {
				200: {
					description: 'Updated message',
					content: { 'application/json': { schema: resolver(MessageSchema) } },
				},
				403: { description: 'Not the message author' },
				404: { description: 'Message not found' },
			},
		}),
		zValidator('param', MessageParam),
		zValidator('json', z.object({ content: z.string().min(1) })),
		async (c) => {
			const storage = c.get('storage')
			const { msgId } = c.req.valid('param')
			const { content } = c.req.valid('json')

			const existing = await storage.readMessage(msgId)
			if (!existing) return c.json({ error: 'message not found' }, 404)

			const actorId = getActorId(c)
			if (existing.from !== actorId) {
				return c.json({ error: 'cannot edit messages from other users' }, 403)
			}

			const updated = await storage.updateMessage(msgId, content)
			return c.json(updated)
		},
	)
	// DELETE /channels/:id/messages/:msgId — delete message
	.delete(
		'/:id/messages/:msgId',
		describeRoute({
			tags: ['channels'],
			description: 'Delete a message (only by the original sender)',
			responses: {
				200: {
					description: 'Deletion result',
					content: { 'application/json': { schema: resolver(OkResponseSchema) } },
				},
				403: { description: 'Not the message author' },
				404: { description: 'Message not found' },
			},
		}),
		zValidator('param', MessageParam),
		async (c) => {
			const storage = c.get('storage')
			const { msgId } = c.req.valid('param')

			const existing = await storage.readMessage(msgId)
			if (!existing) return c.json({ error: 'message not found' }, 404)

			const actorId = getActorId(c)
			if (existing.from !== actorId) {
				return c.json({ error: 'cannot delete messages from other users' }, 403)
			}

			await storage.deleteMessage(msgId)
			return c.json({ ok: true as const })
		},
	)
	// POST /channels/:id/messages/:msgId/pin — pin message
	.post(
		'/:id/messages/:msgId/pin',
		describeRoute({
			tags: ['channels'],
			description: 'Pin a message in the channel',
			responses: {
				201: {
					description: 'Pinned message',
					content: { 'application/json': { schema: resolver(PinnedMessageSchema) } },
				},
			},
		}),
		zValidator('param', MessageParam),
		async (c) => {
			const storage = c.get('storage')
			const { id: channelId, msgId } = c.req.valid('param')

			const pin = await storage.pinMessage(channelId, msgId, getActorId(c))
			return c.json(pin, 201)
		},
	)
	// DELETE /channels/:id/messages/:msgId/pin — unpin message
	.delete(
		'/:id/messages/:msgId/pin',
		describeRoute({
			tags: ['channels'],
			description: 'Unpin a message from the channel',
			responses: {
				200: {
					description: 'Unpinned',
					content: { 'application/json': { schema: resolver(OkResponseSchema) } },
				},
			},
		}),
		zValidator('param', MessageParam),
		async (c) => {
			const storage = c.get('storage')
			const { id: channelId, msgId } = c.req.valid('param')

			await storage.unpinMessage(channelId, msgId)
			return c.json({ ok: true as const })
		},
	)
	// GET /channels/:id/pins — get pinned messages
	.get(
		'/:id/pins',
		describeRoute({
			tags: ['channels'],
			description: 'Get all pinned messages in a channel',
			responses: {
				200: {
					description: 'Array of pinned messages',
					content: { 'application/json': { schema: resolver(z.array(PinnedMessageSchema)) } },
				},
			},
		}),
		zValidator('param', ChannelIdParam),
		async (c) => {
			const storage = c.get('storage')
			const { id: channelId } = c.req.valid('param')

			const pins = await storage.getPinnedMessages(channelId)
			return c.json(pins)
		},
	)
	// POST /channels/:id/messages/:msgId/reactions — add reaction
	.post(
		'/:id/messages/:msgId/reactions',
		describeRoute({
			tags: ['channels'],
			description: 'Add an emoji reaction to a message',
			responses: {
				201: {
					description: 'Created reaction',
					content: { 'application/json': { schema: resolver(ReactionSchema) } },
				},
			},
		}),
		zValidator('param', MessageParam),
		zValidator('json', z.object({ emoji: z.string() })),
		async (c) => {
			const storage = c.get('storage')
			const { msgId } = c.req.valid('param')
			const { emoji } = c.req.valid('json')

			const reaction = await storage.addReaction(msgId, emoji, getActorId(c))
			return c.json(reaction, 201)
		},
	)
	// DELETE /channels/:id/messages/:msgId/reactions — remove reaction
	.delete(
		'/:id/messages/:msgId/reactions',
		describeRoute({
			tags: ['channels'],
			description: 'Remove an emoji reaction from a message',
			responses: {
				200: {
					description: 'Reaction removed',
					content: { 'application/json': { schema: resolver(OkResponseSchema) } },
				},
			},
		}),
		zValidator('param', MessageParam),
		zValidator('json', z.object({ emoji: z.string() })),
		async (c) => {
			const storage = c.get('storage')
			const { msgId } = c.req.valid('param')
			const { emoji } = c.req.valid('json')

			await storage.removeReaction(msgId, emoji, getActorId(c))
			return c.json({ ok: true as const })
		},
	)
	// POST /channels/:id/typing — broadcast typing event
	.post(
		'/:id/typing',
		describeRoute({
			tags: ['channels'],
			description: 'Broadcast a user typing event for the channel (debounce client-side, TTL ~3s)',
			responses: {
				200: {
					description: 'Typing event broadcast',
					content: { 'application/json': { schema: resolver(OkResponseSchema) } },
				},
			},
		}),
		zValidator('param', ChannelIdParam),
		async (c) => {
			const { id: channelId } = c.req.valid('param')

			eventBus.emit({
				type: 'user_typing',
				channelId,
				userId: getActorId(c),
				actorType: 'human',
			})

			return c.json({ ok: true as const })
		},
	)
	// GET /channels/:id/messages/:msgId/reactions — list reactions
	.get(
		'/:id/messages/:msgId/reactions',
		describeRoute({
			tags: ['channels'],
			description: 'Get all reactions for a message',
			responses: {
				200: {
					description: 'Array of reactions',
					content: { 'application/json': { schema: resolver(z.array(ReactionSchema)) } },
				},
			},
		}),
		zValidator('param', MessageParam),
		async (c) => {
			const storage = c.get('storage')
			const { msgId } = c.req.valid('param')

			const reactions = await storage.getReactions(msgId)
			return c.json(reactions)
		},
	)

export { channels }
