import { access } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { PATHS } from '@questpie/autopilot-spec'

/**
 * Walk up from `from` (defaults to cwd) looking for `.autopilot/company.yaml`.
 * Returns the directory that contains `.autopilot/company.yaml`.
 * Throws if not found.
 */
export async function findCompanyRoot(from?: string): Promise<string> {
	let dir = resolve(from ?? process.cwd())
	const root = dirname(dir) === dir ? dir : '/'

	while (true) {
		const candidate = join(dir, PATHS.COMPANY_CONFIG)
		try {
			await access(candidate)
			return dir
		} catch {
			// not found, keep walking
		}

		const parent = dirname(dir)
		if (parent === dir || parent === root) {
			break
		}
		dir = parent
	}

	throw new Error(
		'Could not find .autopilot/company.yaml in any parent directory.\n' +
			'Run `autopilot init` to create a new company, or navigate to an existing one.',
	)
}

/**
 * Walk up from `from` looking for `.autopilot/project.yaml`.
 * Returns the directory that contains it, or null if not found.
 */
export async function findProjectRoot(from?: string): Promise<string | null> {
	let dir = resolve(from ?? process.cwd())

	while (true) {
		const candidate = join(dir, PATHS.PROJECT_CONFIG)
		try {
			await access(candidate)
			return dir
		} catch {
			// not found, keep walking
		}

		const parent = dirname(dir)
		if (parent === dir) break
		dir = parent
	}

	return null
}
