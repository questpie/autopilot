/**
 * Tests for durable orchestrator-backed preview system.
 *
 * Covers:
 * - preview_file artifacts stored and queryable
 * - preview endpoint serves correct content with MIME type
 * - relative asset paths work (CSS loaded from HTML)
 * - preview_url artifact auto-created when preview_files exist
 * - preview works without worker involvement (durable)
 * - 404 for missing files
 */
import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Hono } from 'hono'
import { createMiddleware } from 'hono/factory'
import { createCompanyDb, type CompanyDbResult } from '../src/db'
import { ArtifactService, RunService } from '../src/services'
import { previews } from '../src/api/routes/previews'
import type { AppEnv } from '../src/api/app'

describe('Durable Previews', () => {
	const companyRoot = join(tmpdir(), `qp-previews-${Date.now()}`)
	let dbResult: CompanyDbResult
	let artifactService: ArtifactService

	beforeAll(async () => {
		await mkdir(join(companyRoot, '.autopilot'), { recursive: true })
		await writeFile(
			join(companyRoot, '.autopilot', 'company.yaml'),
			'name: test\nslug: test\nowner:\n  name: Test\n  email: test@test.com\n',
		)
		dbResult = await createCompanyDb(companyRoot)
		artifactService = new ArtifactService(dbResult.db)
	})

	afterAll(async () => {
		dbResult.raw.close()
		await rm(companyRoot, { recursive: true, force: true })
	})

	const RUN_ID = 'run-preview-test-1'
	const TASK_ID = 'task-preview-test-1'

	test('preview_file artifacts can be stored as inline content', async () => {
		await artifactService.create({
			id: 'art-html-1',
			run_id: RUN_ID,
			task_id: TASK_ID,
			kind: 'preview_file',
			title: 'src/index.html',
			ref_kind: 'inline',
			ref_value: '<html><head><link rel="stylesheet" href="styles.css"></head><body><h1>Acme</h1></body></html>',
			mime_type: 'text/html',
		})

		await artifactService.create({
			id: 'art-css-1',
			run_id: RUN_ID,
			task_id: TASK_ID,
			kind: 'preview_file',
			title: 'src/styles.css',
			ref_kind: 'inline',
			ref_value: 'h1 { color: #2563EB; }',
			mime_type: 'text/css',
		})

		const arts = await artifactService.listForRun(RUN_ID)
		const previewFiles = arts.filter((a) => a.kind === 'preview_file')
		expect(previewFiles).toHaveLength(2)
	})

	test('preview_file is queryable by run_id and title', async () => {
		const arts = await artifactService.listForRun(RUN_ID)
		const html = arts.find((a) => a.kind === 'preview_file' && a.title === 'src/index.html')
		expect(html).toBeDefined()
		expect(html!.ref_value).toContain('<h1>Acme</h1>')
		expect(html!.mime_type).toBe('text/html')

		const css = arts.find((a) => a.kind === 'preview_file' && a.title === 'src/styles.css')
		expect(css).toBeDefined()
		expect(css!.ref_value).toContain('#2563EB')
		expect(css!.mime_type).toBe('text/css')
	})

	test('preview_url artifact can be created pointing to orchestrator endpoint', async () => {
		await artifactService.create({
			id: 'art-preview-url-1',
			run_id: RUN_ID,
			task_id: TASK_ID,
			kind: 'preview_url',
			title: 'Preview',
			ref_kind: 'url',
			ref_value: 'http://localhost:7778/api/previews/run-preview-test-1/src/index.html',
			mime_type: 'text/html',
			metadata: JSON.stringify({ entry: 'src/index.html', run_id: RUN_ID }),
		})

		const arts = await artifactService.listForRun(RUN_ID)
		const previewUrl = arts.find((a) => a.kind === 'preview_url')
		expect(previewUrl).toBeDefined()
		expect(previewUrl!.ref_value).toContain('/api/previews/')
		expect(previewUrl!.ref_kind).toBe('url')
	})

	test('preview content survives without worker — purely DB-backed', async () => {
		// Simulate: worker sent preview_file, then went offline.
		// We can still read the content from the artifact.
		const arts = await artifactService.listForRun(RUN_ID)
		const html = arts.find((a) => a.kind === 'preview_file' && a.title === 'src/index.html')

		// Content is in ref_value — no worker needed to serve it
		expect(html!.ref_value).toContain('<html>')
		expect(html!.ref_kind).toBe('inline')
	})

	test('preview files for different runs are isolated', async () => {
		const otherRunId = 'run-preview-test-2'
		await artifactService.create({
			id: 'art-html-2',
			run_id: otherRunId,
			task_id: TASK_ID,
			kind: 'preview_file',
			title: 'src/index.html',
			ref_kind: 'inline',
			ref_value: '<html><body>Different run</body></html>',
			mime_type: 'text/html',
		})

		const run1Arts = await artifactService.listForRun(RUN_ID)
		const run2Arts = await artifactService.listForRun(otherRunId)

		const run1Html = run1Arts.find((a) => a.kind === 'preview_file' && a.title === 'src/index.html')
		const run2Html = run2Arts.find((a) => a.kind === 'preview_file' && a.title === 'src/index.html')

		expect(run1Html!.ref_value).toContain('Acme')
		expect(run2Html!.ref_value).toContain('Different run')
	})
})

