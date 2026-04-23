import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Hono } from 'hono'
import { createCompanyDb, type CompanyDbResult, type CompanyDb } from '../src/db'
import { runs as runsRoute } from '../src/api/routes/runs'
import { RunService } from '../src/services/runs'
import type { AppEnv, Services } from '../src/api/app'

function buildTestApp(companyRoot: string, db: CompanyDb, services: Services) {
	const app = new Hono<AppEnv>()

	app.use('*', async (c, next) => {
		c.set('companyRoot', companyRoot)
		c.set('db', db)
		c.set('auth', {} as never)
		c.set('services', services)
		c.set('authoredConfig', {
			company: {} as never,
			agents: new Map(),
			workflows: new Map(),
			environments: new Map(),
			providers: new Map(),
			capabilityProfiles: new Map(),
			skills: new Map(),
			context: new Map(),
			defaults: { runtime: 'claude-code' },
		})
		c.set('actor', null)
		c.set('workerId', null)
		c.set('orchestratorUrl', undefined)
		c.set('indexDbRaw', null)
		await next()
	})

	app.route('/api/runs', runsRoute)
	return app
}

describe('runs stream replay cursoring', () => {
	const companyRoot = join(tmpdir(), `qp-run-stream-${Date.now()}`)
	let dbResult: CompanyDbResult
	let runService: RunService
	let app: ReturnType<typeof buildTestApp>

	beforeAll(async () => {
		await mkdir(companyRoot, { recursive: true })
		dbResult = await createCompanyDb(companyRoot)
		runService = new RunService(dbResult.db)

		const services = {
			runService,
			taskService: {} as never,
			workerService: {} as never,
			enrollmentService: {} as never,
			activityService: {} as never,
			artifactService: {} as never,
			conversationBindingService: {} as never,
			taskRelationService: {} as never,
			taskGraphService: {} as never,
			workflowEngine: {} as never,
			secretService: {} as never,
			queryService: {} as never,
			sessionService: {} as never,
			sessionMessageService: {} as never,
			scheduleService: {} as never,
			vfsService: {} as never,
			scriptService: {} as never,
			userPreferenceService: {} as never,
		} satisfies Services

		app = buildTestApp(companyRoot, dbResult.db, services)
	})

	afterAll(async () => {
		dbResult.raw.close()
		await rm(companyRoot, { recursive: true, force: true })
	})

	async function createCompletedRun() {
		const runId = `run-stream-${Date.now()}`
		await runService.create({
			id: runId,
			agent_id: 'agent-1',
			runtime: 'claude-code',
			initiated_by: 'test',
			instructions: 'stream replay test',
		})
		const first = await runService.appendEvent(runId, {
			type: 'progress',
			summary: 'first event',
		})
		const second = await runService.appendEvent(runId, {
			type: 'artifact',
			summary: 'preview ready',
			metadata: JSON.stringify({ preview_url: 'https://example.test/preview', kind: 'preview_url' }),
		})
		await runService.complete(runId, { status: 'completed', summary: 'done' })
		return { runId, first: first!, second: second! }
	}

	test('replays only unseen persisted events after Last-Event-ID', async () => {
		const { runId, first, second } = await createCompletedRun()

		const res = await app.request(`/api/runs/${runId}/stream`, {
			headers: { 'Last-Event-ID': String(first.id) },
		})
		expect(res.status).toBe(200)
		const text = await res.text()

		expect(text).not.toContain('first event')
		expect(text).toContain(`id: ${second.id}`)
		expect(text).toContain('preview ready')
		expect(text).toContain('https://example.test/preview')
		expect(text).toContain('"type":"run_completed"')
		expect(text).toContain('"summary":"done"')
	})

	test('still emits terminal completion when no unseen run events remain', async () => {
		const { runId, second } = await createCompletedRun()

		const res = await app.request(`/api/runs/${runId}/stream`, {
			headers: { 'Last-Event-ID': String(second.id) },
		})
		expect(res.status).toBe(200)
		const text = await res.text()

		expect(text).not.toContain('"type":"run_event"')
		expect(text).toContain('"type":"run_completed"')
		expect(text).toContain('"summary":"done"')
	})
})
