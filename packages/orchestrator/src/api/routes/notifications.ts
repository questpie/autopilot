/**
 * Notifications API — CRUD for notifications + push subscription management.
 *
 * GET    /notifications                      — list notifications (query: ?unread, ?type, ?limit)
 * PATCH  /notifications/:id                  — mark read/dismissed
 * POST   /notifications/mark-all-read        — mark all as read
 * DELETE /notifications/:id                  — delete notification
 * POST   /notifications/push/subscribe       — register push subscription
 * DELETE /notifications/push/subscribe       — unregister push subscription
 * GET    /notifications/push/vapid-key       — get public VAPID key
 */
import { Hono } from 'hono'
import { describeRoute } from 'hono-openapi'
import { resolver, validator as zValidator } from 'hono-openapi'
import { z } from 'zod'
import { eq, and, isNull, desc } from 'drizzle-orm'
import { notifications, pushSubscriptions } from '../../db/schema'
import { getVapidKeys } from '../../notifications/transports/push'
import type { AppEnv } from '../app'

// ── Schemas ─────────────────────────────────────────────────────────────────

const NotificationSchema = z.object({
	id: z.string(),
	user_id: z.string(),
	type: z.string(),
	priority: z.string(),
	title: z.string(),
	message: z.string().nullable(),
	url: z.string().nullable(),
	task_id: z.string().nullable(),
	agent_id: z.string().nullable(),
	read_at: z.number().nullable(),
	dismissed_at: z.number().nullable(),
	delivered_via: z.string().nullable(),
	created_at: z.number(),
})

const NotificationListQuerySchema = z.object({
	unread: z.string().optional(),
	type: z.string().optional(),
	limit: z.string().optional(),
})

const NotificationPatchSchema = z.object({
	read: z.boolean().optional(),
	dismissed: z.boolean().optional(),
})

const IdParamSchema = z.object({
	id: z.string(),
})

const PushSubscribeSchema = z.object({
	endpoint: z.string().url(),
	keys: z.object({
		p256dh: z.string(),
		auth: z.string(),
	}),
})

// ── Helpers ─────────────────────────────────────────────────────────────────

function getActorId(c: { get(key: 'actor'): { id: string } | null }): string | null {
	return c.get('actor')?.id ?? null
}

// ── Routes ──────────────────────────────────────────────────────────────────

