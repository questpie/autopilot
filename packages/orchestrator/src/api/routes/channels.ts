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
} from '@questpie/autopilot-spec'
import { eventBus } from '../../events/event-bus'
import { loadAgents, loadCompany } from '../../fs/company'
import { routeMessage } from '../../router'
import { spawnAgent } from '../../agent/spawner'
import type { AppEnv } from '../app'

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
		zValidator('param', z.object({ id: z.string() })),
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
		zValidator('param', z.object({ id: z.string() })),
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
		zValidator('param', z.object({ id: z.string() })),
		zValidator('query', ChannelMessagesQuerySchema),
		async (c) => {
			const storage = c.get('storage')
			const { id } = c.req.valid('param')
			const { limit } = c.req.valid('query')

			const messages = await storage.readMessages({
				channel: id,
				limit,
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
		zValidator('param', z.object({ id: z.string() })),
		zValidator('json', SendChannelMessageRequestSchema),
		async (c) => {
			const storage = c.get('storage')
			const actor = c.get('actor')
			const root = c.get('companyRoot')
			const { id: channelId } = c.req.valid('param')
			const body = c.req.valid('json')

			const channel = await storage.readChannel(channelId)
			if (!channel) return c.json({ error: 'channel not found' }, 404)

			const now = new Date().toISOString()
			const fromId = actor?.id ?? 'anonymous'

			const message = await storage.sendMessage({
				id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
				channel: channelId,
				from: fromId,
				at: now,
				content: body.content,
				thread: body.thread ?? null,
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
						console.error('[channels] spawn error:', err),
					)
				}
			} catch (err) {
				console.error('[channels] routing error:', err)
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
		zValidator('param', z.object({ id: z.string() })),
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
		zValidator('param', z.object({ id: z.string() })),
		async (c) => {
			const storage = c.get('storage')
			const { id } = c.req.valid('param')
			const members = await storage.getChannelMembers(id)
			return c.json(members)
		},
	)

export { channels }
