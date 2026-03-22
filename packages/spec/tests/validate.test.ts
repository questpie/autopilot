import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { ZodError } from 'zod'
import { CompanySchema } from '../src/schemas'
import { loadAndValidate } from '../src/validate'

describe('loadAndValidate', () => {
	let tmpDir: string

	beforeAll(async () => {
		tmpDir = await mkdtemp(join(tmpdir(), 'spec-test-'))
	})

	afterAll(async () => {
		await rm(tmpDir, { recursive: true })
	})

	test('loads and validates valid YAML', async () => {
		const yamlContent = `
name: "QUESTPIE"
slug: "questpie"
description: "AI company"
owner:
  name: "Dominik"
  email: "d@questpie.com"
`
		const filePath = join(tmpDir, 'company.yaml')
		await writeFile(filePath, yamlContent)

		const result = await loadAndValidate(filePath, CompanySchema)
		expect(result.name).toBe('QUESTPIE')
		expect(result.slug).toBe('questpie')
		expect(result.settings.max_concurrent_agents).toBe(6)
	})

	test('throws ZodError for invalid YAML data', async () => {
		const yamlContent = `
name: "QUESTPIE"
slug: "has spaces not allowed"
description: "AI company"
owner:
  name: "Dominik"
  email: "not-an-email"
`
		const filePath = join(tmpDir, 'invalid.yaml')
		await writeFile(filePath, yamlContent)

		expect(loadAndValidate(filePath, CompanySchema)).rejects.toThrow(ZodError)
	})

	test('throws for missing file', async () => {
		expect(
			loadAndValidate(join(tmpDir, 'nonexistent.yaml'), CompanySchema),
		).rejects.toThrow()
	})
})
