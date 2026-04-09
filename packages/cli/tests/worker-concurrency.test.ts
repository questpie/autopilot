import { beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { resolveWorkerConcurrency, DEFAULT_LOCAL_WORKER_CONCURRENCY } from '../src/utils/worker-concurrency'

describe('resolveWorkerConcurrency', () => {
	let companyRoot: string

	beforeEach(async () => {
		companyRoot = await mkdtemp(join(tmpdir(), 'autopilot-worker-concurrency-'))
		await mkdir(join(companyRoot, '.autopilot'), { recursive: true })
	})

	test('uses company.yaml settings.max_concurrent_agents when no CLI override is provided', async () => {
		await writeFile(
			join(companyRoot, '.autopilot', 'company.yaml'),
			[
				'name: Test',
				'slug: test',
				'settings:',
				'  max_concurrent_agents: 10',
				'defaults:',
				'  runtime: claude-code',
			].join('\n'),
		)

		const concurrency = await resolveWorkerConcurrency(companyRoot)
		expect(concurrency).toBe(10)
	})

	test('falls back to default when company.yaml omits the setting', async () => {
		await writeFile(
			join(companyRoot, '.autopilot', 'company.yaml'),
			[
				'name: Test',
				'slug: test',
				'defaults:',
				'  runtime: claude-code',
			].join('\n'),
		)

		const concurrency = await resolveWorkerConcurrency(companyRoot)
		expect(concurrency).toBe(DEFAULT_LOCAL_WORKER_CONCURRENCY)
	})

	test('CLI override wins over company.yaml', async () => {
		await writeFile(
			join(companyRoot, '.autopilot', 'company.yaml'),
			[
				'name: Test',
				'slug: test',
				'settings:',
				'  max_concurrent_agents: 10',
			].join('\n'),
		)

		const concurrency = await resolveWorkerConcurrency(companyRoot, '3')
		expect(concurrency).toBe(3)
	})

	test('rejects invalid CLI override', async () => {
		await writeFile(join(companyRoot, '.autopilot', 'company.yaml'), 'name: Test\nslug: test\n')
		await expect(resolveWorkerConcurrency(companyRoot, '0')).rejects.toThrow('Invalid concurrency value')
	})
})
