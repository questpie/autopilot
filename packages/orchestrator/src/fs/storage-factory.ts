import type { StorageBackend } from './storage'
import { SqliteBackend } from './sqlite-backend'
import { YamlFsBackend } from './yaml-backend'

export type StorageMode = 'yaml' | 'sqlite'

/**
 * Create the appropriate storage backend based on company config.
 *
 * Reads `settings.storage` from company.yaml:
 *   - "yaml"   -> existing YAML file-based storage (default)
 *   - "sqlite" -> SQLite database in .data/
 */
export async function createStorage(
	companyRoot: string,
	mode: StorageMode = 'sqlite',
): Promise<StorageBackend> {
	const backend = mode === 'sqlite'
		? new SqliteBackend(companyRoot)
		: new YamlFsBackend(companyRoot)

	await backend.initialize()
	return backend
}

export type { StorageBackend } from './storage'
