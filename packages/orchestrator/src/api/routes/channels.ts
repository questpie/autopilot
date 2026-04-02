/**
 * Channel routes — placeholder for the channels subsystem.
 *
 * The full channel CRUD (messages, members, reactions, pins, typing) will
 * be rebuilt on top of the new MessageService once the channel service is
 * created. For now this provides the basic list/create/get/delete and
 * message send/read operations using the message service.
 */
import { Hono } from 'hono'
import { validator as zValidator } from 'hono-openapi'
import { z } from 'zod'
import type { AppEnv } from '../app'
import { eventBus } from '../../events/event-bus'

const channels = new Hono<AppEnv>()
	// GET /channels — list channels (stub)
	.get('/', async (c) => {
		// TODO: implement via ChannelService once created
		return c.json([], 200)
	})
	// POST /channels — create channel (stub)
	.post(
		'/',
		zValidator(
			'json',
			z.object({
				name: z.string().min(1),
				type: z.enum(['group', 'direct']).default('group'),
				description: z.string().optional(),
			}),
		),
		async (c) => {
			// TODO: implement via ChannelService
			const body = c.req.valid('json')
			const id = body.name
				.toLowerCase()
				.replace(/[^a-z0-9-]/g, '-')
				.replace(/-+/g, '-')
				.replace(/^-|-$/g, '')
			return c.json({ id, name: body.name, type: body.type }, 201)
		},
	)
	// GET /channels/:id — get channel (stub)
	.get(
		'/:id',
		zValidator('param', z.object({ id: z.string() })),
		async (c) => {
			const { id } = c.req.valid('param')
			return c.json({ id, name: id, type: 'group' }, 200)
		},
	)
	// GET /channels/:id/messages — read messages
	.get(
		'/:id/messages',
		zValidator('param', z.object({ id: z.string() })),
		zValidator(
			'query',
			z.object({
				limit: z.coerce.number().int().min(1).max(100).default(50),
			}),
		),
		async (c) => {
			const { messageService } = c.get('services')
			const { id } = c.req.valid('param')
			const { limit } = c.req.valid('query')
			const messages = await messageService.listByChannel(id, { limit })
			return c.json(messages, 200)
		},
	)
	// POST /channels/:id/messages — send message
	.post(
		'/:id/messages',
		zValidator('param', z.object({ id: z.string() })),
		zValidator(
			'json',
			z.object({
				content: z.string().min(1),
				thread_id: z.string().optional(),
			}),
		),
		async (c) => {
			const { messageService } = c.get('services')
			const { id: channelId } = c.req.valid('param')
			const body = c.req.valid('json')
			const actor = c.get('actor')
			const fromId = actor?.id ?? 'anonymous'

			const msgId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
			const message = await messageService.create({
				id: msgId,
				from_id: fromId,
				channel_id: channelId,
				content: body.content,
				thread_id: body.thread_id,
			})

			if (!message) return c.json({ error: 'failed to send message' }, 500)

			eventBus.emit({
				type: 'message',
				channelId,
				fromId,
			})

			return c.json(message, 201)
		},
	)

export { channels }
