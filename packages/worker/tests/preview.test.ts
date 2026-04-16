/**
 * Tests for preview file collection from worktrees.
 *
 * Covers:
 * - collectPreviewFiles reads changed browser-previewable files
 * - non-previewable extensions (.ts, .md, .txt) are excluded
 * - binary files are skipped
 * - large files are skipped
 * - MIME types are correct
 * - empty diff returns no artifacts
 */
import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { collectPreviewFiles, collectPreviewDir } from '../src/preview'

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

	test('collects binary previewable files (png) as base64', async () => {
		const artifacts = await collectPreviewFiles(worktreePath, repoRoot)
		const png = artifacts.find((a) => a.title.endsWith('.png'))
		expect(png).toBeDefined()
		expect(png!.kind).toBe('preview_file')
		expect(png!.ref_kind).toBe('base64')
		expect(png!.mime_type).toBe('image/png')
	})

	test('excludes non-previewable extensions (.ts, .md, .txt)', async () => {
		// Add non-previewable source files to the worktree
		await writeFile(join(worktreePath, 'src', 'app.ts'), 'export const x = 1')
		await writeFile(join(worktreePath, 'src', 'notes.md'), '# Notes')
		await writeFile(join(worktreePath, 'src', 'readme.txt'), 'readme text')
		await Bun.spawn(['git', 'add', '-A'], { cwd: worktreePath }).exited
		await Bun.spawn(['git', 'commit', '-m', 'add non-previewable files'], { cwd: worktreePath }).exited

		const artifacts = await collectPreviewFiles(worktreePath, repoRoot)

		// .ts, .md, .txt should NOT be collected
		expect(artifacts.find((a) => a.title.endsWith('.ts'))).toBeUndefined()
		expect(artifacts.find((a) => a.title.endsWith('.md'))).toBeUndefined()
		expect(artifacts.find((a) => a.title.endsWith('.txt'))).toBeUndefined()

		// .html and .css should still be collected
		expect(artifacts.find((a) => a.title.endsWith('.html'))).toBeDefined()
		expect(artifacts.find((a) => a.title.endsWith('.css'))).toBeDefined()
	})

	test('returns empty array for repo with no changes', async () => {
		// Use main branch (no diff from itself)
		const artifacts = await collectPreviewFiles(repoRoot, repoRoot)
		expect(artifacts).toEqual([])
	})
})

describe('collectPreviewDir', () => {
	const dirRoot = join(tmpdir(), `preview-dir-test-${Date.now()}`)

	beforeAll(async () => {
		await mkdir(dirRoot, { recursive: true })
	})

	afterAll(async () => {
		await rm(dirRoot, { recursive: true, force: true })
	})

	test('expands directory into preview_file artifacts', async () => {
		const dir = join(dirRoot, 'basic')
		await mkdir(dir, { recursive: true })
		await writeFile(join(dir, 'index.html'), '<html>Hello</html>')
		await writeFile(join(dir, 'styles.css'), 'body{color:red}')
		await writeFile(join(dir, 'app.js'), 'console.log("hi")')

		const result = await collectPreviewDir(dir)

		expect(result.files.length).toBe(3)
		for (const f of result.files) {
			expect(f.kind).toBe('preview_file')
		}

		const html = result.files.find((f) => f.title === 'index.html')
		expect(html).toBeDefined()
		expect(html!.mime_type).toBe('text/html')

		const css = result.files.find((f) => f.title === 'styles.css')
		expect(css).toBeDefined()
		expect(css!.mime_type).toBe('text/css')

		const js = result.files.find((f) => f.title === 'app.js')
		expect(js).toBeDefined()
		expect(js!.mime_type).toBe('text/javascript')
	})

	test('preserves nested paths', async () => {
		const dir = join(dirRoot, 'nested')
		await mkdir(join(dir, 'sub'), { recursive: true })
		await writeFile(join(dir, 'sub', 'page.html'), '<html>Nested</html>')

		const result = await collectPreviewDir(dir)
		const nested = result.files.find((f) => f.title === 'sub/page.html')
		expect(nested).toBeDefined()
		expect(nested!.kind).toBe('preview_file')
	})

	test('binary files become ref_kind base64', async () => {
		const dir = join(dirRoot, 'binary')
		await mkdir(dir, { recursive: true })
		const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
		await writeFile(join(dir, 'logo.png'), pngBytes)

		const result = await collectPreviewDir(dir)
		expect(result.files.length).toBe(1)

		const png = result.files[0]!
		expect(png.ref_kind).toBe('base64')
		expect(png.mime_type).toBe('image/png')
		expect(Buffer.from(png.ref_value, 'base64')).toEqual(pngBytes)
	})

	test('skips excluded directories', async () => {
		const dir = join(dirRoot, 'excluded')
		await mkdir(join(dir, 'node_modules'), { recursive: true })
		await writeFile(join(dir, 'node_modules', 'lib.js'), 'module.exports = {}')
		await writeFile(join(dir, 'main.js'), 'console.log("main")')

		const result = await collectPreviewDir(dir)
		const titles = result.files.map((f) => f.title)
		expect(titles).not.toContain('node_modules/lib.js')
		expect(titles).toContain('main.js')
	})

	test('throws on file count limit', async () => {
		const dir = join(dirRoot, 'count-limit')
		await mkdir(dir, { recursive: true })
		for (const name of ['a.txt', 'b.txt', 'c.txt', 'd.txt', 'e.txt']) {
			await writeFile(join(dir, name), 'content')
		}

		expect(collectPreviewDir(dir, { maxFiles: 3 })).rejects.toThrow(/file count limit/)
	})

	test('throws on total size limit', async () => {
		const dir = join(dirRoot, 'total-limit')
		await mkdir(dir, { recursive: true })
		await writeFile(join(dir, 'big.txt'), 'x'.repeat(1024))

		expect(collectPreviewDir(dir, { maxTotalSize: 100 })).rejects.toThrow(/total size limit/)
	})

	test('throws on individual file size limit', async () => {
		const dir = join(dirRoot, 'file-limit')
		await mkdir(dir, { recursive: true })
		await writeFile(join(dir, 'big.txt'), 'x'.repeat(1024))

		expect(collectPreviewDir(dir, { maxFileSize: 100 })).rejects.toThrow(/exceeds size limit/)
	})

	test('empty directory returns empty files array', async () => {
		const dir = join(dirRoot, 'empty')
		await mkdir(dir, { recursive: true })

		const result = await collectPreviewDir(dir)
		expect(result.files.length).toBe(0)
		expect(result.metadata.file_count).toBe(0)
	})

	test('metadata includes source_dir and file_count', async () => {
		const dir = join(dirRoot, 'basic') // reuse from first test

		const result = await collectPreviewDir(dir)
		expect(result.metadata.source_dir).toBe(dir)
		expect(result.metadata.file_count).toBe(3)
		expect(result.metadata.total_size).toBeGreaterThan(0)
	})

	test('entry option is passed through in metadata', async () => {
		const dir = join(dirRoot, 'basic') // reuse from first test

		const result = await collectPreviewDir(dir, { entry: 'index.html' })
		expect(result.metadata.entry).toBe('index.html')
	})
})
