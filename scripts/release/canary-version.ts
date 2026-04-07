#!/usr/bin/env bun
/**
 * Enter canary pre mode and version packages. Does not publish.
 *
 * Usage:
 *   bun run release:canary:version
 *
 * Requires: branch main, clean worktree.
 */
import { fmt, requireBranch, requireCleanWorktree, readPreJson, runOrDie, runStreamOrDie, PUBLISH_ORDER, readPkg, REPO_ROOT } from './lib'

fmt.info('Canary version')
console.log()

requireBranch('main')
requireCleanWorktree()

// ── Enter pre mode ────────────────────────────────────────────
const pre = readPreJson()
if (pre?.mode === 'pre') {
	fmt.ok('Already in canary pre mode')
} else {
	fmt.info('Entering canary pre mode...')
	await runStreamOrDie(['bunx', 'changeset', 'pre', 'enter', 'canary'], 'changeset pre enter')

	const { stdout: diff } = Bun.spawnSync(['git', 'diff', '--name-only', '.changeset/pre.json'], {
		cwd: REPO_ROOT,
		stdout: 'pipe',
		stderr: 'pipe',
	})
	if (diff.toString().trim().length > 0) {
		runOrDie(['git', 'add', '.changeset/pre.json'])
		runOrDie(['git', 'commit', '-m', 'chore: enter changesets canary pre mode'])
		fmt.ok('Committed pre mode entry')
	}
}

// ── Version ───────────────────────────────────────────────────
fmt.info('Running changeset version...')
await runStreamOrDie(['bunx', 'changeset', 'version'], 'changeset version')

fmt.info('Updating bun.lock...')
await runStreamOrDie(['bun', 'install'], 'bun install')

// ── Commit ────────────────────────────────────────────────────
const { stdout: status } = Bun.spawnSync(['git', 'status', '--porcelain'], {
	cwd: REPO_ROOT,
	stdout: 'pipe',
	stderr: 'pipe',
})
if (status.toString().trim().length > 0) {
	runOrDie(['git', 'add', '-A'])
	runOrDie(['git', 'commit', '-m', 'chore: version canary alpha packages'])
	fmt.ok('Committed canary versions')
} else {
	fmt.warn('No version changes to commit')
}

// ── Summary ───────────────────────────────────────────────────
console.log()
fmt.info('Canary versions:')
for (const pkgDir of PUBLISH_ORDER) {
	const pkg = readPkg(pkgDir)
	console.log(`  ${pkg.name.padEnd(42)} ${pkg.version}`)
}

console.log()
fmt.ok('Canary versioning complete. Run: bun run release:canary:publish')
