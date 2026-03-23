import { describe, expect, it } from 'bun:test'
import { CompanySchema, CompanySettingsSchema } from './company'

describe('CompanySettingsSchema — embeddings', () => {
	it('defaults embeddings to undefined when not provided', () => {
		const result = CompanySettingsSchema.parse({})
		expect(result.embeddings).toBeUndefined()
	})

	it('parses embeddings with provider enum values', () => {
		const result = CompanySettingsSchema.parse({
			embeddings: {
				provider: 'gemini',
				fallback: 'nomic',
				dimensions: 1536,
			},
		})
		expect(result.embeddings).toEqual({
			provider: 'gemini',
			fallback: 'nomic',
			dimensions: 1536,
		})
	})

	it('defaults embeddings provider to "none" and dimensions to 768', () => {
		const result = CompanySettingsSchema.parse({
			embeddings: {},
		})
		expect(result.embeddings?.provider).toBe('none')
		expect(result.embeddings?.dimensions).toBe(768)
	})

	it('rejects invalid embedding provider', () => {
		expect(() =>
			CompanySettingsSchema.parse({
				embeddings: { provider: 'invalid-provider' },
			}),
		).toThrow()
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
					provider: 'gemini',
					dimensions: 1536,
				},
			},
		})
		expect(result.settings.embeddings?.provider).toBe('gemini')
		expect(result.settings.embeddings?.dimensions).toBe(1536)
	})
})
