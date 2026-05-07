/**
 * Redaction utility tests.
 */
import { describe, expect, test } from 'bun:test'
import { redactArgs } from '../src/redact'

describe('redactArgs', () => {
	test('redacts secret-shaped keys at top level', () => {
		const out = redactArgs({
			id: 'task-1',
			api_key: 'sk-secret-123',
			password: 'hunter2',
			secret: 'shh',
			token: 'tok-1',
			authorization: 'Bearer xxx',
		}) as Record<string, unknown>
		expect(out.id).toBe('task-1')
		expect(out.api_key).toBe('<redacted>')
		expect(out.password).toBe('<redacted>')
		expect(out.secret).toBe('<redacted>')
		expect(out.token).toBe('<redacted>')
		expect(out.authorization).toBe('<redacted>')
	})

	test('redacts secret-shaped keys nested one level deep', () => {
		const out = redactArgs({
			meta: {
				api_key: 'sk-nested',
				note: 'visible',
			},
		}) as Record<string, Record<string, unknown>>
		expect(out.meta!.api_key).toBe('<redacted>')
		expect(out.meta!.note).toBe('visible')
	})

	test('truncates long strings', () => {
		// Use spaces between characters so the value does NOT match the base64 regex.
		const chunk = 'lorem ipsum dolor sit amet, '
		const long = chunk.repeat(40) // > 500 chars, mixed with spaces/comma so not base64
		const out = redactArgs({ description: long }) as { description: string }
		expect(out.description.length).toBeLessThan(long.length)
		expect(out.description.startsWith(long.slice(0, 500))).toBe(true)
		expect(out.description).toContain(`truncated ${long.length - 500} bytes`)
	})

	test('detects base64-shaped strings', () => {
		const blob = 'A'.repeat(600)
		const out = redactArgs({ payload: blob }) as { payload: string }
		expect(out.payload).toContain('<base64 redacted')
		expect(out.payload).toContain('600 bytes')
	})

	test('passes plain values through unchanged', () => {
		const out = redactArgs({
			id: 'task-1',
			count: 42,
			enabled: true,
			missing: null,
			tags: ['a', 'b'],
		})
		expect(out).toEqual({
			id: 'task-1',
			count: 42,
			enabled: true,
			missing: null,
			tags: ['a', 'b'],
		})
	})

	test('does not throw on weird inputs', () => {
		expect(() => redactArgs(null)).not.toThrow()
		expect(() => redactArgs(undefined)).not.toThrow()
		expect(() => redactArgs(42)).not.toThrow()
		expect(() => redactArgs('hello')).not.toThrow()
	})

	test('handles api-key, api_key, apikey, bearer key variants', () => {
		const out = redactArgs({
			'api-key': 'a',
			apikey: 'b',
			bearer: 'c',
			credential: 'd',
		}) as Record<string, unknown>
		expect(out['api-key']).toBe('<redacted>')
		expect(out.apikey).toBe('<redacted>')
		expect(out.bearer).toBe('<redacted>')
		expect(out.credential).toBe('<redacted>')
	})
})