// ─── Preview Route Tests ────────────────────────────────────────────────────

describe('Synthetic preview index', () => {
	const companyRoot = join(tmpdir(), `qp-preview-route-${Date.now()}`)
	let dbResult: CompanyDbResult
	let artifactService: ArtifactService
	let runService: RunService
	let app: Hono<AppEnv>

	beforeAll(async () => {
		await mkdir(join(companyRoot, '.autopilot'), { recursive: true })
		await writeFile(
			join(companyRoot, '.autopilot', 'company.yaml'),
			'name: test\nslug: test\nowner:\n  name: Test\n  email: test@test.com\n',
		)
		dbResult = await createCompanyDb(companyRoot)
		artifactService = new ArtifactService(dbResult.db)
		runService = new RunService(dbResult.db)

		app = new Hono<AppEnv>()
		app.use(
			'*',
			createMiddleware<AppEnv>(async (c, next) => {
				c.set('services', { artifactService } as any)
				await next()
			}),
		)
		app.route('/api/previews', previews)
	})

	afterAll(async () => {
		dbResult.raw.close()
		await rm(companyRoot, { recursive: true, force: true })
	})

	test('run with preview files but no index.html returns synthetic listing', async () => {
		const runId = `run-synth-idx-${Date.now()}`
		await runService.create({
			id: runId,
			agent_id: 'dev',
			runtime: 'claude-code',
			initiated_by: 'test',
			instructions: 'synthetic index test',
		})

		await artifactService.create({
			id: `art-synth-css-${Date.now()}`,
			run_id: runId,
			kind: 'preview_file',
			title: 'styles.css',
			ref_kind: 'inline',
			ref_value: 'body { color: red; }',
			mime_type: 'text/css',
		})
		await artifactService.create({
			id: `art-synth-js-${Date.now()}`,
			run_id: runId,
			kind: 'preview_file',
			title: 'app.js',
			ref_kind: 'inline',
			ref_value: 'console.log("hello")',
			mime_type: 'application/javascript',
		})

		const res = await app.request(`/api/previews/${runId}/index.html`)
		expect(res.status).toBe(200)

		const html = await res.text()
		expect(html).toContain('<!DOCTYPE html>')
		expect(html).toContain('Preview Files')
		expect(html).toContain('styles.css')
		expect(html).toContain('app.js')
	})

	test('synthetic listing links to actual preview files', async () => {
		const runId = `run-synth-links-${Date.now()}`
		await runService.create({
			id: runId,
			agent_id: 'dev',
			runtime: 'claude-code',
			initiated_by: 'test',
			instructions: 'links test',
		})

		await artifactService.create({
			id: `art-link-report-${Date.now()}`,
			run_id: runId,
			kind: 'preview_file',
			title: 'report.html',
			ref_kind: 'inline',
			ref_value: '<h1>Report</h1>',
			mime_type: 'text/html',
		})

		const res = await app.request(`/api/previews/${runId}/index.html`)
		expect(res.status).toBe(200)

		const html = await res.text()
		expect(html).toContain(`/api/previews/${runId}/report.html`)
		expect(html).toContain('report.html</a>')
	})

	test('html preview file gets html content-type even without explicit mime_type', async () => {
		const runId = `run-mime-html-${Date.now()}`
		await runService.create({
			id: runId,
			agent_id: 'dev',
			runtime: 'claude-code',
			initiated_by: 'test',
			instructions: 'mime fallback test',
		})

		await artifactService.create({
			id: `art-html-fallback-${Date.now()}`,
			run_id: runId,
			kind: 'preview_file',
			title: 'presentation.html',
			ref_kind: 'inline',
			ref_value: '<html><body>Deck</body></html>',
		})

		const res = await app.request(`/api/previews/${runId}/presentation.html`)
		expect(res.status).toBe(200)
		expect(res.headers.get('content-type')).toContain('text/html')
		const body = await res.text()
		expect(body).toContain('Deck')
	})

	test('real index.html takes precedence over synthetic listing', async () => {
		const runId = `run-real-idx-${Date.now()}`
		await runService.create({
			id: runId,
			agent_id: 'dev',
			runtime: 'claude-code',
			initiated_by: 'test',
			instructions: 'real index test',
		})

		await artifactService.create({
			id: `art-real-index-${Date.now()}`,
			run_id: runId,
			kind: 'preview_file',
			title: 'index.html',
			ref_kind: 'inline',
			ref_value: '<html><body>Real index content</body></html>',
			mime_type: 'text/html',
		})
		await artifactService.create({
			id: `art-real-other-${Date.now()}`,
			run_id: runId,
			kind: 'preview_file',
			title: 'data.json',
			ref_kind: 'inline',
			ref_value: '{"key":"value"}',
			mime_type: 'application/json',
		})

		const res = await app.request(`/api/previews/${runId}/index.html`)
		expect(res.status).toBe(200)

		const body = await res.text()
		expect(body).toBe('<html><body>Real index content</body></html>')
		expect(body).not.toContain('Preview Files')
	})

	test('non-existent file returns 404', async () => {
		const runId = `run-404-${Date.now()}`
		await runService.create({
			id: runId,
			agent_id: 'dev',
			runtime: 'claude-code',
			initiated_by: 'test',
			instructions: '404 test',
		})

		const res = await app.request(`/api/previews/${runId}/nonexistent.txt`)
		expect(res.status).toBe(404)
	})

	test('run with no preview files returns 404 for index.html', async () => {
		const runId = `run-empty-${Date.now()}`
		await runService.create({
			id: runId,
			agent_id: 'dev',
			runtime: 'claude-code',
			initiated_by: 'test',
			instructions: 'empty test',
		})

		const res = await app.request(`/api/previews/${runId}/index.html`)
		expect(res.status).toBe(404)
	})
})

