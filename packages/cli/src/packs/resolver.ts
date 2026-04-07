/**
 * Pack resolver — resolves pack refs from registries, delegates to backends.
 *
 * Parses refs like "questpie/claude-code-surface" into registry + pack ID,
 * tries registries in priority order.
 *
 * Unqualified ref resolution:
 * - If any registries have `default: true`, only those are tried (in priority order).
 * - If no registries are marked default, all registries are tried (in priority order).
 * - Qualified refs (`registry-id/pack-id`) always resolve against the named registry only.
 */

import type { PackDependency, Registry } from '@questpie/autopilot-spec'
import { resolvePackFromGit, type ResolvedPack } from './git-registry'

export interface ResolveResult {
	resolved: ResolvedPack[]
	errors: string[]
}

/**
 * Resolve all pack dependencies against available registries.
 *
 * Ref format: `<registry-id>/<pack-id>` or just `<pack-id>` (uses default/priority order).
 */
export function resolveAllPacks(
	deps: PackDependency[],
	registries: Registry[],
	companyRoot: string,
): ResolveResult {
	const resolved: ResolvedPack[] = []
	const errors: string[] = []

	for (const dep of deps) {
		const result = resolveSinglePack(dep, registries, companyRoot)
		if (result) {
			resolved.push(result)
		} else {
			errors.push(`Pack "${dep.ref}" (version: ${dep.version}) not found in any registry`)
		}
	}

	return { resolved, errors }
}

function resolveSinglePack(
	dep: PackDependency,
	registries: Registry[],
	companyRoot: string,
): ResolvedPack | null {
	const { registryId, packId } = parseRef(dep.ref)

	// If registry is specified, only try that one
	if (registryId) {
		const registry = registries.find((r) => r.id === registryId)
		if (!registry) return null
		return resolveFromRegistry(packId, dep.version, registry, companyRoot)
	}

	// Unqualified ref: prefer default registries, fall back to all
	const defaults = registries.filter((r) => r.default)
	const candidates = defaults.length > 0 ? defaults : registries

	for (const registry of candidates) {
		const result = resolveFromRegistry(packId, dep.version, registry, companyRoot)
		if (result) return result
	}
	return null
}

function parseRef(ref: string): { registryId: string | null; packId: string } {
	const slashIdx = ref.indexOf('/')
	if (slashIdx === -1) return { registryId: null, packId: ref }
	return { registryId: ref.slice(0, slashIdx), packId: ref.slice(slashIdx + 1) }
}

function resolveFromRegistry(
	packId: string,
	version: string,
	registry: Registry,
	companyRoot: string,
): ResolvedPack | null {
	if (registry.type === 'git') {
		return resolvePackFromGit(packId, version, registry, companyRoot)
	}
	return null
}
