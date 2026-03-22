import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { ZodType } from 'zod'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'

export async function readYaml<T extends ZodType>(
	path: string,
	schema: T,
): Promise<T['_output']> {
	const content = await Bun.file(path).text()
	const data = parseYaml(content)
	return schema.parse(data)
}

export async function writeYaml(path: string, data: unknown): Promise<void> {
	await mkdir(dirname(path), { recursive: true })
	const content = stringifyYaml(data, { lineWidth: 120 })
	await Bun.write(path, content)
}

export async function readYamlUnsafe(path: string): Promise<unknown> {
	const content = await Bun.file(path).text()
	return parseYaml(content)
}

export async function fileExists(path: string): Promise<boolean> {
	return Bun.file(path).exists()
}