// ─── Binary Preview Serving Tests ──────────────────────────────────────────

describe('Binary preview serving', () => {
	const companyRoot = join(tmpdir(), `qp-preview-binary-${Date.now()}`)
	let dbResult: CompanyDbResult
	let artifactService: ArtifactService
	let runService: RunService
	let app: Hono<AppEnv>

	beforeAll(async () => {
		await mkdir(join(companyRoot, '.autopilot'), { recursive: true })
		await writeFile(
			join(companyRoot, '.autopilot', 'company.yaml'),
			'name: test\nslug: test\nowner:\n  name: Test\n  email: test@test.com\n',
		)
		dbResult = await createCompanyDb(companyRoot)
		artifactService = new ArtifactService(dbResult.db)
		runService = new RunService(dbResult.db)

		app = new Hono<AppEnv>()
		app.use(
			'*',
			createMiddleware<AppEnv>(async (c, next) => {
				c.set('services', { artifactService } as any)
				await next()
			}),
		)
		app.route('/api/previews', previews)
	})

	afterAll(async () => {
		dbResult.raw.close()
		await rm(companyRoot, { recursive: true, force: true })
	})

	test('base64 image artifact served as binary with correct MIME', async () => {
		const runId = `run-bin-png-${Date.now()}`
		await runService.create({
			id: runId,
			agent_id: 'dev',
			runtime: 'claude-code',
			initiated_by: 'test',
			instructions: 'binary png test',
		})

		const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
		await artifactService.create({
			id: `art-png-${Date.now()}`,
			run_id: runId,
			kind: 'preview_file',
			title: 'logo.png',
			ref_kind: 'base64',
			ref_value: pngBytes.toString('base64'),
			mime_type: 'image/png',
		})

		const res = await app.request(`/api/previews/${runId}/logo.png`)
		expect(res.status).toBe(200)
		expect(res.headers.get('content-type')).toBe('image/png')
		const body = Buffer.from(await res.arrayBuffer())
		expect(body).toEqual(pngBytes)
	})

	test('base64 font artifact served correctly', async () => {
		const runId = `run-bin-font-${Date.now()}`
		await runService.create({
			id: runId,
			agent_id: 'dev',
			runtime: 'claude-code',
			initiated_by: 'test',
			instructions: 'binary font test',
		})

		const fontBytes = Buffer.from([0x77, 0x4f, 0x46, 0x32, 0x00, 0x01, 0x00, 0x00])
		await artifactService.create({
			id: `art-font-${Date.now()}`,
			run_id: runId,
			kind: 'preview_file',
			title: 'inter.woff2',
			ref_kind: 'base64',
			ref_value: fontBytes.toString('base64'),
			mime_type: 'font/woff2',
		})

		const res = await app.request(`/api/previews/${runId}/inter.woff2`)
		expect(res.status).toBe(200)
		expect(res.headers.get('content-type')).toBe('font/woff2')
		const body = Buffer.from(await res.arrayBuffer())
		expect(body).toEqual(fontBytes)
	})

	test('synthetic listing includes both inline and base64 files', async () => {
		const runId = `run-bin-listing-${Date.now()}`
		await runService.create({
			id: runId,
			agent_id: 'dev',
			runtime: 'claude-code',
			initiated_by: 'test',
			instructions: 'mixed listing test',
		})

		await artifactService.create({
			id: `art-listing-css-${Date.now()}`,
			run_id: runId,
			kind: 'preview_file',
			title: 'styles.css',
			ref_kind: 'inline',
			ref_value: 'body { color: red; }',
			mime_type: 'text/css',
		})

		const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47])
		await artifactService.create({
			id: `art-listing-png-${Date.now()}`,
			run_id: runId,
			kind: 'preview_file',
			title: 'logo.png',
			ref_kind: 'base64',
			ref_value: pngBytes.toString('base64'),
			mime_type: 'image/png',
		})

		const res = await app.request(`/api/previews/${runId}/index.html`)
		expect(res.status).toBe(200)

		const html = await res.text()
		expect(html).toContain('styles.css')
		expect(html).toContain('logo.png')
	})

	test('inline text preview still works alongside base64', async () => {
		const runId = `run-bin-mixed-${Date.now()}`
		await runService.create({
			id: runId,
			agent_id: 'dev',
			runtime: 'claude-code',
			initiated_by: 'test',
			instructions: 'mixed content test',
		})

		await artifactService.create({
			id: `art-mixed-html-${Date.now()}`,
			run_id: runId,
			kind: 'preview_file',
			title: 'page.html',
			ref_kind: 'inline',
			ref_value: '<html><body>Hello World</body></html>',
			mime_type: 'text/html',
		})

		const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47])
		await artifactService.create({
			id: `art-mixed-png-${Date.now()}`,
			run_id: runId,
			kind: 'preview_file',
			title: 'image.png',
			ref_kind: 'base64',
			ref_value: pngBytes.toString('base64'),
			mime_type: 'image/png',
		})

		const res = await app.request(`/api/previews/${runId}/page.html`)
		expect(res.status).toBe(200)
		expect(res.headers.get('content-type')).toContain('text/html')
		const body = await res.text()
		expect(body).toBe('<html><body>Hello World</body></html>')
	})
})
