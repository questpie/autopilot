import { test, expect, describe } from 'bun:test'
import { writeFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { resolveSecretRefs, validateSecretRefs } from '../src/secrets'

describe('SecretRef resolution', () => {
	test('source:env resolves from process.env', () => {
		process.env.__TEST_SECRET_ABC = 'hello-secret'
		const { resolved, errors } = resolveSecretRefs([
			{ name: 'test-env', source: 'env', key: '__TEST_SECRET_ABC' },
		])
		expect(errors).toEqual([])
		expect(resolved.get('test-env')).toBe('hello-secret')
		delete process.env.__TEST_SECRET_ABC
	})

	test('source:env with missing variable returns error', () => {
		delete process.env.__MISSING_SECRET
		const { resolved, errors } = resolveSecretRefs([
			{ name: 'missing', source: 'env', key: '__MISSING_SECRET' },
		])
		expect(errors.length).toBe(1)
		expect(errors[0]).toContain('__MISSING_SECRET')
		expect(errors[0]).toContain('not set')
		expect(resolved.has('missing')).toBe(false)
	})

	test('source:file reads file content', () => {
		const path = join(tmpdir(), `secret-test-${Date.now()}.txt`)
		writeFileSync(path, 'file-secret-value\n')
		const { resolved, errors } = resolveSecretRefs([
			{ name: 'test-file', source: 'file', key: path },
		])
		expect(errors).toEqual([])
		expect(resolved.get('test-file')).toBe('file-secret-value')
		unlinkSync(path)
	})

	test('source:file with missing file returns error', () => {
		const { errors } = resolveSecretRefs([
			{ name: 'bad-file', source: 'file', key: '/nonexistent/path/secret.txt' },
		])
		expect(errors.length).toBe(1)
		expect(errors[0]).toContain('bad-file')
	})

	test('source:exec runs command and captures stdout', () => {
		const { resolved, errors } = resolveSecretRefs([
			{ name: 'test-exec', source: 'exec', key: 'echo exec-secret' },
		])
		expect(errors).toEqual([])
		expect(resolved.get('test-exec')).toBe('exec-secret')
	})

	test('source:exec with failing command returns error', () => {
		const { errors } = resolveSecretRefs([
			{ name: 'bad-exec', source: 'exec', key: 'exit 1' },
		])
		expect(errors.length).toBe(1)
		expect(errors[0]).toContain('bad-exec')
		expect(errors[0]).toContain('failed')
	})

	test('validateSecretRefs returns error list for unresolvable refs', () => {
		delete process.env.__VALIDATE_MISSING
		const errors = validateSecretRefs([
			{ name: 'ok', source: 'exec', key: 'echo ok' },
			{ name: 'bad', source: 'env', key: '__VALIDATE_MISSING' },
		])
		expect(errors.length).toBe(1)
		expect(errors[0]).toContain('bad')
	})

	test('multiple refs resolve independently', () => {
		process.env.__MULTI_A = 'a-val'
		process.env.__MULTI_B = 'b-val'
		const { resolved, errors } = resolveSecretRefs([
			{ name: 'a', source: 'env', key: '__MULTI_A' },
			{ name: 'b', source: 'env', key: '__MULTI_B' },
		])
		expect(errors).toEqual([])
		expect(resolved.get('a')).toBe('a-val')
		expect(resolved.get('b')).toBe('b-val')
		delete process.env.__MULTI_A
		delete process.env.__MULTI_B
	})
})
