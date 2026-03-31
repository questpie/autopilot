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

describe('CompanySchema — null resilience', () => {
	it('recovers when all nullable fields are set to null', () => {
		const result = CompanySchema.parse({
			name: null,
			slug: null,
			description: null,
			languages: null,
			owner: null,
			settings: null,
		})
		expect(result.name).toBe('My Company')
		expect(result.slug).toBe('my-company')
		expect(result.languages).toEqual(['en'])
		expect(result.owner.name).toBe('Unknown')
		expect(result.settings.auto_assign).toBe(true)
	})

	it('recovers when nested settings fields are null', () => {
		const result = CompanySettingsSchema.parse({
			auto_assign: null,
			require_approval: null,
			max_concurrent_agents: null,
			budget: null,
			auth: null,
		})
		expect(result.auto_assign).toBe(true)
		expect(result.require_approval).toEqual(['merge', 'deploy', 'spend', 'publish'])
		expect(result.max_concurrent_agents).toBe(6)
		expect(result.budget.daily_token_limit).toBe(5_000_000)
		expect(result.auth.trusted_proxies).toEqual(['127.0.0.1', '::1', '::ffff:127.0.0.1'])
	})

	it('parses a completely empty object', () => {
		const result = CompanySchema.parse({})
		expect(result.name).toBe('My Company')
		expect(result.owner.email).toBe('owner@example.com')
	})
})
