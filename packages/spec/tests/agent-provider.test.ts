import { describe, test, expect } from 'bun:test'
import { ZodError } from 'zod'
import { AgentSchema, AGENT_PROVIDERS } from '../src/schemas'

const validAgent = {
	id: 'peter',
	name: 'Peter',
	role: 'developer',
	description: 'Writes code',
	fs_scope: { read: ['/projects'], write: ['/projects/*/code'] },
}

describe('AgentSchema provider field', () => {
	test('defaults to tanstack-ai when provider not specified', () => {
		const result = AgentSchema.parse(validAgent)
		expect(result.provider).toBe('tanstack-ai')
	})

	test('accepts tanstack-ai provider', () => {
		const result = AgentSchema.parse({ ...validAgent, provider: 'tanstack-ai' })
		expect(result.provider).toBe('tanstack-ai')
	})

	test('rejects invalid provider', () => {
		expect(() =>
			AgentSchema.parse({ ...validAgent, provider: 'gemini-sdk' }),
		).toThrow(ZodError)
	})

	test('AGENT_PROVIDERS constant has tanstack-ai', () => {
		expect(AGENT_PROVIDERS).toContain('tanstack-ai')
		expect(AGENT_PROVIDERS).toHaveLength(1)
	})

	test('defaults model to OpenRouter format', () => {
		const result = AgentSchema.parse(validAgent)
		expect(result.model).toBe('anthropic/claude-sonnet-4')
	})

	test('accepts OpenRouter model format', () => {
		const result = AgentSchema.parse({
			...validAgent,
			model: 'openai/gpt-4o',
		})
		expect(result.model).toBe('openai/gpt-4o')
	})

	test('accepts auto-router model', () => {
		const result = AgentSchema.parse({
			...validAgent,
			model: 'openrouter/auto',
		})
		expect(result.model).toBe('openrouter/auto')
	})

	test('web_search defaults to false', () => {
		const result = AgentSchema.parse(validAgent)
		expect(result.web_search).toBe(false)
	})

	test('web_search accepts true', () => {
		const result = AgentSchema.parse({ ...validAgent, web_search: true })
		expect(result.web_search).toBe(true)
	})

	test('web_search accepts false explicitly', () => {
		const result = AgentSchema.parse({ ...validAgent, web_search: false })
		expect(result.web_search).toBe(false)
	})
})
