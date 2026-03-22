import { access } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

/**
 * Walk up from `from` (defaults to cwd) looking for company.yaml.
 * Returns the directory that contains company.yaml.
 * Throws if not found.
 */
export async function findCompanyRoot(from?: string): Promise<string> {
	let dir = resolve(from ?? process.cwd())
	const root = dirname(dir) === dir ? dir : '/'

	while (true) {
		const candidate = join(dir, 'company.yaml')
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
		'Could not find company.yaml in any parent directory.\n' +
			'Run `autopilot init` to create a new company, or navigate to an existing one.',
	)
}
