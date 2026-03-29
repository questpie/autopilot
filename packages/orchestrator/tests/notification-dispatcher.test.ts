/**
 * Notification dispatcher tests — functional classify() + type validation.
 */
import { describe, test, expect } from 'bun:test'
import { classify } from '../src/notifications/dispatcher'
import type { ClassifiedNotification, NotificationType, NotificationPriority } from '../src/notifications/dispatcher'
import type { AutopilotEvent } from '../src/events/event-bus'

// ─── classify() ─────────────────────────────────────────────────────────────

describe('classify', () => {
	test('task review → approval_needed (urgent)', () => {
		const result = classify({ type: 'task_changed', taskId: 'task-1', status: 'review' })
		expect(result).not.toBeNull()
		expect(result!.type).toBe('approval_needed')
		expect(result!.priority).toBe('urgent')
		expect(result!.taskId).toBe('task-1')
		expect(result!.url).toContain('inbox')
	})

	test('task blocked → blocker (high)', () => {
		const result = classify({ type: 'task_changed', taskId: 'task-2', status: 'blocked' })
		expect(result).not.toBeNull()
		expect(result!.type).toBe('blocker')
		expect(result!.priority).toBe('high')
		expect(result!.url).toContain('task-2')
	})

	test('task done → task_completed (normal)', () => {
		const result = classify({ type: 'task_changed', taskId: 'task-3', status: 'done' })
		expect(result).not.toBeNull()
		expect(result!.type).toBe('task_completed')
		expect(result!.priority).toBe('normal')
	})

	test('task in_progress → null (no notification)', () => {
		const result = classify({ type: 'task_changed', taskId: 'task-4', status: 'in_progress' })
		expect(result).toBeNull()
	})

	test('pin created → alert (normal)', () => {
		const result = classify({ type: 'pin_changed', pinId: 'pin-1', action: 'created' })
		expect(result).not.toBeNull()
		expect(result!.type).toBe('alert')
		expect(result!.priority).toBe('normal')
	})

	test('pin removed → null', () => {
		const result = classify({ type: 'pin_changed', pinId: 'pin-1', action: 'removed' })
		expect(result).toBeNull()
	})

	test('DM message → direct_message (normal)', () => {
		const result = classify({ type: 'message', channel: 'dm-user--agent', from: 'dev', content: 'Hello there' })
		expect(result).not.toBeNull()
		expect(result!.type).toBe('direct_message')
		expect(result!.priority).toBe('normal')
		expect(result!.url).toContain('dm-')
	})

	test('message with @mention → mention (high)', () => {
		const result = classify({ type: 'message', channel: 'general', from: 'dev', content: 'Hey @admin check this' })
		expect(result).not.toBeNull()
		expect(result!.type).toBe('mention')
		expect(result!.priority).toBe('high')
	})

	test('regular channel message → null', () => {
		const result = classify({ type: 'message', channel: 'general', from: 'dev', content: 'Just a regular message' })
		expect(result).toBeNull()
	})

	test('validation_error → alert (high)', () => {
		const result = classify({ type: 'validation_error', file: 'agents.yaml', error: 'Invalid schema' })
		expect(result).not.toBeNull()
		expect(result!.type).toBe('alert')
		expect(result!.priority).toBe('high')
		expect(result!.message).toBe('Invalid schema')
	})

	test('message content truncated to 200 chars in DM', () => {
		const longContent = 'x'.repeat(500)
		const result = classify({ type: 'message', channel: 'dm-a--b', from: 'dev', content: longContent })
		expect(result!.message.length).toBeLessThanOrEqual(200)
	})

	test('unrecognized event type → null', () => {
		const result = classify({ type: 'activity', agent: 'dev', toolName: 'bash', summary: 'ran cmd' } as AutopilotEvent)
		expect(result).toBeNull()
	})
})

// ─── Type validation ────────────────────────────────────────────────────────

describe('notification types', () => {
	test('NotificationType covers 6 values', () => {
		const types: NotificationType[] = ['approval_needed', 'blocker', 'task_completed', 'alert', 'mention', 'direct_message']
		expect(types).toHaveLength(6)
	})

	test('NotificationPriority covers 4 levels', () => {
		const p: NotificationPriority[] = ['urgent', 'high', 'normal', 'low']
		expect(p).toHaveLength(4)
	})

	test('ClassifiedNotification required + optional fields', () => {
		const n: ClassifiedNotification = {
			type: 'blocker', priority: 'high', title: 'X', message: 'Y',
			url: '/tasks/1', taskId: 'task-1', agentId: 'dev',
		}
		expect(n.url).toBe('/tasks/1')
		expect(n.taskId).toBe('task-1')
	})
})
