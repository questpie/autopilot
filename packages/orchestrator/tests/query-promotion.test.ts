/**
 * Tests for query-to-task promotion (POST /queries/:id/promote).
 */
import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Hono } from 'hono'
import { createCompanyDb, type CompanyDbResult, type CompanyDb } from '../src/db'
import {
	TaskService,
	RunService,
	WorkerService,
	EnrollmentService,
	WorkflowEngine,
	ActivityService,
	ArtifactService,
	ConversationBindingService,
	TaskRelationService,
	TaskGraphService,
	SecretService,
	QueryService,
	SessionMessageService,
} from '../src/services'
import type { AppEnv, Services } from '../src/api/app'
import type { Actor } from '../src/auth/types'
import type { AuthoredConfig } from '../src/services'
import { queries as queriesRoute } from '../src/api/routes/queries'

const FAKE_ACTOR: Actor = {
	id: 'test-user',
	type: 'human',
	name: 'Test User',
	role: 'owner',
	source: 'api',
}

const DEFAULT_AUTHORED_CONFIG: AuthoredConfig = {
	company: {
		name: 'test',
		slug: 'test',
		description: '',
		timezone: 'UTC',
		language: 'en',
		owner: { name: 'Test', email: 'test@test.com' },
		defaults: {},
	},
	agents: new Map([
		['default-agent', {
			id: 'default-agent',
			name: 'Default Agent',
			role: 'You are a helpful assistant.',
			capability_profiles: [],
			triggers: [],
			fs_scope: { include: [], exclude: [] },
			secret_refs: [],
		}],
	]),
	workflows: new Map(),
	environments: new Map(),
	providers: new Map(),
	capabilityProfiles: new Map(),
	skills: new Map(),
	context: new Map(),
	defaults: { runtime: 'claude-code', task_assignee: 'default-agent' },
}

function buildTestApp(companyRoot: string, db: CompanyDb, services: Services) {
	const app = new Hono<AppEnv>()

	app.use('*', async (c, next) => {
		c.set('companyRoot', companyRoot)
		c.set('db', db)
		c.set('auth', {} as never)
		c.set('services', services)
		c.set('authoredConfig', DEFAULT_AUTHORED_CONFIG)
		c.set('actor', FAKE_ACTOR)
		c.set('workerId', null)
		await next()
	})

	app.route('/api/queries', queriesRoute)
	return app
}

function post(body: unknown): RequestInit {
	return {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	}
}

let testDir: string
let dbResult: CompanyDbResult
let app: ReturnType<typeof buildTestApp>
let services: Services

beforeAll(async () => {
	testDir = join(tmpdir(), `qp-promotion-test-${Date.now()}`)
	await mkdir(testDir, { recursive: true })

	process.env.AUTOPILOT_MASTER_KEY = '0'.repeat(64)
	dbResult = await createCompanyDb(testDir)
	const db = dbResult.db

	const taskService = new TaskService(db)
	const runService = new RunService(db)
	const workerService = new WorkerService(db)
	const enrollmentService = new EnrollmentService(db)
	const activityService = new ActivityService(db)
	const artifactService = new ArtifactService(db)
	const conversationBindingService = new ConversationBindingService(db)
	const taskRelationService = new TaskRelationService(db)
	const secretService = new SecretService(db)
	const queryService = new QueryService(db)

	const workflowEngine = new WorkflowEngine(
		DEFAULT_AUTHORED_CONFIG,
		taskService,
		runService,
		activityService,
		artifactService,
	)
	const taskGraphService = new TaskGraphService(taskService, taskRelationService, workflowEngine)
	workflowEngine.setChildRollupFn((tid, rel) => taskGraphService.childRollup(tid, rel))

	services = {
		taskService,
		runService,
		workerService,
		enrollmentService,
		activityService,
		artifactService,
		conversationBindingService,
		taskRelationService,
		taskGraphService,
		workflowEngine,
		secretService,
		queryService,
		sessionMessageService: new SessionMessageService(db),
	}

	app = buildTestApp(testDir, db, services)
})

afterAll(async () => {
	dbResult.raw.close()
	await rm(testDir, { recursive: true, force: true })
	delete process.env.AUTOPILOT_MASTER_KEY
})

describe('query-to-task promotion', () => {
	test('promotes a query to a task', async () => {
		// Create a query first
		const createRes = await app.request(
			'/api/queries',
			post({ prompt: 'test promotion', agent_id: 'default-agent', allow_repo_mutation: false }),
		)
		expect(createRes.status).toBe(201)
		const { query_id } = await createRes.json() as { query_id: string }

		// Promote it
		const promoteRes = await app.request(
			`/api/queries/${query_id}/promote`,
			post({ title: 'Promoted Task' }),
		)
		expect(promoteRes.status).toBe(201)
		const promoteBody = await promoteRes.json() as { query_id: string; task_id: string; run_id: string | null }
		expect(promoteBody.query_id).toBe(query_id)
		expect(promoteBody.task_id).toBeTruthy()

		// Verify promoted_task_id on query
		const getRes = await app.request(`/api/queries/${query_id}`)
		expect(getRes.status).toBe(200)
		const query = await getRes.json() as { promoted_task_id: string | null }
		expect(query.promoted_task_id).toBe(promoteBody.task_id)

		// Verify task context includes query origin
		const task = await services.taskService.get(promoteBody.task_id)
		expect(task).toBeDefined()
		const ctx = JSON.parse(task!.context ?? '{}')
		expect(ctx.promoted_from_query).toBe(query_id)
	})

	test('rejects double promotion with 409', async () => {
		// Create and promote a query
		const createRes = await app.request(
			'/api/queries',
			post({ prompt: 'double promote test', agent_id: 'default-agent', allow_repo_mutation: false }),
		)
		const { query_id } = await createRes.json() as { query_id: string }

		const first = await app.request(
			`/api/queries/${query_id}/promote`,
			post({ title: 'First Promotion' }),
		)
		expect(first.status).toBe(201)

		// Try promoting again
		const second = await app.request(
			`/api/queries/${query_id}/promote`,
			post({ title: 'Second Promotion' }),
		)
		expect(second.status).toBe(409)
		const body = await second.json() as { error: string; task_id: string }
		expect(body.error).toBe('query already promoted')
		expect(body.task_id).toBeTruthy()
	})

	test('returns 404 for nonexistent query', async () => {
		const res = await app.request(
			'/api/queries/nonexistent-query/promote',
			post({ title: 'Should Fail' }),
		)
		expect(res.status).toBe(404)
	})
})
