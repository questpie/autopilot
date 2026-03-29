import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { join } from 'node:path'
import { Scheduler } from '../src/scheduler/scheduler'
import { createTestCompany } from './helpers'
import { writeYaml } from '../src/fs/yaml'

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

	test('start loads schedules and creates jobs', async () => {
		await writeYaml(join(companyRoot, 'team', 'schedules.yaml'), {
			schedules: [
				{
					id: 'daily-standup',
					agent: 'project-manager',
					cron: '0 9 * * *',
					description: 'Daily standup',
					enabled: true,
				},
				{
					id: 'weekly-review',
					agent: 'project-manager',
					cron: '0 17 * * 5',
					description: 'Weekly review',
					enabled: true,
				},
			],
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
		await writeYaml(join(companyRoot, 'team', 'schedules.yaml'), {
			schedules: [
				{
					id: 'test-job',
					agent: 'dev',
					cron: '* * * * *',
					enabled: true,
				},
			],
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
		await writeYaml(join(companyRoot, 'team', 'schedules.yaml'), {
			schedules: [
				{
					id: 'old-job',
					agent: 'dev',
					cron: '0 9 * * *',
					enabled: true,
				},
			],
		})

		const scheduler = new Scheduler({
			companyRoot,
			onTrigger: async () => {},
		})

		await scheduler.start()
		expect(scheduler.getActiveJobs()).toEqual(['old-job'])

		await writeYaml(join(companyRoot, 'team', 'schedules.yaml'), {
			schedules: [
				{
					id: 'new-job',
					agent: 'dev',
					cron: '0 10 * * *',
					enabled: true,
				},
			],
		})

		await scheduler.reload()
		expect(scheduler.getActiveJobs()).toEqual(['new-job'])

		scheduler.stop()
	})

	test('disabled schedules are skipped', async () => {
		await writeYaml(join(companyRoot, 'team', 'schedules.yaml'), {
			schedules: [
				{
					id: 'enabled-job',
					agent: 'dev',
					cron: '0 9 * * *',
					enabled: true,
				},
				{
					id: 'disabled-job',
					agent: 'dev',
					cron: '0 10 * * *',
					enabled: false,
				},
			],
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
		await writeYaml(join(companyRoot, 'team', 'schedules.yaml'), {
			schedules: [],
		})

		const scheduler = new Scheduler({
			companyRoot,
			onTrigger: async () => {},
		})

		await scheduler.start()
		expect(scheduler.getActiveJobs()).toHaveLength(0)

		scheduler.stop()
	})

	test('handles missing schedules.yaml gracefully', async () => {
		// No schedules.yaml written
		const scheduler = new Scheduler({
			companyRoot,
			onTrigger: async () => {},
		})

		await scheduler.start()
		expect(scheduler.getActiveJobs()).toHaveLength(0)
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
		await writeYaml(join(companyRoot, 'team', 'schedules.yaml'), {
			schedules: [
				{ id: 'dev-check', agent: 'developer', cron: '0 9 * * *', enabled: true },
				{ id: 'ops-check', agent: 'devops', cron: '0 10 * * *', enabled: true },
				{ id: 'ceo-review', agent: 'ceo', cron: '0 17 * * 5', enabled: true },
			],
		})

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