const notificationsRoute = new Hono<AppEnv>()
	// ── GET /notifications — list ──────────────────────────────────────
	.get(
		'/',
		describeRoute({
			tags: ['notifications'],
			description: 'List notifications for the current user',
			responses: {
				200: {
					description: 'Array of notifications',
					content: { 'application/json': { schema: resolver(z.array(NotificationSchema)) } },
				},
				401: { description: 'Unauthorized' },
			},
		}),
		zValidator('query', NotificationListQuerySchema),
		async (c) => {
			const userId = getActorId(c as never)
			if (!userId) return c.json({ error: 'Unauthorized' }, 401)

			const db = c.get('db')
			const { unread, type, limit: limitStr } = c.req.valid('query')
			const limit = Math.min(parseInt(limitStr ?? '50', 10) || 50, 200)

			const conditions = [eq(notifications.user_id, userId)]
			if (unread === 'true') {
				conditions.push(isNull(notifications.read_at))
			}
			if (type) {
				conditions.push(eq(notifications.type, type))
			}

			const rows = await db
				.select()
				.from(notifications)
				.where(and(...conditions))
				.orderBy(desc(notifications.created_at))
				.limit(limit)

			return c.json(rows, 200)
		},
	)
	// ── PATCH /notifications/:id — mark read/dismissed ─────────────────
	.patch(
		'/:id',
		describeRoute({
			tags: ['notifications'],
			description: 'Mark a notification as read or dismissed',
			responses: {
				200: {
					description: 'Notification updated',
					content: { 'application/json': { schema: resolver(z.object({ ok: z.literal(true) })) } },
				},
				401: { description: 'Unauthorized' },
				404: { description: 'Not found' },
			},
		}),
		zValidator('param', IdParamSchema),
		zValidator('json', NotificationPatchSchema),
		async (c) => {
			const userId = getActorId(c as never)
			if (!userId) return c.json({ error: 'Unauthorized' }, 401)

			const db = c.get('db')
			const { id } = c.req.valid('param')
			const body = c.req.valid('json')
			const now = Date.now()

			const updates: Record<string, unknown> = {}
			if (body.read) updates.read_at = now
			if (body.dismissed) updates.dismissed_at = now

			if (Object.keys(updates).length === 0) {
				return c.json({ ok: true as const }, 200)
			}

			await db
				.update(notifications)
				.set(updates)
				.where(and(eq(notifications.id, id), eq(notifications.user_id, userId)))

			return c.json({ ok: true as const }, 200)
		},
	)
	// ── POST /notifications/mark-all-read ──────────────────────────────
	.post(
		'/mark-all-read',
		describeRoute({
			tags: ['notifications'],
			description: 'Mark all notifications as read for the current user',
			responses: {
				200: {
					description: 'All marked as read',
					content: { 'application/json': { schema: resolver(z.object({ ok: z.literal(true), count: z.number() })) } },
				},
				401: { description: 'Unauthorized' },
			},
		}),
		async (c) => {
			const userId = getActorId(c as never)
			if (!userId) return c.json({ error: 'Unauthorized' }, 401)

			const db = c.get('db')
			const now = Date.now()

			await db
				.update(notifications)
				.set({ read_at: now })
				.where(and(eq(notifications.user_id, userId), isNull(notifications.read_at)))

			return c.json({ ok: true as const, count: 0 }, 200)
		},
	)
	// ── DELETE /notifications/:id ──────────────────────────────────────
	.delete(
		'/:id',
		describeRoute({
			tags: ['notifications'],
			description: 'Delete a notification',
			responses: {
				200: {
					description: 'Notification deleted',
					content: { 'application/json': { schema: resolver(z.object({ ok: z.literal(true) })) } },
				},
				401: { description: 'Unauthorized' },
				404: { description: 'Not found' },
			},
		}),
		zValidator('param', IdParamSchema),
		async (c) => {
			const userId = getActorId(c as never)
			if (!userId) return c.json({ error: 'Unauthorized' }, 401)

			const db = c.get('db')
			const { id } = c.req.valid('param')

			await db
				.delete(notifications)
				.where(and(eq(notifications.id, id), eq(notifications.user_id, userId)))

			return c.json({ ok: true as const }, 200)
		},
	)
	// ── POST /notifications/push/subscribe — register push ─────────────
	.post(
		'/push/subscribe',
		describeRoute({
			tags: ['notifications'],
			description: 'Register a push subscription for the current user',
			responses: {
				200: {
					description: 'Subscription registered',
					content: { 'application/json': { schema: resolver(z.object({ ok: z.literal(true) })) } },
				},
				401: { description: 'Unauthorized' },
			},
		}),
		zValidator('json', PushSubscribeSchema),
		async (c) => {
			const userId = getActorId(c as never)
			if (!userId) return c.json({ error: 'Unauthorized' }, 401)

			const db = c.get('db')
			const { endpoint, keys } = c.req.valid('json')

			// Upsert: delete existing subscription with same endpoint, then insert
			await db
				.delete(pushSubscriptions)
				.where(eq(pushSubscriptions.endpoint, endpoint))

			const id = crypto.randomUUID()
			await db.insert(pushSubscriptions).values({
				id,
				user_id: userId,
				endpoint,
				keys_p256dh: keys.p256dh,
				keys_auth: keys.auth,
				created_at: Date.now(),
			})

			return c.json({ ok: true as const }, 200)
		},
	)
	// ── DELETE /notifications/push/subscribe — unregister push ──────────
	.delete(
		'/push/subscribe',
		describeRoute({
			tags: ['notifications'],
			description: 'Unregister a push subscription',
			responses: {
				200: {
					description: 'Subscription removed',
					content: { 'application/json': { schema: resolver(z.object({ ok: z.literal(true) })) } },
				},
				401: { description: 'Unauthorized' },
			},
		}),
		zValidator('json', z.object({ endpoint: z.string() })),
		async (c) => {
			const userId = getActorId(c as never)
			if (!userId) return c.json({ error: 'Unauthorized' }, 401)

			const db = c.get('db')
			const { endpoint } = c.req.valid('json')

			await db
				.delete(pushSubscriptions)
				.where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.user_id, userId)))

			return c.json({ ok: true as const }, 200)
		},
	)
	// ── GET /notifications/push/vapid-key — public VAPID key ───────────
	.get(
		'/push/vapid-key',
		describeRoute({
			tags: ['notifications'],
			description: 'Get the public VAPID key for push subscription registration',
			responses: {
				200: {
					description: 'VAPID public key',
					content: { 'application/json': { schema: resolver(z.object({ publicKey: z.string() })) } },
				},
				503: { description: 'Push not configured' },
			},
		}),
		async (c) => {
			const root = c.get('companyRoot')
			const keys = await getVapidKeys(root)
			if (!keys) {
				return c.json({ error: 'Push notifications not configured' }, 503)
			}
			return c.json({ publicKey: keys.publicKey }, 200)
		},
	)

export { notificationsRoute as notifications }
