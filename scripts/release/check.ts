#!/usr/bin/env bun
/**
 * Pre-release verification. Does not publish or change versions.
 *
 * Usage:
 *   bun run release:check
 *   bun run release:check -- --docker
 *   bun run release:check -- --allow-dirty
 */
import {
	fmt,
	checkGitDiff,
	requireCleanWorktree,
	PUBLISH_ORDER,
	NPM_CACHE,
	readPkg,
	run,
	runStreamOrDie,
	hasFlag,
} from './lib'

const allowDirty = hasFlag('--allow-dirty')
const docker = hasFlag('--docker')

fmt.info('Release check')
console.log()

// ── Worktree ──────────────────────────────────────────────────
if (allowDirty) {
	fmt.warn('Skipping clean worktree check (--allow-dirty)')
} else {
	requireCleanWorktree()
}

// ── Whitespace ────────────────────────────────────────────────
checkGitDiff()

// ── Changeset status ──────────────────────────────────────────
fmt.info('Changeset status:')
await runStreamOrDie(['bunx', 'changeset', 'status', '--verbose'], 'changeset status')
console.log()

// ── Pack dry-run ──────────────────────────────────────────────
fmt.info('Pack dry-run for publishable packages:')
for (const pkgDir of PUBLISH_ORDER) {
	const pkg = readPkg(pkgDir)
	const result = run(['npm', 'pack', '--dry-run', '--workspace', pkgDir, '--cache', NPM_CACHE], { silent: true })
	if (!result.ok) fmt.die(`npm pack --dry-run failed for ${pkg.name}\n${result.stderr || result.stdout}`)
	const combined = `${result.stdout}\n${result.stderr}`
	const size = combined.match(/package size:\s*(.+)/)?.[1]
	const files = combined.match(/total files:\s*(\d+)/)?.[1]
	if (!size || !files) fmt.die(`Could not parse pack output for ${pkg.name}`)
	console.log(`  ${pkg.name.padEnd(42)} ${size}, ${files} files`)
}
console.log()

// ── Docker (optional) ─────────────────────────────────────────
if (docker) {
	fmt.info('Docker build:')
	await runStreamOrDie(
		['docker', 'build', '--target', 'runtime', '-t', 'questpie-autopilot-release-check', '.'],
		'Docker build',
	)
	fmt.ok('Docker image built')
	console.log()
}

fmt.ok('Release check passed')
