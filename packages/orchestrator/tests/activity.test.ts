import { describe, it, expect, afterEach } from 'bun:test'
import { appendActivity, readActivity } from '../src/fs/activity'
import { createTestCompany } from './helpers'

describe('activity', () => {
	let cleanup: () => Promise<void>
	let root: string

	afterEach(async () => {
		if (cleanup) await cleanup()
	})

	it('should append an activity entry', async () => {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup

		const entry = await appendActivity(root, {
			agent: 'developer',
			type: 'task_started',
			summary: 'Started working on task-123',
		})

		expect(entry.at).toBeDefined()
		expect(entry.agent).toBe('developer')
		expect(entry.type).toBe('task_started')
	})

	it('should read activity entries', async () => {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup

		const timestamp = new Date().toISOString()

		await appendActivity(root, {
			agent: 'developer',
			type: 'task_started',
			summary: 'First',
			at: timestamp,
		})
		await appendActivity(root, {
			agent: 'reviewer',
			type: 'review_started',
			summary: 'Second',
			at: timestamp,
		})

		const entries = await readActivity(root)
		expect(entries).toHaveLength(2)
		expect(entries[0]?.summary).toBe('First')
		expect(entries[1]?.summary).toBe('Second')
	})

	it('should filter by agent', async () => {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup

		await appendActivity(root, {
			agent: 'developer',
			type: 'task_started',
			summary: 'Dev entry',
		})
		await appendActivity(root, {
			agent: 'reviewer',
			type: 'review_started',
			summary: 'Review entry',
		})

		const devEntries = await readActivity(root, { agent: 'developer' })
		expect(devEntries).toHaveLength(1)
		expect(devEntries[0]?.agent).toBe('developer')
	})

	it('should filter by type', async () => {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup

		await appendActivity(root, {
			agent: 'dev',
			type: 'task_started',
			summary: 'Started',
		})
		await appendActivity(root, {
			agent: 'dev',
			type: 'task_completed',
			summary: 'Completed',
		})

		const completed = await readActivity(root, { type: 'task_completed' })
		expect(completed).toHaveLength(1)
		expect(completed[0]?.summary).toBe('Completed')
	})

	it('should limit results', async () => {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup

		for (let i = 0; i < 5; i++) {
			await appendActivity(root, {
				agent: 'dev',
				type: 'work',
				summary: `Entry ${i}`,
			})
		}

		const limited = await readActivity(root, { limit: 2 })
		expect(limited).toHaveLength(2)
		expect(limited[0]?.summary).toBe('Entry 3')
		expect(limited[1]?.summary).toBe('Entry 4')
	})

	it('should return empty for non-existent date', async () => {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup

		const entries = await readActivity(root, { date: '2020-01-01' })
		expect(entries).toEqual([])
	})

	it('should store details', async () => {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup

		await appendActivity(root, {
			agent: 'devops',
			type: 'deploy',
			summary: 'Deployed v1.0',
			details: { version: '1.0', env: 'production' },
		})

		const entries = await readActivity(root)
		expect(entries[0]?.details).toEqual({ version: '1.0', env: 'production' })
	})
})
