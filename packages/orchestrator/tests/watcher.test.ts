import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { join } from 'node:path'
import { mkdir } from 'node:fs/promises'
import { Watcher, parseWatchEvent } from '../src/watcher/watcher'
import type { WatchEvent } from '../src/watcher/watcher'
import { createTestCompany } from './helpers'
import { writeYaml } from '../src/fs/yaml'

describe('parseWatchEvent', () => {
	test('parses task file path', () => {
		const event = parseWatchEvent('/company', '/company/tasks/active/TASK-001.yaml')
		expect(event).toEqual({
			type: 'task_changed',
			taskId: 'TASK-001',
			path: '/company/tasks/active/TASK-001.yaml',
		})
	})

	test('parses task in different status dirs', () => {
		const backlog = parseWatchEvent('/company', '/company/tasks/backlog/TASK-002.yaml')
		expect(backlog?.type).toBe('task_changed')
		expect(backlog?.type === 'task_changed' && backlog.taskId).toBe('TASK-002')

		const done = parseWatchEvent('/company', '/company/tasks/done/TASK-003.yaml')
		expect(done?.type).toBe('task_changed')
	})

	test('parses comms channel message path', () => {
		const event = parseWatchEvent('/company', '/company/comms/channels/general/msg-001.yaml')
		expect(event).toEqual({
			type: 'message_received',
			channel: 'general',
			path: '/company/comms/channels/general/msg-001.yaml',
		})
	})

	test('parses pin path', () => {
		const event = parseWatchEvent('/company', '/company/dashboard/pins/pin-001.yaml')
		expect(event).toEqual({
			type: 'pin_changed',
			pinId: 'pin-001',
			path: '/company/dashboard/pins/pin-001.yaml',
		})
	})

	test('parses team config path', () => {
		const event = parseWatchEvent('/company', '/company/team/agents.yaml')
		expect(event).toEqual({
			type: 'config_changed',
			file: 'agents.yaml',
			path: '/company/team/agents.yaml',
		})
	})

	test('parses nested team config path', () => {
		const event = parseWatchEvent('/company', '/company/team/workflows/deploy.yaml')
		expect(event).toEqual({
			type: 'config_changed',
			file: 'workflows/deploy.yaml',
			path: '/company/team/workflows/deploy.yaml',
		})
	})

	test('returns null for unknown paths', () => {
		const event = parseWatchEvent('/company', '/company/random/unknown-file.txt')
		expect(event).toBeNull()
	})

	test('returns null for non-yaml files', () => {
		const event = parseWatchEvent('/company', '/company/tasks/active/notes.txt')
		expect(event).toBeNull()
	})
})

describe('Watcher', () => {
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

	test('triggers task_changed when file is created in tasks/', async () => {
		const events: WatchEvent[] = []

		const watcher = new Watcher({
			companyRoot,
			onEvent: async (event) => {
				events.push(event)
			},
			debounceMs: 100,
		})

		await watcher.start()

		// Wait for watcher to be ready
		await new Promise((r) => setTimeout(r, 300))

		// Write a task file
		await writeYaml(join(companyRoot, 'tasks', 'active', 'TASK-100.yaml'), {
			id: 'TASK-100',
			title: 'Test task',
			status: 'active',
		})

		// Wait for debounce + processing
		await new Promise((r) => setTimeout(r, 1000))

		await watcher.stop()

		expect(events.length).toBeGreaterThanOrEqual(1)
		const taskEvent = events.find((e) => e.type === 'task_changed')
		expect(taskEvent).toBeDefined()
		if (taskEvent?.type === 'task_changed') {
			expect(taskEvent.taskId).toBe('TASK-100')
		}
	})

	test('triggers message_received when file is created in comms/', async () => {
		const events: WatchEvent[] = []

		const watcher = new Watcher({
			companyRoot,
			onEvent: async (event) => {
				events.push(event)
			},
			debounceMs: 100,
		})

		await watcher.start()
		await new Promise((r) => setTimeout(r, 300))

		await writeYaml(join(companyRoot, 'comms', 'channels', 'general', 'msg-001.yaml'), {
			id: 'msg-001',
			from: 'dev',
			content: 'Hello',
		})

		await new Promise((r) => setTimeout(r, 1000))
		await watcher.stop()

		expect(events.length).toBeGreaterThanOrEqual(1)
		const msgEvent = events.find((e) => e.type === 'message_received')
		expect(msgEvent).toBeDefined()
		if (msgEvent?.type === 'message_received') {
			expect(msgEvent.channel).toBe('general')
		}
	})

	test('stop closes watcher cleanly', async () => {
		const watcher = new Watcher({
			companyRoot,
			onEvent: async () => {},
			debounceMs: 100,
		})

		await watcher.start()
		await watcher.stop()

		// Should not throw when stopping again
		await watcher.stop()
	})
})
