import { describe, expect, test } from 'bun:test'
import { ZodError } from 'zod'
import { ScriptInputSchema, ScriptOutputSchema, StandaloneScriptSchema } from '../src/schemas'

describe('StandaloneScriptSchema', () => {
	test('parses minimal valid script (id + name + entry_point)', () => {
		const result = StandaloneScriptSchema.parse({
			id: 'my-script',
			name: 'My Script',
			entry_point: 'scripts/run.ts',
		})

		expect(result.id).toBe('my-script')
		expect(result.name).toBe('My Script')
		expect(result.entry_point).toBe('scripts/run.ts')
		expect(result.description).toBe('')
		expect(result.runner).toBe('exec')
		expect(result.inputs).toEqual([])
		expect(result.outputs).toEqual([])
		expect(result.tags).toEqual([])
	})

	test('parses full script with all fields populated', () => {
		const result = StandaloneScriptSchema.parse({
			id: 'full-script',
			name: 'Full Script',
			description: 'A fully populated script',
			entry_point: 'scripts/full.ts',
			runner: 'bun',
			inputs: [
				{
					name: 'repo_url',
					description: 'The repo',
					type: 'string',
					required: true,
					default: 'https://github.com',
				},
			],
			outputs: [{ name: 'result', description: 'Output JSON', type: 'json' }],
			sandbox: {
				fs_scope: { read: ['.'], write: ['./out'] },
				network: 'local',
				timeout_ms: 60_000,
				max_memory_mb: 512,
			},
			env: { NODE_ENV: 'production' },
			secret_env: { API_KEY: 'my-api-key-ref' },
			tags: ['deploy', 'ci'],
		})

		expect(result.id).toBe('full-script')
		expect(result.runner).toBe('bun')
		expect(result.inputs).toHaveLength(1)
		expect(result.inputs[0]!.name).toBe('repo_url')
		expect(result.inputs[0]!.required).toBe(true)
		expect(result.outputs).toHaveLength(1)
		expect(result.outputs[0]!.type).toBe('json')
		expect(result.sandbox.network).toBe('local')
		expect(result.sandbox.timeout_ms).toBe(60_000)
		expect(result.sandbox.max_memory_mb).toBe(512)
		expect(result.env).toEqual({ NODE_ENV: 'production' })
		expect(result.secret_env).toEqual({ API_KEY: 'my-api-key-ref' })
		expect(result.tags).toEqual(['deploy', 'ci'])
	})

	test('rejects invalid id format (uppercase or special chars)', () => {
		expect(() =>
			StandaloneScriptSchema.parse({
				id: 'MyScript',
				name: 'Bad ID',
				entry_point: 'scripts/run.ts',
			}),
		).toThrow(ZodError)

		expect(() =>
			StandaloneScriptSchema.parse({
				id: 'my_script!',
				name: 'Bad ID',
				entry_point: 'scripts/run.ts',
			}),
		).toThrow(ZodError)
	})

	test('applies sandbox defaults correctly', () => {
		const result = StandaloneScriptSchema.parse({
			id: 'defaults-test',
			name: 'Defaults',
			entry_point: 'scripts/run.ts',
		})

		expect(result.sandbox.network).toBe('unrestricted')
		expect(result.sandbox.timeout_ms).toBe(300_000)
		expect(result.sandbox.fs_scope.read).toEqual(['.'])
		expect(result.sandbox.fs_scope.write).toEqual([])
		expect(result.sandbox.max_memory_mb).toBeUndefined()
	})

	test('rejects empty name', () => {
		expect(() =>
			StandaloneScriptSchema.parse({
				id: 'no-name',
				name: '',
				entry_point: 'scripts/run.ts',
			}),
		).toThrow(ZodError)
	})
})

describe('ScriptInputSchema', () => {
	test('parses with defaults applied', () => {
		const result = ScriptInputSchema.parse({ name: 'url' })

		expect(result.name).toBe('url')
		expect(result.description).toBe('')
		expect(result.type).toBe('string')
		expect(result.required).toBe(false)
		expect(result.default).toBeUndefined()
	})

	test('parses fully specified input', () => {
		const result = ScriptInputSchema.parse({
			name: 'count',
			description: 'Number of items',
			type: 'number',
			required: true,
			default: 10,
		})

		expect(result.type).toBe('number')
		expect(result.required).toBe(true)
		expect(result.default).toBe(10)
	})
})

describe('ScriptOutputSchema', () => {
	test('parses with defaults applied', () => {
		const result = ScriptOutputSchema.parse({ name: 'status' })

		expect(result.name).toBe('status')
		expect(result.description).toBe('')
		expect(result.type).toBe('string')
	})

	test('parses fully specified output', () => {
		const result = ScriptOutputSchema.parse({
			name: 'payload',
			description: 'JSON payload',
			type: 'json',
		})

		expect(result.type).toBe('json')
		expect(result.description).toBe('JSON payload')
	})
})
