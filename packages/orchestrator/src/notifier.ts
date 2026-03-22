import { appendActivity } from './fs'

export interface NotificationOptions {
	companyRoot: string
}

export interface Notification {
	type: 'task_assigned' | 'approval_needed' | 'task_completed' | 'blocker' | 'alert'
	title: string
	message: string
	priority: 'urgent' | 'high' | 'normal' | 'low'
	taskId?: string
	agentId?: string
}

export class Notifier {
	constructor(private options: NotificationOptions) {}

	async notify(notification: Notification): Promise<void> {
		const prefix = notification.priority === 'urgent' ? '!!' : notification.priority === 'high' ? '!' : ''
		console.log(
			`[orchestrator] ${prefix}notification [${notification.type}] ${notification.title}: ${notification.message}`
		)

		try {
			await appendActivity(this.options.companyRoot, {
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
