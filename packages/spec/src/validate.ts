import { parse as parseYaml } from 'yaml'
import { readFile } from 'fs/promises'
import { z } from 'zod'

export async function loadAndValidate<T extends z.ZodSchema>(
	path: string,
	schema: T,
): Promise<z.infer<T>> {
	const content = await readFile(path, 'utf-8')
	const data = parseYaml(content)
	return schema.parse(data)
}
