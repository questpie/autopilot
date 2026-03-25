import { container } from './container'
import { storageFactory } from './fs/sqlite-backend'
import type { StorageBackend } from './fs/storage'
import { maskSecret } from './auth/crypto'

/** Configuration for the {@link Notifier}. */
export interface NotificationOptions {
	/** Storage backend for persisting notifications to the activity feed. */
	storage: StorageBackend
}

/** A structured notification emitted by the orchestrator. */
export interface Notification {
	/** Category of the notification. */
	type: 'task_assigned' | 'approval_needed' | 'task_completed' | 'blocker' | 'alert'
	/** Short human-readable title. */
	title: string
	/** Longer description of what happened. */
	message: string
	/** Delivery urgency. */
	priority: 'urgent' | 'high' | 'normal' | 'low'
	/** Related task ID, if any. */
	taskId?: string
	/** Related agent ID, if any. */
	agentId?: string
}

const SECRET_PATTERNS = [
	/sk-[a-zA-Z0-9_-]{20,}/g, // Anthropic keys
	/sk-ant-[a-zA-Z0-9_-]{20,}/g, // Anthropic keys
	/ghp_[a-zA-Z0-9]{36,}/g, // GitHub PATs
	/gho_[a-zA-Z0-9]{36,}/g, // GitHub OAuth
	/ap_[a-zA-Z0-9_-]{20,}/g, // Autopilot agent keys
	/Bearer\s+[a-zA-Z0-9._-]{20,}/gi, // Bearer tokens
	/xoxb-[a-zA-Z0-9-]+/g, // Slack tokens
]

export function sanitizeForLog(text: string): string {
	let result = text
	for (const pattern of SECRET_PATTERNS) {
		result = result.replace(pattern, (match) => maskSecret(match))
	}
	return result
}

/**
 * Dispatches notifications by logging them to stdout and persisting them
 * in the activity feed.
 *
 * In a future iteration this will fan-out to Slack, email, etc.
 */
export class Notifier {
	constructor(private options: NotificationOptions) {}

	/** Emit a notification: log to stdout and persist to the activity feed. */
	async notify(notification: Notification): Promise<void> {
		const prefix = notification.priority === 'urgent' ? '!!' : notification.priority === 'high' ? '!' : ''
		const safeTitle = sanitizeForLog(notification.title)
		const safeMessage = sanitizeForLog(notification.message)
		console.log(
			`[orchestrator] ${prefix}notification [${notification.type}] ${safeTitle}: ${safeMessage}`
		)

		try {
			await this.options.storage.appendActivity({
				at: new Date().toISOString(),
				agent: notification.agentId ?? 'orchestrator',
				type: `notification:${notification.type}`,
				summary: safeTitle,
				details: {
					message: safeMessage,
					priority: notification.priority,
					taskId: notification.taskId,
					agentId: notification.agentId,
				},
			})
		} catch (err) {
			console.error('[orchestrator] failed to log notification to activity feed:', err)
		}
	}
}

export const notifierFactory = container.registerAsync('notifier', async (c) => {
	const { storage } = await c.resolveAsync([storageFactory])
	return new Notifier({ storage })
})
