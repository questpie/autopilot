#!/usr/bin/env bun
/**
 * Finish canary release: push, exit pre mode, optionally create a GitHub release.
 *
 * Usage:
 *   bun run release:canary:finish
 *   bun run release:canary:finish -- --github-release
 */
import { fmt, requireBranch, requireCleanWorktree, readPreJson, runOrDie, REPO_ROOT, hasFlag } from './lib'

const githubRelease = hasFlag('--github-release')

fmt.info('Canary finish')
console.log()

requireBranch('main')
requireCleanWorktree()

// ── Push versioned commits ────────────────────────────────────
fmt.info('Pushing main...')
runOrDie(['git', 'push', 'origin', 'main'])
fmt.ok('Pushed main')

// ── Exit pre mode ─────────────────────────────────────────────
const pre = readPreJson()

if (pre?.mode === 'pre') {
	fmt.info('Exiting canary pre mode...')
	runOrDie(['bunx', 'changeset', 'pre', 'exit'])

	const { stdout: diff } = Bun.spawnSync(['git', 'status', '--porcelain', '.changeset/pre.json'], {
		cwd: REPO_ROOT,
		stdout: 'pipe',
		stderr: 'pipe',
	})
	if (diff.toString().trim().length > 0) {
		runOrDie(['git', 'add', '.changeset/pre.json'])
		runOrDie(['git', 'commit', '-m', 'chore: exit changesets canary pre mode'])
		fmt.ok('Committed pre mode exit')
	}

	runOrDie(['git', 'push', 'origin', 'main'])
	fmt.ok('Pushed pre mode exit')
} else if (pre?.mode === 'exit') {
	fmt.ok('Already exited pre mode')
} else {
	fmt.warn('Not in pre mode — nothing to exit')
}

// ── GitHub release (optional) ─────────────────────────────────
if (githubRelease) {
	const today = new Date().toISOString().slice(0, 10)
	const tag = `canary-${today}`
	fmt.info(`Creating tag ${tag}...`)

	const tagCheck = Bun.spawnSync(['git', 'rev-parse', tag], {
		cwd: REPO_ROOT,
		stdout: 'pipe',
		stderr: 'pipe',
	})
	if (tagCheck.exitCode === 0) {
		fmt.warn(`Tag ${tag} already exists — skipping`)
	} else {
		runOrDie(['git', 'tag', tag])
		runOrDie(['git', 'push', 'origin', tag])
		fmt.ok(`Created and pushed tag ${tag}`)
	}

	const releaseCheck = Bun.spawnSync(['gh', 'release', 'view', tag], {
		cwd: REPO_ROOT,
		stdout: 'pipe',
		stderr: 'pipe',
	})
	if (releaseCheck.exitCode === 0) {
		fmt.warn(`GitHub release ${tag} already exists — skipping`)
	} else {
		runOrDie([
			'gh',
			'release',
			'create',
			tag,
			'--title',
			`Canary Alpha - ${today}`,
			'--notes',
			'Canary alpha release set for self-hosted Autopilot.',
		])
		fmt.ok(`Created GitHub release ${tag}`)
	}
}

console.log()
fmt.ok('Canary release finished')
