import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Hono } from 'hono'
import type { AppEnv, Services } from '../src/api/app'
import { knowledgeRoute } from '../src/api/routes/knowledge'
import { searchRoute } from '../src/api/routes/search'
import type { Actor } from '../src/auth/types'
import { type CompanyDbResult, type IndexDbResult, createCompanyDb, createIndexDb } from '../src/db'
import { BlobStore } from '../src/services/blob-store'
import { KnowledgeService } from '../src/services/knowledge'

let testDir: string
let dbResult: CompanyDbResult
let indexResult: IndexDbResult
let knowledgeService: KnowledgeService
let app: Hono<AppEnv>

beforeAll(async () => {
	testDir = join(tmpdir(), `autopilot-knowledge-api-${Date.now()}`)
	await mkdir(testDir, { recursive: true })
	dbResult = await createCompanyDb(testDir)
	indexResult = await createIndexDb(testDir)
	const blobStore = new BlobStore(join(testDir, '.data'))
	knowledgeService = new KnowledgeService(dbResult.db, blobStore, indexResult.db)

	app = new Hono<AppEnv>()
	app.use('*', async (c, next) => {
		c.set('services', { knowledgeService } as unknown as Services)
		c.set('indexDbRaw', indexResult.raw)
		c.set('actor', { type: 'user', id: 'test-user' } as Actor)
		await next()
	})
	app.route('/api/knowledge', knowledgeRoute)
	app.route('/api/search', searchRoute)
})

afterAll(async () => {
	dbResult.raw.close()
	indexResult.raw.close()
	await rm(testDir, { recursive: true, force: true })
})

function req(method: string, path: string, body?: unknown) {
	const init: RequestInit = { method, headers: { 'Content-Type': 'application/json' } }
	if (body) init.body = JSON.stringify(body)
	return app.request(`http://localhost/api/knowledge${path}`, init)
}

describe('knowledge API', () => {
	test('writes, reads, lists, and deletes a company document', async () => {
		const write = await req('PUT', '/docs/setup.md', {
			content: '# Setup\nCompany handbook content',
			mime_type: 'text/markdown',
		})
		expect(write.status).toBe(200)
		const written = (await write.json()) as { path: string; content: string; blob_id: string }
		expect(written.path).toBe('docs/setup.md')
		expect(written.content).toContain('Company handbook')
		expect(written.blob_id).toStartWith('blob-')

		const read = await req('GET', '/docs/setup.md')
		expect(read.status).toBe(200)
		expect(((await read.json()) as { content: string }).content).toContain('Company handbook')

		const list = await req('GET', '?path=docs')
		expect(list.status).toBe(200)
		expect(((await list.json()) as Array<{ path: string }>).map((doc) => doc.path)).toContain(
			'docs/setup.md',
		)

		const del = await req('DELETE', '/docs/setup.md')
		expect(del.status).toBe(200)
		expect((await req('GET', '/docs/setup.md')).status).toBe(404)
	})

	test('project scope shadows company document at the same path', async () => {
		await req('PUT', '/docs/guide.md', { content: 'Company guide' })
		await req('PUT', '/docs/guide.md?scope_type=project&scope_id=project-a', {
			content: 'Project guide',
		})

		const projectRead = await req('GET', '/docs/guide.md?project_id=project-a')
		expect(((await projectRead.json()) as { content: string }).content).toBe('Project guide')

		const companyRead = await req('GET', '/docs/guide.md')
		expect(((await companyRead.json()) as { content: string }).content).toBe('Company guide')

		const visible = await req('GET', '?project_id=project-a')
		const paths = ((await visible.json()) as Array<{ path: string; scope_type: string }>).map(
			(doc) => `${doc.scope_type}:${doc.path}`,
		)
		expect(paths).toContain('company:docs/guide.md')
		expect(paths).toContain('project:docs/guide.md')
	})

	test('indexes text knowledge for global search scope', async () => {
		await req('PUT', '/docs/searchable.md', {
			content: 'Needle knowledge phrase',
			mime_type: 'text/markdown',
		})

		const res = await app.request('http://localhost/api/search?q=Needle&scope=knowledge')
		expect(res.status).toBe(200)
		const payload = (await res.json()) as { results: Array<{ entityType: string; title: string }> }
		expect(payload.results.some((result) => result.entityType === 'knowledge')).toBe(true)
	})
})
