import { describe, expect, test } from 'bun:test'
import { AgentSchema, ClaimedRunSchema, CreateRunRequestSchema } from '../src/schemas'

describe('runtime selection schema contract', () => {
	test('AgentSchema accepts model, provider, and variant', () => {
		const result = AgentSchema.parse({
			id: 'dev',
			name: 'Developer',
			role: 'developer',
			model: 'claude-sonnet-4',
			provider: 'anthropic',
			variant: 'extended-thinking',
		})

		expect(result.model).toBe('claude-sonnet-4')
		expect(result.provider).toBe('anthropic')
		expect(result.variant).toBe('extended-thinking')
	})

	test('AgentSchema treats model/provider/variant as optional', () => {
		const result = AgentSchema.parse({
			id: 'dev',
			name: 'Developer',
			role: 'developer',
		})

		expect(result.model).toBeUndefined()
		expect(result.provider).toBeUndefined()
		expect(result.variant).toBeUndefined()
	})

	test('ClaimedRunSchema accepts model/provider/variant', () => {
		const result = ClaimedRunSchema.parse({
			id: 'run-1',
			agent_id: 'dev',
			task_id: null,
			runtime: 'claude-code',
			status: 'claimed',
			model: 'claude-sonnet-4',
			provider: 'anthropic',
			variant: 'extended-thinking',
		})

		expect(result.model).toBe('claude-sonnet-4')
		expect(result.provider).toBe('anthropic')
		expect(result.variant).toBe('extended-thinking')
	})

	test('ClaimedRunSchema allows null model/provider/variant', () => {
		const result = ClaimedRunSchema.parse({
			id: 'run-1',
			agent_id: 'dev',
			task_id: null,
			runtime: 'claude-code',
			status: 'claimed',
			model: null,
			provider: null,
			variant: null,
		})

		expect(result.model).toBeNull()
		expect(result.provider).toBeNull()
		expect(result.variant).toBeNull()
	})

	test('ClaimedRunSchema works without model/provider/variant (backward compat)', () => {
		const result = ClaimedRunSchema.parse({
			id: 'run-1',
			agent_id: 'dev',
			task_id: null,
			runtime: 'claude-code',
			status: 'claimed',
		})

		expect(result.model).toBeUndefined()
		expect(result.provider).toBeUndefined()
		expect(result.variant).toBeUndefined()
	})

	test('CreateRunRequestSchema accepts model/provider/variant', () => {
		const result = CreateRunRequestSchema.parse({
			agent_id: 'dev',
			runtime: 'codex',
			model: 'gpt-4o',
			provider: 'openai',
			variant: 'fast',
		})

		expect(result.model).toBe('gpt-4o')
		expect(result.provider).toBe('openai')
		expect(result.variant).toBe('fast')
	})

	test('CreateRunRequestSchema works without model/provider/variant', () => {
		const result = CreateRunRequestSchema.parse({
			agent_id: 'dev',
		})

		expect(result.model).toBeUndefined()
		expect(result.provider).toBeUndefined()
		expect(result.variant).toBeUndefined()
		expect(result.runtime).toBe('claude-code') // default
	})
})
