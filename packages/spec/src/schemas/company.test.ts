import { describe, expect, it } from 'bun:test'
import { CompanySchema, CompanySettingsSchema } from './company'

describe('CompanySettingsSchema — embeddings', () => {
	it('defaults embeddings to undefined when not provided', () => {
		const result = CompanySettingsSchema.parse({})
		expect(result.embeddings).toBeUndefined()
	})

	it('parses embeddings with custom dimensions', () => {
		const result = CompanySettingsSchema.parse({
			embeddings: {
				dimensions: 1536,
			},
		})
		expect(result.embeddings).toEqual({
			dimensions: 1536,
		})
	})

	it('defaults embeddings dimensions to 768', () => {
		const result = CompanySettingsSchema.parse({
			embeddings: {},
		})
		expect(result.embeddings?.dimensions).toBe(768)
	})

	it('accepts custom embedding model', () => {
		const result = CompanySettingsSchema.parse({
			embeddings: { model: 'nvidia/llama-nemotron-embed-vl-1b-v2:free' },
		})
		expect(result.embeddings?.model).toBe('nvidia/llama-nemotron-embed-vl-1b-v2:free')
	})
})

describe('CompanySchema — language fields', () => {
	const minimalCompany = {
		name: 'TestCo',
		slug: 'test-co',
		description: 'A test company',
		owner: { name: 'Test', email: 'test@test.com' },
	}

	it('defaults language to "en"', () => {
		const result = CompanySchema.parse(minimalCompany)
		expect(result.language).toBe('en')
	})

	it('defaults languages to ["en"]', () => {
		const result = CompanySchema.parse(minimalCompany)
		expect(result.languages).toEqual(['en'])
	})

	it('defaults timezone to "UTC"', () => {
		const result = CompanySchema.parse(minimalCompany)
		expect(result.timezone).toBe('UTC')
	})

	it('accepts custom language settings', () => {
		const result = CompanySchema.parse({
			...minimalCompany,
			language: 'sk',
			languages: ['sk', 'cs', 'en'],
			timezone: 'Europe/Bratislava',
		})
		expect(result.language).toBe('sk')
		expect(result.languages).toEqual(['sk', 'cs', 'en'])
		expect(result.timezone).toBe('Europe/Bratislava')
	})

	it('parses embeddings from settings', () => {
		const result = CompanySchema.parse({
			...minimalCompany,
			settings: {
				embeddings: {
					model: 'nvidia/llama-nemotron-embed-vl-1b-v2:free',
					dimensions: 1536,
				},
			},
		})
		expect(result.settings.embeddings?.model).toBe('nvidia/llama-nemotron-embed-vl-1b-v2:free')
		expect(result.settings.embeddings?.dimensions).toBe(1536)
	})
})
