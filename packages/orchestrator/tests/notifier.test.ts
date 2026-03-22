import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Notifier } from '../src/notifier'
import type { Notification } from '../src/notifier'
import { createTestCompany } from './helpers'
import { readActivity } from '../src/fs/activity'

describe('Notifier', () => {
	let companyRoot: string
	let cleanup: () => Promise<void>

	beforeEach(async () => {
		const tc = await createTestCompany()
		companyRoot = tc.root
		cleanup = tc.cleanup
	})

	afterEach(async () => {
		await cleanup()
	})

	test('constructor initializes without error', () => {
		const notifier = new Notifier({ companyRoot })
		expect(notifier).toBeDefined()
	})

	test('notify logs to activity feed', async () => {
		const notifier = new Notifier({ companyRoot })

		const notification: Notification = {
			type: 'task_assigned',
			title: 'Task assigned: Build Feature',
			message: 'Task task-1 assigned to dev-agent',
			priority: 'normal',
			taskId: 'task-1',
			agentId: 'dev-agent',
		}

		await notifier.notify(notification)

		const entries = await readActivity(companyRoot)
		expect(entries).toHaveLength(1)
		expect(entries[0]!.agent).toBe('dev-agent')
		expect(entries[0]!.type).toBe('notification:task_assigned')
		expect(entries[0]!.summary).toBe('Task assigned: Build Feature')
		expect(entries[0]!.details).toEqual({
			message: 'Task task-1 assigned to dev-agent',
			priority: 'normal',
			taskId: 'task-1',
			agentId: 'dev-agent',
		})
	})

	test('notify uses orchestrator as default agent', async () => {
		const notifier = new Notifier({ companyRoot })

		await notifier.notify({
			type: 'alert',
			title: 'System alert',
			message: 'Something happened',
			priority: 'high',
		})

		const entries = await readActivity(companyRoot)
		expect(entries).toHaveLength(1)
		expect(entries[0]!.agent).toBe('orchestrator')
	})

	test('notify with urgent priority', async () => {
		const notifier = new Notifier({ companyRoot })

		await notifier.notify({
			type: 'blocker',
			title: 'Critical blocker',
			message: 'Production is down',
			priority: 'urgent',
			taskId: 'task-urgent',
		})

		const entries = await readActivity(companyRoot)
		expect(entries).toHaveLength(1)
		expect(entries[0]!.details).toMatchObject({
			priority: 'urgent',
			taskId: 'task-urgent',
		})
	})

	test('notify with approval_needed type', async () => {
		const notifier = new Notifier({ companyRoot })

		await notifier.notify({
			type: 'approval_needed',
			title: 'Merge approval needed',
			message: 'PR #42 needs review',
			priority: 'high',
			taskId: 'task-pr-42',
			agentId: 'dev-agent',
		})

		const entries = await readActivity(companyRoot)
		expect(entries).toHaveLength(1)
		expect(entries[0]!.type).toBe('notification:approval_needed')
	})

	test('multiple notifications create multiple activity entries', async () => {
		const notifier = new Notifier({ companyRoot })

		await notifier.notify({
			type: 'task_assigned',
			title: 'Task 1',
			message: 'First task',
			priority: 'normal',
			agentId: 'agent-1',
		})

		await notifier.notify({
			type: 'task_completed',
			title: 'Task 2',
			message: 'Second task done',
			priority: 'low',
			agentId: 'agent-2',
		})

		const entries = await readActivity(companyRoot)
		expect(entries).toHaveLength(2)
		expect(entries[0]!.type).toBe('notification:task_assigned')
		expect(entries[1]!.type).toBe('notification:task_completed')
	})
})
