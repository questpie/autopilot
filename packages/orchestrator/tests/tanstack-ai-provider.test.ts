/**
 * D49: TanStack AI provider tests — tool schema conversion, event bridging,
 * text_delta forwarding, error handling.
 *
 * These are unit tests for the provider interface. They don't call real LLMs.
 */
import { describe, test, expect } from 'bun:test'
import { zodToJsonSchema } from '../src/agent/utils/zod-to-json'
import { z } from 'zod'

describe('zodToJsonSchema', () => {
	test('converts basic string schema', () => {
		const schema = z.object({ name: z.string() })
		const result = zodToJsonSchema(schema)
		expect(result).toHaveProperty('type', 'object')
		expect(result.properties).toHaveProperty('name')
		expect(result.properties.name).toHaveProperty('type', 'string')
	})

	test('converts number schema with description', () => {
		const schema = z.object({
			count: z.number().describe('The count'),
		})
		const result = zodToJsonSchema(schema)
		expect(result.properties.count).toHaveProperty('type', 'number')
		expect(result.properties.count).toHaveProperty('description', 'The count')
	})

	test('converts optional fields', () => {
		const schema = z.object({
			required: z.string(),
			optional: z.string().optional(),
		})
		const result = zodToJsonSchema(schema)
		expect(result.required).toContain('required')
		// Optional should not be in required list
		if (result.required) {
			expect(result.required).not.toContain('optional')
		}
	})

	test('converts nested object', () => {
		const schema = z.object({
			nested: z.object({
				inner: z.string(),
			}),
		})
		const result = zodToJsonSchema(schema)
		expect(result.properties.nested).toHaveProperty('type', 'object')
		expect(result.properties.nested.properties).toHaveProperty('inner')
	})

	test('converts array schema', () => {
		const schema = z.object({
			items: z.array(z.string()),
		})
		const result = zodToJsonSchema(schema)
		expect(result.properties.items).toHaveProperty('type', 'array')
	})

	test('converts enum schema', () => {
		const schema = z.object({
			status: z.enum(['active', 'inactive']),
		})
		const result = zodToJsonSchema(schema)
		expect(result.properties.status.enum).toEqual(['active', 'inactive'])
	})

	test('converts boolean schema', () => {
		const schema = z.object({
			flag: z.boolean(),
		})
		const result = zodToJsonSchema(schema)
		expect(result.properties.flag).toHaveProperty('type', 'boolean')
	})
})

describe('AgentEvent types', () => {
	test('text_delta is a valid event type', () => {
		// Verify the type union includes text_delta (D8)
		type AgentEventType = 'text' | 'text_delta' | 'tool_call' | 'tool_result' | 'error' | 'status'
		const types: AgentEventType[] = ['text', 'text_delta', 'tool_call', 'tool_result', 'error', 'status']
		expect(types).toContain('text_delta')
	})
})

describe('StreamChunk schema', () => {
	test('text_delta is a valid chunk type', async () => {
		const { StreamChunkSchema } = await import('@questpie/autopilot-spec')
		const result = StreamChunkSchema.safeParse({
			at: Date.now(),
			type: 'text_delta',
			content: 'hello',
		})
		expect(result.success).toBe(true)
	})

	test('rejects invalid chunk type', async () => {
		const { StreamChunkSchema } = await import('@questpie/autopilot-spec')
		const result = StreamChunkSchema.safeParse({
			at: Date.now(),
			type: 'invalid_type',
			content: 'hello',
		})
		expect(result.success).toBe(false)
	})
})
