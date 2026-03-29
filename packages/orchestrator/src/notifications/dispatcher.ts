/**
 * NotificationDispatcher — classifies EventBus events into notifications,
 * finds target humans, respects quiet hours and throttle, stores in DB,
 * and dispatches via configured transports (push, SSE).
 */
import { eq, and } from 'drizzle-orm'
import { logger } from '../logger'
import { join } from 'node:path'
import { notifications, notificationThrottle } from '../db/schema'
import { eventBus } from '../events'
import type { AutopilotEvent } from '../events'
import type { AutopilotDb } from '../db'
import { readYamlUnsafe, fileExists } from '../fs/yaml'
import { sendPushToUser } from './transports/push'
import { classify as llmClassify, getUtilityModel, NOTIFICATION_CLASSIFIER } from '../agent/micro-agent'

// ── Types ───────────────────────────────────────────────────────────────────

export type NotificationType =
	| 'approval_needed'
	| 'blocker'
	| 'task_completed'
	| 'alert'
	| 'mention'
	| 'direct_message'

export type NotificationPriority = 'urgent' | 'high' | 'normal' | 'low'

export interface ClassifiedNotification {
	type: NotificationType
	priority: NotificationPriority
	title: string
	message: string
	url?: string
	taskId?: string
	agentId?: string
}

interface HumanTarget {
	id: string
	email?: string
	name?: string
	role: string
	notification_routing?: {
		push?: string[]
		quiet_hours?: {
			enabled?: boolean
			start?: string
			end?: string
			timezone?: string
			except?: string[]
		}
		throttle?: Record<string, string>
	}
}

// ── Classification ──────────────────────────────────────────────────────────

function classify(event: AutopilotEvent): ClassifiedNotification | null {
	switch (event.type) {
		case 'task_changed': {
			if (event.status === 'review' || event.status === 'blocked') {
				if (event.status === 'blocked') {
					return {
						type: 'blocker',
						priority: 'high',
						title: `Task blocked: ${event.taskId}`,
						message: `Task ${event.taskId} is blocked and needs attention`,
						url: `/tasks/${event.taskId}`,
						taskId: event.taskId,
					}
				}
				return {
					type: 'approval_needed',
					priority: 'urgent',
					title: `Approval needed: ${event.taskId}`,
					message: `Task ${event.taskId} requires your approval`,
					url: '/inbox',
					taskId: event.taskId,
				}
			}
			if (event.status === 'done') {
				return {
					type: 'task_completed',
					priority: 'normal',
					title: `Task completed: ${event.taskId}`,
					message: `Task ${event.taskId} has been completed`,
					url: `/tasks/${event.taskId}`,
					taskId: event.taskId,
				}
			}
			return null
		}
		case 'pin_changed': {
			if (event.action === 'created') {
				return {
					type: 'alert',
					priority: 'normal',
					title: `New pin: ${event.pinId}`,
					message: `A new item was pinned to the dashboard`,
					url: '/',
				}
			}
			return null
		}
		case 'message': {
			// DM → direct_message notification (normal priority)
			if (event.channel.startsWith('dm-')) {
				return {
					type: 'direct_message',
					priority: 'normal',
					title: 'New direct message',
					message: event.content.slice(0, 200),
					url: `/chat/${event.channel}`,
				}
			}
			// @mention → mention notification (high priority)
			if (/@\w+/.test(event.content)) {
				return {
					type: 'mention',
					priority: 'high',
					title: 'You were mentioned',
					message: event.content.slice(0, 200),
					url: `/chat/${event.channel}`,
				}
			}
			return null
		}
		case 'validation_error': {
			return {
				type: 'alert',
				priority: 'high',
				title: `Config error: ${event.file}`,
				message: event.error,
				url: `/files/${event.file}`,
			}
		}
		default:
			return null
	}
}

// ── Quiet hours ─────────────────────────────────────────────────────────────

function isQuietHours(target: HumanTarget, priority: NotificationPriority): boolean {
	const qh = target.notification_routing?.quiet_hours
	if (!qh?.enabled) return false

	// Urgent notifications bypass quiet hours by default
	if (priority === 'urgent' && (qh.except ?? ['urgent']).includes('urgent')) {
		return false
	}

	const tz = qh.timezone ?? 'UTC'
	const now = new Date()
	let localHour: number
	try {
		const formatter = new Intl.DateTimeFormat('en-US', {
			hour: 'numeric',
			hour12: false,
			timeZone: tz,
		})
		localHour = parseInt(formatter.format(now), 10)
	} catch {
		localHour = now.getUTCHours()
	}

	const start = parseInt(qh.start ?? '22', 10)
	const end = parseInt(qh.end ?? '7', 10)

	if (start > end) {
		// Overnight window (e.g. 22:00-07:00)
		return localHour >= start || localHour < end
	}
	return localHour >= start && localHour < end
}

// ── Throttle ────────────────────────────────────────────────────────────────

async function isThrottled(
	db: AutopilotDb,
	userId: string,
	type: string,
	transport: string,
	throttleMinutes: number,
): Promise<boolean> {
	if (throttleMinutes <= 0) return false

	const rows = await db
		.select()
		.from(notificationThrottle)
		.where(
			and(
				eq(notificationThrottle.user_id, userId),
				eq(notificationThrottle.type, type),
				eq(notificationThrottle.transport, transport),
			),
		)
		.limit(1)

	const row = rows[0]
	if (!row) return false

	const elapsed = Date.now() - row.last_sent_at
	return elapsed < throttleMinutes * 60 * 1000
}

