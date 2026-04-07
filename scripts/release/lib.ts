/**
 * Shared release helpers. Import from other release scripts.
 */
import { readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

export const REPO_ROOT = resolve(import.meta.dir, '..', '..')
export const NPM_CACHE = resolve(tmpdir(), 'questpie-autopilot-release-npm-cache')

/** Publishable packages in dependency order. */
export const PUBLISH_ORDER = [
	'packages/spec',
	'packages/worker',
	'packages/orchestrator',
	'packages/mcp-server',
	'packages/cli',
] as const

// ── Output ────────────────────────────────────────────────────

const ESC = '\x1b'
export const fmt = {
	info: (msg: string) => console.log(`${ESC}[36m${msg}${ESC}[0m`),
	ok: (msg: string) => console.log(`${ESC}[32m✓ ${msg}${ESC}[0m`),
	warn: (msg: string) => console.log(`${ESC}[33m⚠ ${msg}${ESC}[0m`),
	die: (msg: string): never => {
		console.error(`${ESC}[31m✗ ${msg}${ESC}[0m`)
		process.exit(1)
	},
}

// ── Shell ─────────────────────────────────────────────────────

export function run(cmd: string[], opts?: { cwd?: string; silent?: boolean }): { ok: boolean; stdout: string; stderr: string } {
	const result = Bun.spawnSync(cmd, {
		cwd: opts?.cwd ?? REPO_ROOT,
		stdout: 'pipe',
		stderr: 'pipe',
		env: process.env,
	})
	const stdout = result.stdout.toString().trim()
	const stderr = result.stderr.toString().trim()
	if (!opts?.silent && result.exitCode !== 0) {
		console.error(stderr || stdout)
	}
	return { ok: result.exitCode === 0, stdout, stderr }
}

export function runOrDie(cmd: string[], opts?: { cwd?: string }): string {
	const result = run(cmd, opts)
	if (!result.ok) fmt.die(`Command failed: ${cmd.join(' ')}\n${result.stderr || result.stdout}`)
	return result.stdout
}

export async function runStream(cmd: string[], opts?: { cwd?: string }): Promise<number> {
	const proc = Bun.spawn(cmd, {
		cwd: opts?.cwd ?? REPO_ROOT,
		stdout: 'inherit',
		stderr: 'inherit',
		env: process.env,
	})
	return proc.exited
}

export async function runStreamOrDie(cmd: string[], label?: string): Promise<void> {
	const code = await runStream(cmd)
	if (code !== 0) fmt.die(`${label ?? cmd.join(' ')} failed (exit ${code})`)
}

// ── Package helpers ───────────────────────────────────────────

interface PkgJson {
	name: string
	version: string
	private?: boolean
	[key: string]: unknown
}

export function readPkg(pkgDir: string): PkgJson {
	const path = resolve(REPO_ROOT, pkgDir, 'package.json')
	return JSON.parse(readFileSync(path, 'utf-8'))
}

// ── Pre-mode helpers ──────────────────────────────────────────

interface PreJson {
	mode: 'pre' | 'exit'
	tag: string
	initialVersions: Record<string, string>
	changesets: string[]
}

export function readPreJson(): PreJson | null {
	const path = resolve(REPO_ROOT, '.changeset', 'pre.json')
	if (!existsSync(path)) return null
	return JSON.parse(readFileSync(path, 'utf-8'))
}

// ── Checks ────────────────────────────────────────────────────

export function requireCleanWorktree(): void {
	const { stdout } = run(['git', 'status', '--porcelain'], { silent: true })
	if (stdout.length > 0) fmt.die('Worktree is dirty. Commit or stash changes first.')
	fmt.ok('Worktree is clean')
}

export function requireBranch(expected: string): void {
	const { stdout } = run(['git', 'branch', '--show-current'], { silent: true })
	if (stdout !== expected) fmt.die(`Must be on branch '${expected}', currently on '${stdout}'.`)
	fmt.ok(`On branch ${expected}`)
}

export function requirePreMode(expectedTag: string): void {
	const pre = readPreJson()
	if (!pre) return fmt.die('Not in Changesets pre mode (.changeset/pre.json missing).')
	if (pre.mode !== 'pre') return fmt.die(`Changesets pre mode is '${pre.mode}', expected 'pre'. Run canary-version first.`)
	if (pre.tag !== expectedTag) return fmt.die(`Changesets pre tag is '${pre.tag}', expected '${expectedTag}'.`)
	fmt.ok(`In Changesets pre mode (tag: ${pre.tag})`)
}

export function requireNpmAuth(): string {
	const { ok, stdout } = run(['npm', 'whoami'], { silent: true })
	if (!ok) fmt.die('Not authenticated with npm. Run `npm login` first.')
	fmt.ok(`Authenticated with npm as ${stdout}`)
	return stdout
}

export function checkGitDiff(): void {
	const { ok } = run(['git', 'diff', '--check', 'HEAD'], { silent: true })
	if (!ok) fmt.die('git diff --check failed (whitespace issues).')
	fmt.ok('git diff --check passed')
}

export function hasFlag(flag: string): boolean {
	return process.argv.includes(flag)
}
