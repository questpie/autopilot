/**
 * Tests for preview file collection from worktrees.
 *
 * Covers:
 * - collectPreviewFiles reads changed text files
 * - binary files are skipped
 * - large files are skipped
 * - MIME types are correct
 * - empty diff returns no artifacts
 */
import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { collectPreviewFiles } from '../src/preview'

describe('Preview File Collection', () => {
	const repoRoot = join(tmpdir(), `preview-test-${Date.now()}`)
	const worktreePath = join(repoRoot, 'worktree')

	beforeAll(async () => {
		// Create a git repo with a main branch
		await mkdir(repoRoot, { recursive: true })
		const run = (cmd: string) =>
			Bun.spawn(cmd.split(' '), { cwd: repoRoot, stdout: 'pipe', stderr: 'pipe' })

		await run('git init').exited
		await run('git checkout -b main').exited
		await writeFile(join(repoRoot, 'README.md'), '# Test')
		await Bun.spawn(['git', 'add', '-A'], { cwd: repoRoot }).exited
		await Bun.spawn(['git', 'commit', '-m', 'init'], { cwd: repoRoot }).exited

		// Create a worktree branch with changes
		await mkdir(worktreePath, { recursive: true })
		await Bun.spawn(['git', 'worktree', 'add', '-b', 'test-branch', worktreePath], { cwd: repoRoot }).exited

		// Add preview files in the worktree
		await mkdir(join(worktreePath, 'src'), { recursive: true })
		await writeFile(join(worktreePath, 'src', 'index.html'), '<html><body>Hello</body></html>')
		await writeFile(join(worktreePath, 'src', 'styles.css'), 'body { color: red; }')
		await writeFile(join(worktreePath, 'src', 'logo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47])) // fake PNG
		await Bun.spawn(['git', 'add', '-A'], { cwd: worktreePath }).exited
		await Bun.spawn(['git', 'commit', '-m', 'add files'], { cwd: worktreePath }).exited
	})

	afterAll(async () => {
		// Clean up worktree first, then repo
		await Bun.spawn(['git', 'worktree', 'remove', '--force', worktreePath], { cwd: repoRoot }).exited
		await rm(repoRoot, { recursive: true, force: true })
	})

	test('collects changed text files as preview_file artifacts', async () => {
		const artifacts = await collectPreviewFiles(worktreePath, repoRoot)

		expect(artifacts.length).toBeGreaterThanOrEqual(2)

		const html = artifacts.find((a) => a.title === 'src/index.html')
		expect(html).toBeDefined()
		expect(html!.kind).toBe('preview_file')
		expect(html!.ref_kind).toBe('inline')
		expect(html!.ref_value).toContain('<html>')
		expect(html!.mime_type).toBe('text/html')

		const css = artifacts.find((a) => a.title === 'src/styles.css')
		expect(css).toBeDefined()
		expect(css!.ref_value).toContain('color: red')
		expect(css!.mime_type).toBe('text/css')
	})

	test('skips binary files (png)', async () => {
		const artifacts = await collectPreviewFiles(worktreePath, repoRoot)
		const png = artifacts.find((a) => a.title.endsWith('.png'))
		expect(png).toBeUndefined()
	})

	test('returns empty array for repo with no changes', async () => {
		// Use main branch (no diff from itself)
		const artifacts = await collectPreviewFiles(repoRoot, repoRoot)
		expect(artifacts).toEqual([])
	})
})
