import { describe, expect, test } from 'bun:test'
import { CompanySettingsSchema } from '../src/schemas'

describe('CompanySettingsSchema defaults', () => {
	test('agent_provider defaults to tanstack-ai', () => {
		const result = CompanySettingsSchema.parse({})
		expect(result.agent_provider).toBe('tanstack-ai')
	})

	test('agent_model defaults to anthropic/claude-sonnet-4', () => {
		const result = CompanySettingsSchema.parse({})
		expect(result.agent_model).toBe('anthropic/claude-sonnet-4')
	})

	test('accepts custom agent_provider', () => {
		const result = CompanySettingsSchema.parse({ agent_provider: 'custom-provider' })
		expect(result.agent_provider).toBe('custom-provider')
	})

	test('accepts custom agent_model', () => {
		const result = CompanySettingsSchema.parse({ agent_model: 'openai/gpt-4o' })
		expect(result.agent_model).toBe('openai/gpt-4o')
	})
})

describe('CompanySettingsSchema embeddings', () => {
	test('embeddings is optional (undefined when not provided)', () => {
		const result = CompanySettingsSchema.parse({})
		expect(result.embeddings).toBeUndefined()
	})

	test('embeddings model is optional', () => {
		const result = CompanySettingsSchema.parse({ embeddings: {} })
		expect(result.embeddings!.model).toBeUndefined()
	})

	test('embeddings dimensions defaults to 768', () => {
		const result = CompanySettingsSchema.parse({ embeddings: {} })
		expect(result.embeddings!.dimensions).toBe(768)
	})

	test('accepts custom embeddings model', () => {
		const result = CompanySettingsSchema.parse({
			embeddings: { model: 'nvidia/llama-nemotron-embed-vl-1b-v2:free' },
		})
		expect(result.embeddings!.model).toBe('nvidia/llama-nemotron-embed-vl-1b-v2:free')
	})

	test('accepts custom embeddings dimensions', () => {
		const result = CompanySettingsSchema.parse({
			embeddings: { dimensions: 1536 },
		})
		expect(result.embeddings!.dimensions).toBe(1536)
	})
})

describe('CompanySettingsSchema ai_provider', () => {
	test('ai_provider is optional', () => {
		const result = CompanySettingsSchema.parse({})
		expect(result.ai_provider).toBeUndefined()
	})

	test('accepts ai_provider secret_ref config', () => {
		const result = CompanySettingsSchema.parse({
			ai_provider: {
				provider: 'openrouter',
				secret_ref: 'provider-openrouter',
				default_model: 'anthropic/claude-sonnet-4',
			},
		})

		expect(result.ai_provider?.provider).toBe('openrouter')
		expect(result.ai_provider?.secret_ref).toBe('provider-openrouter')
		expect(result.ai_provider?.default_model).toBe('anthropic/claude-sonnet-4')
	})
})

describe('CompanySettingsSchema embeddings provider enum removed', () => {
	// The embeddings config has no provider enum — it only has model (string) and dimensions (number).
	// Verify there is no provider field that would accept legacy values.
	test('embeddings has no provider field', () => {
		const result = CompanySettingsSchema.parse({
			embeddings: { provider: 'gemini' },
		})
		// provider is not in the schema, so it should be stripped by Zod
		expect((result.embeddings as Record<string, unknown>).provider).toBeUndefined()
	})

	test('embeddings has no provider accepting none', () => {
		const result = CompanySettingsSchema.parse({
			embeddings: { provider: 'none' },
		})
		expect((result.embeddings as Record<string, unknown>).provider).toBeUndefined()
	})

	test('embeddings has no provider accepting multilingual-e5', () => {
		const result = CompanySettingsSchema.parse({
			embeddings: { provider: 'multilingual-e5' },
		})
		expect((result.embeddings as Record<string, unknown>).provider).toBeUndefined()
	})
})
