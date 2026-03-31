import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { writeYaml } from '../src/fs/yaml'
import { Scheduler } from '../src/scheduler/scheduler'
import { createTestCompany } from './helpers'

describe('Scheduler', () => {
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

	async function writeSchedule(id: string, data: Record<string, unknown>) {
		const dir = join(companyRoot, 'team', 'schedules')
		await mkdir(dir, { recursive: true })
		await writeYaml(join(dir, `${id}.yaml`), { id, ...data })
	}

	test('start loads schedules and creates jobs', async () => {
		await writeSchedule('daily-standup', {
			agent: 'project-manager',
			cron: '0 9 * * *',
			description: 'Daily standup',
			enabled: true,
		})
		await writeSchedule('weekly-review', {
			agent: 'project-manager',
			cron: '0 17 * * 5',
			description: 'Weekly review',
			enabled: true,
		})

		const triggered: string[] = []
		const scheduler = new Scheduler({
			companyRoot,
			onTrigger: async (schedule) => {
				triggered.push(schedule.id)
			},
		})

		await scheduler.start()

		const jobs = scheduler.getActiveJobs()
		expect(jobs).toContain('daily-standup')
		expect(jobs).toContain('weekly-review')
		expect(jobs).toHaveLength(2)

		scheduler.stop()
	})

	test('stop clears all jobs', async () => {
		await writeSchedule('test-job', {
			agent: 'dev',
			cron: '* * * * *',
			enabled: true,
		})

		const scheduler = new Scheduler({
			companyRoot,
			onTrigger: async () => {},
		})

		await scheduler.start()
		expect(scheduler.getActiveJobs()).toHaveLength(1)

		scheduler.stop()
		expect(scheduler.getActiveJobs()).toHaveLength(0)
	})

	test('reload clears old jobs and loads new ones', async () => {
		await writeSchedule('old-job', {
			agent: 'dev',
			cron: '0 9 * * *',
			enabled: true,
		})

		const scheduler = new Scheduler({
			companyRoot,
			onTrigger: async () => {},
		})

		await scheduler.start()
		expect(scheduler.getActiveJobs()).toEqual(['old-job'])

		// Remove old and add new
		const { rm } = await import('node:fs/promises')
		await rm(join(companyRoot, 'team', 'schedules', 'old-job.yaml'))
		await writeSchedule('new-job', {
			agent: 'dev',
			cron: '0 10 * * *',
			enabled: true,
		})

		await scheduler.reload()
		expect(scheduler.getActiveJobs()).toEqual(['new-job'])

		scheduler.stop()
	})

	test('disabled schedules are skipped', async () => {
		await writeSchedule('enabled-job', {
			agent: 'dev',
			cron: '0 9 * * *',
			enabled: true,
		})
		await writeSchedule('disabled-job', {
			agent: 'dev',
			cron: '0 10 * * *',
			enabled: false,
		})

		const scheduler = new Scheduler({
			companyRoot,
			onTrigger: async () => {},
		})

		await scheduler.start()
		expect(scheduler.getActiveJobs()).toEqual(['enabled-job'])

		scheduler.stop()
	})

	test('getActiveJobs returns empty array when no schedules', async () => {
		// Create empty schedules directory
		await mkdir(join(companyRoot, 'team', 'schedules'), { recursive: true })

		const scheduler = new Scheduler({
			companyRoot,
			onTrigger: async () => {},
		})

		await scheduler.start()
		expect(scheduler.getActiveJobs()).toHaveLength(0)

		scheduler.stop()
	})

	test('handles missing schedules directory gracefully', async () => {
		// No schedules directory created
		const scheduler = new Scheduler({
			companyRoot,
			onTrigger: async () => {},
		})

		await scheduler.start()
		expect(scheduler.getActiveJobs()).toHaveLength(0)
		scheduler.stop()
	})

	test('loads schedules from .yml files', async () => {
		const dir = join(companyRoot, 'team', 'schedules')
		await mkdir(dir, { recursive: true })
		await writeYaml(join(dir, 'health-check.yml'), {
			id: 'health-check',
			agent: 'ops',
			cron: '*/5 * * * *',
			enabled: true,
		})

		const scheduler = new Scheduler({
			companyRoot,
			onTrigger: async () => {},
		})

		await scheduler.start()
		expect(scheduler.getActiveJobs()).toContain('health-check')
		scheduler.stop()
	})

	test('stop is idempotent', async () => {
		const scheduler = new Scheduler({
			companyRoot,
			onTrigger: async () => {},
		})
		await scheduler.start()
		scheduler.stop()
		scheduler.stop() // second stop — no throw
		expect(scheduler.getActiveJobs()).toHaveLength(0)
	})

	test('multiple enabled schedules for different agents', async () => {
		await writeSchedule('dev-check', { agent: 'developer', cron: '0 9 * * *', enabled: true })
		await writeSchedule('ops-check', { agent: 'devops', cron: '0 10 * * *', enabled: true })
		await writeSchedule('ceo-review', { agent: 'ceo', cron: '0 17 * * 5', enabled: true })

		const scheduler = new Scheduler({
			companyRoot,
			onTrigger: async () => {},
		})

		await scheduler.start()
		const jobs = scheduler.getActiveJobs()
		expect(jobs).toHaveLength(3)
		expect(jobs).toContain('dev-check')
		expect(jobs).toContain('ops-check')
		expect(jobs).toContain('ceo-review')
		scheduler.stop()
	})
})
