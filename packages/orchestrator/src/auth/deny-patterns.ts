/**
 * Hardcoded deny patterns — paths that are ALWAYS denied for agents,
 * regardless of fs_scope. Even CEO agent with read: ["/**"] cannot access these.
 */
import picomatch from 'picomatch'

export const HARDCODED_DENY_PATTERNS = [
	'.auth/**',
	'secrets/.master-key',
	'.data/**',
	'.git/**',
	'logs/audit/**',
] as const

const matchers = HARDCODED_DENY_PATTERNS.map((pattern) =>
	picomatch(pattern, { dot: true }),
)

/**
 * Check if a path matches any deny pattern.
 * Called BEFORE fs_scope check — deny always wins.
 */
export function isDeniedPath(relativePath: string): boolean {
	const normalized = relativePath.replace(/^\/+/, '')
	return matchers.some((match) => match(normalized))
}
