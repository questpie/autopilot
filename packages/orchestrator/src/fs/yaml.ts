import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { ZodType } from 'zod'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import { encryptToBase64, decryptFromBase64 } from '../auth/crypto'

/**
 * Read a YAML file from disk, parse it, and validate with a Zod schema.
 *
 * @param path   - Absolute path to the YAML file.
 * @param schema - Zod schema used for validation.
 * @returns The validated data matching the schema's output type.
 * @throws When the file cannot be read or the content fails validation.
 */
export async function readYaml<T extends ZodType>(
	path: string,
	schema: T,
): Promise<T['_output']> {
	const content = await Bun.file(path).text()
	const data = parseYaml(content)
	return schema.parse(data)
}

/**
 * Serialize data to YAML and write it to disk, creating parent
 * directories as needed.
 */
export async function writeYaml(path: string, data: unknown): Promise<void> {
	await mkdir(dirname(path), { recursive: true })
	const content = stringifyYaml(data, { lineWidth: 120 })
	await Bun.write(path, content)
}

/**
 * Read and parse a YAML file without schema validation.
 *
 * Use sparingly — prefer {@link readYaml} with a schema whenever possible.
 */
export async function readYamlUnsafe(path: string): Promise<unknown> {
	const content = await Bun.file(path).text()
	return parseYaml(content)
}

/** Check whether a file exists at the given path. */
export async function fileExists(path: string): Promise<boolean> {
	return Bun.file(path).exists()
}

const ENCRYPTED_PREFIX = '!encrypted:'

/**
 * Read a YAML file from disk, decrypting it first if it starts with the
 * `!encrypted:` prefix.
 */
export async function readEncryptedYaml<T>(path: string, masterKey: CryptoKey): Promise<T> {
	const raw = await Bun.file(path).text()
	if (raw.startsWith(ENCRYPTED_PREFIX)) {
		const base64 = raw.slice(ENCRYPTED_PREFIX.length).trim()
		const decrypted = await decryptFromBase64(base64, masterKey)
		return parseYaml(decrypted) as T
	}
	return parseYaml(raw) as T
}

/**
 * Serialize data to YAML, encrypt it with the master key, and write it to
 * disk with the `!encrypted:` prefix.
 */
export async function writeEncryptedYaml(
	path: string,
	data: unknown,
	masterKey: CryptoKey,
): Promise<void> {
	await mkdir(dirname(path), { recursive: true })
	const yamlStr = stringifyYaml(data, { lineWidth: 120 })
	const encrypted = await encryptToBase64(yamlStr, masterKey)
	await Bun.write(path, ENCRYPTED_PREFIX + encrypted)
}
