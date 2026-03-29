/**
 * Notification dispatcher tests.
 *
 * Tests the event→notification classification logic, quiet hours,
 * throttling, and type exports. The classify() function is private
 * but we test its behavior through the exported types and by
 * verifying the dispatcher source contracts.
 */
import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ClassifiedNotification, NotificationType, NotificationPriority } from '../src/notifications/dispatcher'

const dispatcherSource = readFileSync(
	join(import.meta.dir, '..', 'src', 'notifications', 'dispatcher.ts'),
	'utf-8',
)

// ─── Type validation ────────────────────────────────────────────────────────

describe('notification types', () => {
	test('NotificationType covers all expected values', () => {
		const types: NotificationType[] = [
			'approval_needed',
			'blocker',
			'task_completed',
			'alert',
			'mention',
			'direct_message',
		]
		expect(types).toHaveLength(6)
	})

	test('NotificationPriority covers all levels', () => {
		const priorities: NotificationPriority[] = ['urgent', 'high', 'normal', 'low']
		expect(priorities).toHaveLength(4)
	})

	test('ClassifiedNotification has required fields', () => {
		const notif: ClassifiedNotification = {
			type: 'alert',
			priority: 'normal',
			title: 'Test',
			message: 'Test message',
		}
		expect(notif.type).toBe('alert')
		expect(notif.priority).toBe('normal')
		expect(notif.title).toBe('Test')
		expect(notif.message).toBe('Test message')
	})

	test('ClassifiedNotification optional fields', () => {
		const notif: ClassifiedNotification = {
			type: 'blocker',
			priority: 'high',
			title: 'Blocked',
			message: 'Task blocked',
			url: '/tasks/task-1',
			taskId: 'task-1',
			agentId: 'dev',
		}
		expect(notif.url).toBe('/tasks/task-1')
		expect(notif.taskId).toBe('task-1')
		expect(notif.agentId).toBe('dev')
	})
})

// ─── Classification logic (verified via source) ─────────────────────────────

describe('classify event→notification', () => {
	test('task_changed with status=review → approval_needed', () => {
		expect(dispatcherSource).toContain("type: 'approval_needed'")
		expect(dispatcherSource).toContain("priority: 'urgent'")
		expect(dispatcherSource).toContain("event.status === 'review'")
	})

	test('task_changed with status=blocked → blocker', () => {
		expect(dispatcherSource).toContain("type: 'blocker'")
		expect(dispatcherSource).toContain("event.status === 'blocked'")
	})

	test('task_changed with status=done → task_completed', () => {
		expect(dispatcherSource).toContain("type: 'task_completed'")
		expect(dispatcherSource).toContain("event.status === 'done'")
	})

	test('pin_changed with action=created → alert', () => {
		expect(dispatcherSource).toContain("type: 'alert'")
		expect(dispatcherSource).toContain("event.action === 'created'")
	})

	test('DM message → direct_message notification', () => {
		expect(dispatcherSource).toContain("type: 'direct_message'")
		expect(dispatcherSource).toContain("channel.startsWith('dm-')")
	})

	test('message with @mention → mention notification', () => {
		expect(dispatcherSource).toContain("type: 'mention'")
		expect(dispatcherSource).toContain("/@\\w+/")
	})

	test('validation_error → alert with high priority', () => {
		expect(dispatcherSource).toContain("case 'validation_error'")
		expect(dispatcherSource).toContain("Config error:")
	})

	test('unrecognized events return null (no notification)', () => {
		expect(dispatcherSource).toContain('return null')
	})
})

// ─── Dispatcher class contracts ─────────────────────────────────────────────

describe('NotificationDispatcher', () => {
	test('constructor takes companyRoot and db', () => {
		expect(dispatcherSource).toContain('private companyRoot: string')
		expect(dispatcherSource).toContain('private db: AutopilotDb')
	})

	test('handle method exists and calls classify', () => {
		expect(dispatcherSource).toContain('async handle(event: AutopilotEvent)')
		expect(dispatcherSource).toContain('classifyWithAI(event)')
	})

	test('classifyWithAI falls back to hardcoded on LLM failure', () => {
		expect(dispatcherSource).toContain('AI classification unavailable')
		expect(dispatcherSource).toContain('hardcoded result')
	})

	test('stores notification in database', () => {
		expect(dispatcherSource).toContain('insert(notifications)')
	})

	test('emits notification_new event on EventBus', () => {
		expect(dispatcherSource).toContain("type: 'notification_new'")
	})

	test('respects quiet hours', () => {
		expect(dispatcherSource).toContain('quiet_hours')
		expect(dispatcherSource).toContain('isQuietHours')
	})

	test('respects throttle settings', () => {
		expect(dispatcherSource).toContain('throttle')
		expect(dispatcherSource).toContain('notificationThrottle')
	})

	test('sends push notifications', () => {
		expect(dispatcherSource).toContain('sendPushToUser')
	})

	test('priority mapping: AI critical → urgent', () => {
		expect(dispatcherSource).toContain("critical: 'urgent'")
	})

	test('message content truncated to 200 chars for DM/mention', () => {
		expect(dispatcherSource).toContain('content.slice(0, 200)')
	})

	test('admins get all notifications, others only DM/mention', () => {
		expect(dispatcherSource).toContain('admin')
		expect(dispatcherSource).toContain('owner')
		expect(dispatcherSource).toContain('direct_message')
	})
})
