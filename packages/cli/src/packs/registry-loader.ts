/**
 * Registry config loader — merges global (~/.config/autopilot/registries.yaml)
 * and repo-local (.autopilot/registries.yaml) registry definitions.
 *
 * Repo-local registries override global ones by ID.
 * Result is sorted by priority (descending).
 */

import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { parse as parseYaml } from 'yaml'
import { RegistriesFileSchema, PATHS } from '@questpie/autopilot-spec'
import type { Registry } from '@questpie/autopilot-spec'

export function loadRegistries(companyRoot: string): Registry[] {
	const globalPath = join(homedir(), PATHS.GLOBAL_REGISTRIES_CONFIG)
	const localPath = join(companyRoot, PATHS.REGISTRIES_CONFIG)

	const globalRegistries = loadRegistriesFile(globalPath)
	const localRegistries = loadRegistriesFile(localPath)

	// Merge: local overrides global by ID
	const merged = new Map<string, Registry>()
	for (const reg of globalRegistries) merged.set(reg.id, reg)
	for (const reg of localRegistries) merged.set(reg.id, reg)

	// Sort by priority descending, then by ID for stability
	return [...merged.values()].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
}

function loadRegistriesFile(filePath: string): Registry[] {
	if (!existsSync(filePath)) return []
	const raw = readFileSync(filePath, 'utf-8')
	const parsed = RegistriesFileSchema.parse(parseYaml(raw))
	return parsed.registries
}
