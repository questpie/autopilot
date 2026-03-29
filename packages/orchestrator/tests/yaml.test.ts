import { describe, it, expect, afterEach } from 'bun:test'
import { join } from 'node:path'
import { z } from 'zod'
import { readYaml, writeYaml, readYamlUnsafe, fileExists } from '../src/fs/yaml'
import { createTestCompany } from './helpers'

describe('yaml', () => {
	let cleanup: () => Promise<void>
	let root: string

	afterEach(async () => {
		if (cleanup) await cleanup()
	})

	it('should write and read YAML with schema validation', async () => {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup

		const schema = z.object({
			name: z.string(),
			value: z.number(),
		})

		const data = { name: 'test', value: 42 }
		const filePath = join(root, 'test.yaml')

		await writeYaml(filePath, data)
		const result = await readYaml(filePath, schema)

		expect(result).toEqual(data)
	})

	it('should throw on invalid data', async () => {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup

		const schema = z.object({ name: z.string(), value: z.number() })
		const filePath = join(root, 'invalid.yaml')

		await writeYaml(filePath, { name: 'test', value: 'not-a-number' })

		expect(readYaml(filePath, schema)).rejects.toThrow()
	})

	it('should read YAML without validation', async () => {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup

		const filePath = join(root, 'unsafe.yaml')
		await writeYaml(filePath, { foo: 'bar', nested: { a: 1 } })

		const result = await readYamlUnsafe(filePath)
		expect(result).toEqual({ foo: 'bar', nested: { a: 1 } })
	})

	it('should check file existence', async () => {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup

		const existing = join(root, 'exists.yaml')
		await writeYaml(existing, { x: 1 })

		expect(await fileExists(existing)).toBe(true)
		expect(await fileExists(join(root, 'nope.yaml'))).toBe(false)
	})

	it('should create parent directories on write', async () => {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup

		const filePath = join(root, 'deep', 'nested', 'dir', 'file.yaml')
		await writeYaml(filePath, { nested: true })

		const result = await readYamlUnsafe(filePath)
		expect(result).toEqual({ nested: true })
	})

	it('throws on non-existent file (readYaml)', async () => {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup

		const schema = z.object({ x: z.string() })
		expect(readYaml(join(root, 'ghost.yaml'), schema)).rejects.toThrow()
	})

	it('throws on non-existent file (readYamlUnsafe)', async () => {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup

		expect(readYamlUnsafe(join(root, 'ghost.yaml'))).rejects.toThrow()
	})

	it('handles unicode content', async () => {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup

		const data = { name: 'Ján Ščťžý', emoji: '🚀✨', desc: 'čeština a slovenčina' }
		const filePath = join(root, 'unicode.yaml')
		await writeYaml(filePath, data)

		const result = await readYamlUnsafe(filePath)
		expect(result).toEqual(data)
	})

	it('preserves arrays and nested objects', async () => {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup

		const data = {
			agents: [
				{ id: 'dev', tools: ['bash', 'read_file'] },
				{ id: 'ops', tools: ['deploy'] },
			],
			settings: { nested: { deep: { value: 42 } } },
		}
		const filePath = join(root, 'complex.yaml')
		await writeYaml(filePath, data)

		const result = await readYamlUnsafe(filePath)
		expect(result).toEqual(data)
	})

	it('readYaml applies schema defaults', async () => {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup

		const schema = z.object({
			name: z.string(),
			count: z.number().default(0),
			tags: z.array(z.string()).default([]),
		})
		const filePath = join(root, 'defaults.yaml')
		await writeYaml(filePath, { name: 'test' })

		const result = await readYaml(filePath, schema)
		expect(result.name).toBe('test')
		expect(result.count).toBe(0)
		expect(result.tags).toEqual([])
	})
})
