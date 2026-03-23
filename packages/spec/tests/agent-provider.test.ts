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
	test('defaults to claude-agent-sdk when provider not specified', () => {
		const result = AgentSchema.parse(validAgent)
		expect(result.provider).toBe('claude-agent-sdk')
	})

	test('accepts claude-agent-sdk provider', () => {
		const result = AgentSchema.parse({ ...validAgent, provider: 'claude-agent-sdk' })
		expect(result.provider).toBe('claude-agent-sdk')
	})

	test('accepts codex-sdk provider', () => {
		const result = AgentSchema.parse({ ...validAgent, provider: 'codex-sdk' })
		expect(result.provider).toBe('codex-sdk')
	})

	test('rejects invalid provider', () => {
		expect(() =>
			AgentSchema.parse({ ...validAgent, provider: 'gemini-sdk' }),
		).toThrow(ZodError)
	})

	test('AGENT_PROVIDERS constant has both providers', () => {
		expect(AGENT_PROVIDERS).toContain('claude-agent-sdk')
		expect(AGENT_PROVIDERS).toContain('codex-sdk')
		expect(AGENT_PROVIDERS).toHaveLength(2)
	})

	test('accepts codex-sdk with GPT model', () => {
		const result = AgentSchema.parse({
			...validAgent,
			provider: 'codex-sdk',
			model: 'gpt-4o',
		})
		expect(result.provider).toBe('codex-sdk')
		expect(result.model).toBe('gpt-4o')
	})

	test('accepts codex-sdk with o4-mini model', () => {
		const result = AgentSchema.parse({
			...validAgent,
			provider: 'codex-sdk',
			model: 'o4-mini',
		})
		expect(result.provider).toBe('codex-sdk')
		expect(result.model).toBe('o4-mini')
	})
})
