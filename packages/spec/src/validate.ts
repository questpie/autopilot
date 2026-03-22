import { parse as parseYaml } from 'yaml'
import { readFile } from 'fs/promises'
import { z } from 'zod'

/**
 * Reads a YAML file from disk, parses it, and validates the contents against a Zod schema.
 * Throws a `ZodError` if validation fails or a filesystem error if the file cannot be read.
 *
 * @param path - Absolute or relative filesystem path to the YAML file
 * @param schema - Zod schema to validate the parsed data against
 * @returns The validated and typed data
 */
export async function loadAndValidate<T extends z.ZodSchema>(
	path: string,
	schema: T,
): Promise<z.infer<T>> {
	const content = await readFile(path, 'utf-8')
	const data = parseYaml(content)
	return schema.parse(data)
}
