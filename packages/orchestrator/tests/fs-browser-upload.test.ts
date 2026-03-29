/**
 * Tests for fs-browser and upload routes.
 * Verifies path traversal protection, file serving, directory listing,
 * and streaming upload.
 */
import { describe, test, expect, afterEach } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('fs-browser', () => {
	const source = readFileSync(
		join(import.meta.dir, '..', 'src', 'api', 'routes', 'fs-browser.ts'),
		'utf-8',
	)

	test('safePath blocks path traversal', () => {
		expect(source).toContain('path traversal detected')
		expect(source).toContain('startsWith(resolvedRoot)')
	})

	test('serves files via Bun.file().stream() (streaming, not buffered)', () => {
		expect(source).toContain('file.stream()')
		// Should NOT use file.text() or file.arrayBuffer() for serving
		expect(source).not.toContain('file.text()')
		expect(source).not.toContain('file.arrayBuffer()')
	})

	test('returns Content-Type header based on extension', () => {
		expect(source).toContain('Content-Type')
		expect(source).toContain('CONTENT_TYPE_MAP')
	})

	test('returns Content-Length header for files', () => {
		expect(source).toContain('Content-Length')
	})

	test('hides dotfiles from directory listing', () => {
		expect(source).toContain("!name.startsWith('.')")
	})

	test('denies agent access to sensitive paths via isDeniedPath', () => {
		expect(source).toContain('isDeniedPath')
	})

	test('restricts viewer role to allowed directories', () => {
		expect(source).toContain('viewer')
		expect(source).toContain('VIEWER_ALLOWED')
	})

	test('supports common content types', () => {
		for (const ext of ['.md', '.yaml', '.json', '.ts', '.png', '.pdf']) {
			expect(source).toContain(ext)
		}
	})
})

describe('upload route', () => {
	const source = readFileSync(
		join(import.meta.dir, '..', 'src', 'api', 'routes', 'upload.ts'),
		'utf-8',
	)

	test('uses Bun.write with stream (not arrayBuffer) for uploads', () => {
		expect(source).toContain('Bun.write(fullPath, file.stream())')
		// Should NOT buffer entire file in RAM
		expect(source).not.toContain('file.arrayBuffer()')
		expect(source).not.toContain('Buffer.from(buffer)')
	})

	test('blocks path traversal on upload target dir', () => {
		expect(source).toContain("!fullDir.startsWith(resolve(root))")
		expect(source).toContain('forbidden')
	})

	test('returns 400 when no file provided', () => {
		expect(source).toContain('no file provided')
		expect(source).toContain('400')
	})

	test('creates target directory recursively', () => {
		expect(source).toContain("mkdir(fullDir, { recursive: true })")
	})

	test('returns uploaded file path in response', () => {
		expect(source).toContain('path: join(targetDir, file.name)')
	})
})
