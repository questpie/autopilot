import { describe, expect, test } from 'bun:test'
import { ZodError } from 'zod'
import { AgentSchema } from '../src/schemas'

const validAgent = {
	id: 'peter',
	name: 'Peter',
	role: 'developer',
	description: 'Writes code',
	fs_scope: { read: ['/projects'], write: ['/projects/app'] },
}

describe('AgentSchema current runtime-independent shape', () => {
	test('accepts a minimal valid agent', () => {
		const result = AgentSchema.parse(validAgent)

		expect(result.id).toBe('peter')
		expect(result.name).toBe('Peter')
		expect(result.role).toBe('developer')
		expect(result.description).toBe('Writes code')
		expect(result.fs_scope).toEqual({
			read: ['/projects'],
			write: ['/projects/app'],
		})
		expect(result.triggers).toEqual([])
	})

	test('accepts optional model and triggers', () => {
		const result = AgentSchema.parse({
			...validAgent,
			model: 'claude-sonnet-4-20250514',
			triggers: [{ on: 'task_status_changed', status: 'review' }],
		})

		expect(result.model).toBe('claude-sonnet-4-20250514')
		expect(result.triggers).toEqual([{ on: 'task_status_changed', status: 'review' }])
	})

	test('rejects invalid ids', () => {
		expect(() => AgentSchema.parse({ ...validAgent, id: 'Peter Parker' })).toThrow(ZodError)
		expect(() => AgentSchema.parse({ ...validAgent, id: 'Peter' })).toThrow(ZodError)
	})

	test('strips legacy provider-style fields', () => {
		const result = AgentSchema.parse({
			...validAgent,
			provider: 'tanstack-ai',
			web_search: true,
		})

		expect((result as Record<string, unknown>).provider).toBeUndefined()
		expect((result as Record<string, unknown>).web_search).toBeUndefined()
	})
})
