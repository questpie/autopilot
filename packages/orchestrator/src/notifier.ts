import { container } from './container'
import { storageFactory } from './fs/sqlite-backend'
import type { StorageBackend } from './fs/storage'

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
		console.log(
			`[orchestrator] ${prefix}notification [${notification.type}] ${notification.title}: ${notification.message}`
		)

		try {
			await this.options.storage.appendActivity({
				at: new Date().toISOString(),
				agent: notification.agentId ?? 'orchestrator',
				type: `notification:${notification.type}`,
				summary: notification.title,
				details: {
					message: notification.message,
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