async function recordThrottle(
	db: AutopilotDb,
	userId: string,
	type: string,
	transport: string,
): Promise<void> {
	// Upsert: delete then insert (SQLite-friendly)
	await db
		.delete(notificationThrottle)
		.where(
			and(
				eq(notificationThrottle.user_id, userId),
				eq(notificationThrottle.type, type),
				eq(notificationThrottle.transport, transport),
			),
		)
	await db.insert(notificationThrottle).values({
		user_id: userId,
		type,
		transport,
		last_sent_at: Date.now(),
	})
}

// ── Target resolution ───────────────────────────────────────────────────────

async function findTargets(companyRoot: string): Promise<HumanTarget[]> {
	const humansPath = join(companyRoot, 'team', 'humans.yaml')
	if (!(await fileExists(humansPath))) return []
	try {
		const data = await readYamlUnsafe(humansPath)
		const humans = (data as { humans?: HumanTarget[] })?.humans ?? []
		return humans
	} catch {
		return []
	}
}

// ── Dispatcher class ────────────────────────────────────────────────────────

export class NotificationDispatcher {
	constructor(
		private companyRoot: string,
		private db: AutopilotDb,
	) {}

	private async classifyWithAI(event: AutopilotEvent): Promise<ClassifiedNotification | null> {
		// Always run hardcoded classification first — it determines type, url, taskId
		const base = classify(event)
		if (!base) return null

		// Try AI enhancement for priority + summary
		try {
			const model = await getUtilityModel(this.companyRoot)
			const input = JSON.stringify({ eventType: event.type, ...event })
			const result = await llmClassify(NOTIFICATION_CLASSIFIER, input, model)
			if (result) {
				// Map AI priority ('critical' → 'urgent') to our NotificationPriority
				const priorityMap: Record<string, NotificationPriority> = {
					critical: 'urgent',
					high: 'high',
					normal: 'normal',
					low: 'low',
				}
				return {
					...base,
					priority: priorityMap[result.priority] ?? base.priority,
					message: result.summary || base.message,
				}
			}
		} catch (err) {
			logger.debug('notifications', 'AI classification unavailable, using hardcoded', {
				error: err instanceof Error ? err.message : String(err),
			})
		}

		// Fallback: hardcoded result as-is
		return base
	}

	async handle(event: AutopilotEvent): Promise<void> {
		const notification = await this.classifyWithAI(event)
		if (!notification) return

		const targets = await findTargets(this.companyRoot)
		if (targets.length === 0) return

		for (const target of targets) {
			// Filter by role — admins and owners get all notifications
			// Other roles only get direct_message and mention
			if (
				target.role !== 'owner' && target.role !== 'admin' &&
				notification.type !== 'direct_message' && notification.type !== 'mention'
			) {
				continue
			}

			// Quiet hours — still store + SSE, but skip push (the disruptive transport)
			const quiet = isQuietHours(target, notification.priority)

			// Throttle check (15 min default for normal/low priority)
			const throttleMinutes = notification.priority === 'urgent' || notification.priority === 'high' ? 0 : 15
			const throttled = await isThrottled(this.db, target.id, notification.type, 'all', throttleMinutes)
			if (throttled) continue

			await this.deliver(notification, target, { skipPush: quiet })
		}
	}

	private async deliver(
		notification: ClassifiedNotification,
		target: HumanTarget,
		opts: { skipPush?: boolean } = {},
	): Promise<void> {
		const id = crypto.randomUUID()
		const now = Date.now()
		const deliveredVia: string[] = []

		// 1. Store in DB
		await this.db.insert(notifications).values({
			id,
			user_id: target.id,
			type: notification.type,
			priority: notification.priority,
			title: notification.title,
			message: notification.message,
			url: notification.url ?? null,
			task_id: notification.taskId ?? null,
			agent_id: notification.agentId ?? null,
			delivered_via: null,
			created_at: now,
		})

		// 2. Emit SSE event for real-time dashboard updates
		eventBus.emit({
			type: 'notification_new' as never,
			notificationId: id,
			userId: target.id,
			notificationType: notification.type,
			priority: notification.priority,
			title: notification.title,
			message: notification.message,
			url: notification.url,
		} as never)

		// 3. Send push notification (if configured) — skipped during quiet hours
		if (!opts.skipPush) {
			try {
				const sent = await sendPushToUser(this.db, this.companyRoot, target.id, {
					title: notification.title,
					body: notification.message,
					icon: '/icons/icon-192.png',
					badge: '/icons/badge-72.png',
					tag: `${notification.type}-${notification.taskId ?? id}`,
					data: {
						url: notification.url ?? '/',
						taskId: notification.taskId,
						type: notification.type,
					},
					actions: notification.type === 'approval_needed'
						? [{ action: 'approve', title: 'Approve' }, { action: 'view', title: 'View' }]
						: [{ action: 'view', title: 'View' }],
				})
				if (sent) deliveredVia.push('push')
			} catch (err) {
				logger.error('notifications', `push delivery failed for ${target.id}`, { error: err instanceof Error ? err.message : String(err) })
			}
		}

		// 4. Update delivered_via
		if (deliveredVia.length > 0) {
			await this.db
				.update(notifications)
				.set({ delivered_via: JSON.stringify(deliveredVia) })
				.where(eq(notifications.id, id))
		}

		// 5. Record throttle
		await recordThrottle(this.db, target.id, notification.type, 'all')
	}
}
