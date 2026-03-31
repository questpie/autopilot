import { describe, test, expect } from 'bun:test'
import { tmpdir } from 'os'
import { join } from 'path'
import { writeFile, mkdir, rm } from 'fs/promises'
import { ZodError } from 'zod'
import { loadAndValidate } from '../src/validate'
import { CompanySchema, ScheduleSchema } from '../src/schemas'

const testDir = join(tmpdir(), 'autopilot-spec-test-' + Date.now())

describe('loadAndValidate', () => {
	test('loads and validates a valid YAML file', async () => {
		await mkdir(testDir, { recursive: true })
		const filePath = join(testDir, 'company.yaml')
		await writeFile(
			filePath,
			`name: QUESTPIE s.r.o.
slug: questpie
description: AI company
owner:
  name: Dominik
  email: d@questpie.com
`,
		)

		const result = await loadAndValidate(filePath, CompanySchema)
		expect(result.name).toBe('QUESTPIE s.r.o.')
		expect(result.slug).toBe('questpie')
		expect(result.owner.email).toBe('d@questpie.com')
		expect(result.timezone).toBe('UTC')

		await rm(testDir, { recursive: true, force: true })
	})

	test('applies defaults when loading YAML', async () => {
		await mkdir(testDir, { recursive: true })
		const filePath = join(testDir, 'schedule.yaml')
		await writeFile(
			filePath,
			`id: daily-check
agent: ops
cron: "0 9 * * *"
`,
		)

		const result = await loadAndValidate(filePath, ScheduleSchema)
		expect(result.id).toBe('daily-check')
		expect(result.enabled).toBe(true)
		expect(result.create_task).toBe(false)

		await rm(testDir, { recursive: true, force: true })
	})

	test('throws ZodError for invalid YAML data', async () => {
		await mkdir(testDir, { recursive: true })
		const filePath = join(testDir, 'invalid-company.yaml')
		await writeFile(
			filePath,
			`name: Test
slug: "has spaces"
description: test
owner:
  name: Test
  email: not-an-email
`,
		)

		await expect(loadAndValidate(filePath, CompanySchema)).rejects.toThrow(ZodError)

		await rm(testDir, { recursive: true, force: true })
	})

	test('throws error for non-existent file', async () => {
		await expect(
			loadAndValidate('/tmp/nonexistent-file-xyz.yaml', CompanySchema),
		).rejects.toThrow()
	})

	test('recovers gracefully when fields are missing (defaults apply)', async () => {
		await mkdir(testDir, { recursive: true })
		const filePath = join(testDir, 'missing-fields.yaml')
		await writeFile(
			filePath,
			`name: Test
`,
		)

		const result = await loadAndValidate(filePath, CompanySchema)
		expect(result.name).toBe('Test')
		expect(result.slug).toBe('my-company')

		await rm(testDir, { recursive: true, force: true })
	})
})
