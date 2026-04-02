import { describe, expect, test } from 'bun:test'
import { CompanySettingsSchema } from '../src/schemas'

describe('CompanySettingsSchema defaults', () => {
	test('applies current core defaults', () => {
		const result = CompanySettingsSchema.parse({})

		expect(result.auto_assign).toBe(true)
		expect(result.require_approval).toEqual(['merge', 'deploy'])
		expect(result.max_concurrent_agents).toBe(4)
		expect(result.default_runtime).toBe('claude-code')
		expect(result.default_task_assignee).toBeUndefined()
		expect(result.default_workflow).toBeUndefined()
		expect(result.budget.daily_token_limit).toBe(5_000_000)
		expect(result.budget.alert_at).toBe(80)
		expect(result.auth).toEqual({})
		expect(result.inference.gateway_base_url).toBe('https://ai-gateway.vercel.sh/v1')
		expect(result.inference.text_model).toBe('google/gemini-2.5-flash')
		expect(result.inference.embedding_model).toBe('google/gemini-embedding-2')
		expect(result.inference.embedding_dimensions).toBe(768)
	})

	test('accepts workflow-driven intake settings', () => {
		const result = CompanySettingsSchema.parse({
			default_task_assignee: 'ceo',
			default_workflow: 'development',
			default_runtime: 'claude-code',
		})

		expect(result.default_task_assignee).toBe('ceo')
		expect(result.default_workflow).toBe('development')
		expect(result.default_runtime).toBe('claude-code')
	})
})

describe('CompanySettingsSchema inference/auth', () => {
	test('accepts auth and inference overrides', () => {
		const result = CompanySettingsSchema.parse({
			auth: { cors_origin: 'http://localhost:3000' },
			inference: {
				gateway_base_url: 'https://example.test/v1',
				text_model: 'openai/gpt-4.1-mini',
				embedding_model: 'text-embedding-3-small',
				embedding_dimensions: 1536,
			},
		})

		expect(result.auth.cors_origin).toBe('http://localhost:3000')
		expect(result.inference.gateway_base_url).toBe('https://example.test/v1')
		expect(result.inference.text_model).toBe('openai/gpt-4.1-mini')
		expect(result.inference.embedding_model).toBe('text-embedding-3-small')
		expect(result.inference.embedding_dimensions).toBe(1536)
	})

	test('normalizes null values into defaults', () => {
		const result = CompanySettingsSchema.parse({
			default_runtime: null,
			auth: null,
			inference: null,
		})

		expect(result.default_runtime).toBe('claude-code')
		expect(result.auth).toEqual({})
		expect(result.inference.text_model).toBe('google/gemini-2.5-flash')
	})
})
