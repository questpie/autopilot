import { describe, it, expect, beforeEach, afterEach, spyOn } from 'bun:test'
import { Notifier, type Notification } from '../src/notifier'
import type { StorageBackend, ActivityEntry } from '../src/fs/storage'

function createMockStorage() {
	const activityCalls: ActivityEntry[] = []
	let shouldFail = false

	const storage = {
		activityCalls,
		setShouldFail(v: boolean) {
			shouldFail = v
		},
		initialize: async () => {},
		close: async () => {},
		createTask: async () => ({}) as any,
		readTask: async () => null,
		updateTask: async () => ({}) as any,
		moveTask: async () => ({}) as any,
		listTasks: async () => [],
		countTasks: async () => 0,
		deleteTask: async () => {},
		sendMessage: async () => ({}) as any,
		readMessages: async () => [],
		searchMessages: async () => [],
		appendActivity: async (entry: ActivityEntry) => {
			if (shouldFail) throw new Error('storage failure')
			activityCalls.push(entry)
		},
		readActivity: async () => [],
	} satisfies StorageBackend & { activityCalls: ActivityEntry[]; setShouldFail: (v: boolean) => void }

	return storage
}

describe('Notifier', () => {
	let mockStorage: ReturnType<typeof createMockStorage>
	let notifier: Notifier
	let logSpy: ReturnType<typeof spyOn>
	let errorSpy: ReturnType<typeof spyOn>

	beforeEach(() => {
		mockStorage = createMockStorage()
		notifier = new Notifier({ storage: mockStorage })
		logSpy = spyOn(console, 'log').mockImplementation(() => {})
		errorSpy = spyOn(console, 'error').mockImplementation(() => {})
	})

	afterEach(() => {
		logSpy.mockRestore()
		errorSpy.mockRestore()
	})

	it('logs to stdout', async () => {
		const notification: Notification = {
			type: 'task_completed',
			title: 'Task done',
			message: 'The task is complete',
			priority: 'normal',
		}
		await notifier.notify(notification)
		expect(logSpy).toHaveBeenCalledTimes(1)
		// Logger calls console.log(prefix, message, dataStr) — join all args
		const logged = (logSpy.mock.calls[0] as string[]).join(' ')
		expect(logged).toContain('[orchestrator]')
		expect(logged).toContain('Task done')
	})

	it('appends to activity feed via storage', async () => {
		const notification: Notification = {
			type: 'task_assigned',
			title: 'Assigned',
			message: 'Task assigned to dev',
			priority: 'normal',
			agentId: 'dev-agent',
		}
		await notifier.notify(notification)
		expect(mockStorage.activityCalls).toHaveLength(1)
		const entry = mockStorage.activityCalls[0]!
		expect(entry.type).toBe('notification:task_assigned')
		expect(entry.summary).toBe('Assigned')
		expect(entry.agent).toBe('dev-agent')
	})

	it('includes correct priority prefix (!! for urgent, ! for high)', async () => {
		await notifier.notify({
			type: 'alert',
			title: 'Urgent alert',
			message: 'Something urgent',
			priority: 'urgent',
		})
		const urgentLog = (logSpy.mock.calls[0] as string[]).join(' ')
		expect(urgentLog).toContain('!!')

		await notifier.notify({
			type: 'alert',
			title: 'High alert',
			message: 'Something high',
			priority: 'high',
		})
		const highLog = (logSpy.mock.calls[1] as string[]).join(' ')
		expect(highLog).toContain('!')
		// Make sure it's just one !, not !!
		expect(highLog).not.toContain('!!notification')

		await notifier.notify({
			type: 'alert',
			title: 'Normal alert',
			message: 'Something normal',
			priority: 'normal',
		})
		const normalLog = (logSpy.mock.calls[2] as string[]).join(' ')
		expect(normalLog).toMatch(/\[orchestrator\].*notification/)
	})

	it('includes taskId and agentId in details', async () => {
		await notifier.notify({
			type: 'blocker',
			title: 'Blocked',
			message: 'Task is blocked',
			priority: 'high',
			taskId: 'task-abc',
			agentId: 'agent-xyz',
		})
		expect(mockStorage.activityCalls).toHaveLength(1)
		const details = mockStorage.activityCalls[0]!.details as Record<string, unknown>
		expect(details.taskId).toBe('task-abc')
		expect(details.agentId).toBe('agent-xyz')
	})

	it('does not throw when storage.appendActivity fails', async () => {
		mockStorage.setShouldFail(true)
		await expect(
			notifier.notify({
				type: 'alert',
				title: 'Test',
				message: 'This should not throw',
				priority: 'normal',
			}),
		).resolves.toBeUndefined()
		expect(errorSpy).toHaveBeenCalledTimes(1)
	})
})
