/**
 * Pack materializer — copies resolved pack files into canonical .autopilot/ paths,
 * manages the lockfile, and detects conflicts with user-modified files.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { stringify as stringifyYaml, parse as parseYaml } from 'yaml'
import { PackLockfileSchema, PATHS } from '@questpie/autopilot-spec'
import type { PackLockfile } from '@questpie/autopilot-spec'
import type { ResolvedPack } from './git-registry'

export interface MaterializeResult {
	installed: string[]
	skipped: string[]
	conflicts: string[]
}

/**
 * Materialize resolved packs into the repo, writing/updating the lockfile.
 *
 * Conflict rules (V1):
 * - If a file exists and is NOT tracked in the lockfile as managed → conflict, refuse overwrite
 * - If a file exists and IS tracked in the lockfile → safe to overwrite (pack owns it)
 * - New files → always written
 */
export function materializePacks(
	resolvedPacks: ResolvedPack[],
	companyRoot: string,
): MaterializeResult {
	const lockfile = loadLockfile(companyRoot)
	const allManagedFiles = collectManagedFiles(lockfile)
	const installed: string[] = []
	const skipped: string[] = []
	const conflicts: string[] = []

	for (const resolved of resolvedPacks) {
		const { manifest, registry, resolvedRef, commit, packDir } = resolved
		const ref = `${registry.id}/${manifest.id}`
		const managedFiles: string[] = []

		for (const fileMapping of manifest.files) {
			const srcPath = join(packDir, fileMapping.src)
			const destRelative = join(PATHS.AUTOPILOT_DIR, fileMapping.dest)
			const destAbsolute = join(companyRoot, destRelative)

			if (!existsSync(srcPath)) {
				skipped.push(`${ref}: source missing ${fileMapping.src}`)
				continue
			}

			// Conflict detection
			if (existsSync(destAbsolute) && !allManagedFiles.has(destRelative)) {
				conflicts.push(destRelative)
				continue
			}

			// Materialize
			mkdirSync(dirname(destAbsolute), { recursive: true })
			copyFileSync(srcPath, destAbsolute)
			managedFiles.push(destRelative)
		}

		// Only record in lockfile if at least one file was materialized
		if (managedFiles.length > 0) {
			lockfile.packs[ref] = {
				ref,
				registry: registry.id,
				resolved_ref: resolvedRef,
				commit,
				managed_files: managedFiles,
				installed_at: new Date().toISOString(),
			}
			installed.push(ref)
		}
	}

	writeLockfile(companyRoot, lockfile)
	return { installed, skipped, conflicts }
}

function loadLockfile(companyRoot: string): PackLockfile {
	const lockPath = join(companyRoot, PATHS.PACKS_LOCKFILE)
	if (!existsSync(lockPath)) return { packs: {} }
	const raw = readFileSync(lockPath, 'utf-8')
	return PackLockfileSchema.parse(parseYaml(raw))
}

function writeLockfile(companyRoot: string, lockfile: PackLockfile): void {
	const lockPath = join(companyRoot, PATHS.PACKS_LOCKFILE)
	mkdirSync(dirname(lockPath), { recursive: true })
	writeFileSync(lockPath, stringifyYaml(lockfile, { lineWidth: 120 }))
}

/** Collect all managed files from existing lockfile entries into a Set. */
function collectManagedFiles(lockfile: PackLockfile): Set<string> {
	const files = new Set<string>()
	for (const entry of Object.values(lockfile.packs)) {
		for (const f of entry.managed_files) {
			files.add(f)
		}
	}
	return files
}
