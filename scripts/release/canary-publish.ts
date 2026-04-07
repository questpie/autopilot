#!/usr/bin/env bun
/**
 * Publish canary packages to npm in dependency order.
 *
 * Usage:
 *   bun run release:canary:publish
 *   bun run release:canary:publish -- --dry-run
 *
 * Requires: pre mode canary, clean worktree, npm auth.
 * Stops at first failure. Skips already-published versions.
 */
import { fmt, requirePreMode, requireCleanWorktree, requireNpmAuth, PUBLISH_ORDER, NPM_CACHE, readPkg, run, hasFlag, REPO_ROOT } from './lib'
import { resolve } from 'node:path'

const dryRun = hasFlag('--dry-run')

fmt.info(dryRun ? 'Canary publish (dry run)' : 'Canary publish')
console.log()

requirePreMode('canary')
requireCleanWorktree()
requireNpmAuth()
console.log()

// ── Publish ───────────────────────────────────────────────────
const published: string[] = []

for (const pkgDir of PUBLISH_ORDER) {
	const pkg = readPkg(pkgDir)
	const label = `${pkg.name}@${pkg.version}`
	process.stdout.write(`  Publishing ${label.padEnd(50)} `)

	// Check if already published
	const { ok: alreadyPublished } = run(['npm', 'view', `${pkg.name}@${pkg.version}`, 'version', '--cache', NPM_CACHE], { silent: true })
	if (alreadyPublished) {
		console.log('already published, skipping')
		published.push(label)
		continue
	}

	if (dryRun) {
		console.log('(dry run — skipped)')
		published.push(label)
		continue
	}

	const absDir = resolve(REPO_ROOT, pkgDir)
	const result = run(['npm', 'publish', '--tag', 'canary', '--access', 'public', '--cache', NPM_CACHE], { cwd: absDir, silent: true })
	if (result.ok) {
		console.log('done')
		published.push(label)
	} else {
		console.log('FAILED')
		console.error(result.stderr || result.stdout)
		fmt.die(`Failed to publish ${label}. Published so far: ${published.join(', ') || 'none'}`)
	}
}

console.log()
fmt.ok(`${dryRun ? '(dry run) ' : ''}All packages published:`)
for (const p of published) {
	console.log(`  ${p}`)
}

console.log()
fmt.info('Next: bun run release:canary:verify then bun run release:canary:finish')
