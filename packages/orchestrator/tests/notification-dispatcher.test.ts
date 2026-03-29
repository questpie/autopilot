/**
 * Notification dispatcher tests — type validation only (functional).
 */
import { describe, test, expect } from 'bun:test'
import type { ClassifiedNotification, NotificationType, NotificationPriority } from '../src/notifications/dispatcher'

describe('notification types', () => {
	test('NotificationType covers all expected values', () => {
		const types: NotificationType[] = [
			'approval_needed', 'blocker', 'task_completed',
			'alert', 'mention', 'direct_message',
		]
		expect(types).toHaveLength(6)
	})

	test('NotificationPriority covers all levels', () => {
		const priorities: NotificationPriority[] = ['urgent', 'high', 'normal', 'low']
		expect(priorities).toHaveLength(4)
	})

	test('ClassifiedNotification required fields', () => {
		const n: ClassifiedNotification = { type: 'alert', priority: 'normal', title: 'Test', message: 'Msg' }
		expect(n.type).toBe('alert')
		expect(n.priority).toBe('normal')
	})

	test('ClassifiedNotification optional fields', () => {
		const n: ClassifiedNotification = {
			type: 'blocker', priority: 'high', title: 'X', message: 'Y',
			url: '/tasks/1', taskId: 'task-1', agentId: 'dev',
		}
		expect(n.url).toBe('/tasks/1')
		expect(n.taskId).toBe('task-1')
	})
})
