/**
 * Scope-based permission checking for filesystem and secret access.
 * Combines hardcoded deny patterns with per-actor fs_scope globs.
 */
import picomatch from 'picomatch'
import { isDeniedPath } from './deny-patterns'
import type { Actor } from './types'

/**
 * Check if an actor has access to a specific resource path.
 * Order: 1) Hardcoded deny (always wins) 2) No scope = unrestricted 3) Scope glob match
 */
export function checkScope(
	actor: Actor,
	resourceType: 'fs_read' | 'fs_write' | 'secret',
	resourcePath: string,
): boolean {
	// 1. HARDCODED DENY — always first, always wins
	if ((resourceType === 'fs_read' || resourceType === 'fs_write') && isDeniedPath(resourcePath)) {
		return false
	}

	// 2. No scope = unrestricted (humans in v1)
	if (!actor.scope) return true

	// 3. Scope check
	const normalized = resourcePath.replace(/^\/+/, '')
	switch (resourceType) {
		case 'fs_read': {
			const patterns = actor.scope.fsRead ?? ['**']
			return matchGlobs(patterns, normalized)
		}
		case 'fs_write': {
			const patterns = actor.scope.fsWrite ?? []
			return matchGlobs(patterns, normalized)
		}
		case 'secret': {
			if (!actor.scope.secrets) return true
			return actor.scope.secrets.includes(resourcePath) || actor.scope.secrets.includes('*')
		}
	}
}

function matchGlobs(patterns: string[], path: string): boolean {
	if (patterns.length === 0) return false
	const normalized = patterns.map((p) => p.replace(/^\/+/, ''))
	const isMatch = picomatch(normalized, { dot: true })
	return isMatch(path)
}
