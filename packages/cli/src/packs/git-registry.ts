/**
 * Git registry backend — resolves packs from git-hosted registries.
 *
 * Registry layout convention:
 *   <repo-root>/packs/<pack-id>/pack.yaml
 *   <repo-root>/packs/<pack-id>/files/...
 *
 * Clones/fetches into .data/pack-cache/<registry-id>/ for caching.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { parse as parseYaml } from 'yaml'
import { PackManifestSchema, PATHS } from '@questpie/autopilot-spec'
import type { PackManifest, Registry } from '@questpie/autopilot-spec'

export interface ResolvedPack {
	manifest: PackManifest
	registry: Registry
	/** The git ref that was resolved (branch/tag). */
	resolvedRef: string
	/** Exact commit SHA. */
	commit: string
	/** Absolute path to the pack directory inside the cache. */
	packDir: string
}

/**
 * Resolve a pack from a git registry.
 *
 * @param packId - The pack ID to look for (e.g. "claude-code-surface")
 * @param version - Version constraint or git ref. "latest" uses the default branch.
 * @param registry - The registry to fetch from.
 * @param companyRoot - Company root for cache location.
 */
export function resolvePackFromGit(
	packId: string,
	version: string,
	registry: Registry,
	companyRoot: string,
): ResolvedPack | null {
	const cacheDir = join(companyRoot, PATHS.PACK_CACHE_DIR, registry.id)
	ensureClone(registry.url, cacheDir)
	fetchLatest(cacheDir, version)

	const ref = version === 'latest' ? getDefaultBranch(cacheDir) : version
	checkoutRef(cacheDir, ref)

	const packDir = join(cacheDir, 'packs', packId)
	const manifestPath = join(packDir, 'pack.yaml')
	if (!existsSync(manifestPath)) return null

	const raw = readFileSync(manifestPath, 'utf-8')
	const manifest = PackManifestSchema.parse(parseYaml(raw))
	const commit = getHeadCommit(cacheDir)

	return { manifest, registry, resolvedRef: ref, commit, packDir }
}

function git(args: string[], cwd?: string): string {
	return execFileSync('git', args, { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] })
}

function ensureClone(url: string, cacheDir: string): void {
	if (existsSync(join(cacheDir, '.git')) || existsSync(join(cacheDir, 'HEAD'))) return
	mkdirSync(cacheDir, { recursive: true })
	git(['clone', '--quiet', url, cacheDir])
}

function fetchLatest(cacheDir: string, version: string): void {
	// For local path repos (tests), fetch may not have a remote — skip gracefully
	try {
		const args = ['fetch', '--quiet', 'origin']
		if (version !== 'latest') {
			args.push(`+refs/tags/${version}:refs/tags/${version}`)
		}
		git(args, cacheDir)
	} catch {
		// Local repos or missing refs — will fail at checkout if truly broken
	}
}

function getDefaultBranch(cacheDir: string): string {
	try {
		const ref = git(['symbolic-ref', 'refs/remotes/origin/HEAD'], cacheDir).trim()
		return ref.replace('refs/remotes/origin/', '')
	} catch {
		// Fallback for local repos without origin/HEAD
		return git(['rev-parse', '--abbrev-ref', 'HEAD'], cacheDir).trim()
	}
}

function checkoutRef(cacheDir: string, ref: string): void {
	try {
		git(['checkout', '--quiet', ref], cacheDir)
	} catch {
		// Try as origin/<ref> for remote branches
		git(['checkout', '--quiet', `origin/${ref}`], cacheDir)
	}
}

function getHeadCommit(cacheDir: string): string {
	return git(['rev-parse', 'HEAD'], cacheDir).trim()
}
