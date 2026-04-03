/**
 * Tests for intent intake V1.
 *
 * Covers:
 * - IntakeResultSchema validation (task.create and noop)
 * - Intake route materializes task through standard path
 * - Noop result returns 200 with no side effects
 * - Invalid handler output is rejected
 * - Provider kind validation (must be intent_channel)
 * - Missing capability validation
 * - Example text-intake handler works end to end
 */
import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Hono } from 'hono'
import {
	IntakeResultSchema,
	IntakeTaskInputSchema,
} from '@questpie/autopilot-spec'
import type { Provider } from '@questpie/autopilot-spec'
import { createCompanyDb, type CompanyDbResult } from '../src/db'
import { TaskService, RunService, WorkflowEngine, ActivityService, ArtifactService } from '../src/services'
import type { AuthoredConfig } from '../src/services'
import type { AppEnv, Services } from '../src/api/app'
import type { Actor } from '../src/auth/types'
import { intake } from '../src/api/routes/intake'
import { invokeProvider } from '../src/providers/handler-runtime'

// ─── Schema Tests ────────────────────────────────────────────────────────────

describe('IntakeResult Schema', () => {
	test('validates task.create action', () => {
		const result = IntakeResultSchema.safeParse({
			action: 'task.create',
			input: {
				title: 'Build landing page',
				type: 'feature',
				priority: 'high',
			},
		})
		expect(result.success).toBe(true)
	})

	test('validates noop action', () => {
		const result = IntakeResultSchema.safeParse({
			action: 'noop',
			reason: 'Empty text',
		})
		expect(result.success).toBe(true)
	})

	test('validates noop without reason', () => {
		const result = IntakeResultSchema.safeParse({ action: 'noop' })
		expect(result.success).toBe(true)
	})

	test('rejects unknown action', () => {
		const result = IntakeResultSchema.safeParse({
			action: 'unknown.action',
		})
		expect(result.success).toBe(false)
	})

	test('rejects task.create without title', () => {
		const result = IntakeResultSchema.safeParse({
			action: 'task.create',
			input: { type: 'feature' },
		})
		expect(result.success).toBe(false)
	})

	test('rejects task.create without type', () => {
		const result = IntakeResultSchema.safeParse({
			action: 'task.create',
			input: { title: 'Something' },
		})
		expect(result.success).toBe(false)
	})

	test('accepts task.create with all optional fields', () => {
		const result = IntakeResultSchema.safeParse({
			action: 'task.create',
			input: {
				title: 'Full task',
				type: 'bug',
				description: 'Detailed description',
				priority: 'critical',
				assigned_to: 'dev',
				workflow_id: 'bugfix',
				metadata: { source: 'slack', channel: '#ops' },
			},
		})
		expect(result.success).toBe(true)
	})
})

// ─── Intake Route Tests ──────────────────────────────────────────────────────

describe('Intake Route', () => {
	const companyRoot = join(tmpdir(), `qp-intake-${Date.now()}`)
	let dbResult: CompanyDbResult

	const FAKE_ACTOR: Actor = {
		id: 'test-user',
		type: 'human',
		name: 'Test User',
		role: 'owner',
		source: 'api',
	}

	// Handlers
	const TASK_CREATE_HANDLER = `const input = await Bun.stdin.text()
const envelope = JSON.parse(input)
console.log(JSON.stringify({
  ok: true,
  metadata: {
    action: 'task.create',
    input: {
      title: envelope.payload.text,
      type: 'feature',
    },
  },
}))`

	const NOOP_HANDLER = `console.log(JSON.stringify({
  ok: true,
  metadata: { action: 'noop', reason: 'Not actionable' },
}))`

	const BAD_RESULT_HANDLER = `console.log(JSON.stringify({
  ok: true,
  metadata: { action: 'invalid_action' },
}))`

	const FAILING_HANDLER = `console.log(JSON.stringify({ ok: false, error: 'Handler crashed' }))`

	function makeProvider(id: string, handler: string, kind: string = 'intent_channel', ops: string[] = ['intent.ingest']): Provider {
		return {
			id,
			name: id,
			kind: kind as any,
			handler,
			capabilities: ops.map((op) => ({ op })),
			events: [],
			config: {},
			secret_refs: [],
			description: '',
		}
	}

	function buildApp(providers: Map<string, Provider>, services: Services) {
		const authoredConfig: AuthoredConfig = {
			company: { name: 'test', slug: 'test', description: '', timezone: 'UTC', language: 'en', owner: { name: '', email: '' }, defaults: {} },
			agents: new Map(),
			workflows: new Map(),
			environments: new Map(),
			providers,
			defaults: { runtime: 'claude-code' },
		}

		const app = new Hono<AppEnv>()
		app.use('*', async (c, next) => {
			c.set('companyRoot', companyRoot)
			c.set('db', dbResult.db)
			c.set('auth', {} as never)
			c.set('services', services)
			c.set('authoredConfig', authoredConfig)
			c.set('actor', FAKE_ACTOR)
			c.set('workerId', null)
			await next()
		})
		app.route('/api/intake', intake)
		return app
	}

	function post(body: unknown): RequestInit {
		return {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		}
	}

	beforeAll(async () => {
		await mkdir(join(companyRoot, '.autopilot', 'handlers'), { recursive: true })
		await writeFile(join(companyRoot, '.autopilot', 'company.yaml'), 'name: test\nslug: test\n')

		// Write handlers
		await writeFile(join(companyRoot, '.autopilot', 'handlers', 'task-create.ts'), TASK_CREATE_HANDLER)
		await writeFile(join(companyRoot, '.autopilot', 'handlers', 'noop.ts'), NOOP_HANDLER)
		await writeFile(join(companyRoot, '.autopilot', 'handlers', 'bad-result.ts'), BAD_RESULT_HANDLER)
		await writeFile(join(companyRoot, '.autopilot', 'handlers', 'failing.ts'), FAILING_HANDLER)

		dbResult = await createCompanyDb(companyRoot)
	})

	afterAll(async () => {
		dbResult.raw.close()
		await rm(companyRoot, { recursive: true, force: true })
	})

	test('materializes task.create into a real task', async () => {
		const providers = new Map([
			['test-intake', makeProvider('test-intake', 'handlers/task-create.ts')],
		])
		const taskService = new TaskService(dbResult.db)
		const runService = new RunService(dbResult.db)
		const workflowEngine = new WorkflowEngine(
			{ company: {} as any, agents: new Map(), workflows: new Map(), environments: new Map(), providers, defaults: { runtime: 'claude-code' } },
			taskService, runService,
		)
		const services: Services = {
			taskService, runService,
			workerService: {} as any,
			enrollmentService: {} as any,
			activityService: new ActivityService(dbResult.db),
			artifactService: new ArtifactService(dbResult.db),
			workflowEngine,
		}

		const app = buildApp(providers, services)
		const res = await app.request(
			'/api/intake/test-intake',
			post({ text: 'Implement landing page for Acme' }),
		)

		expect(res.status).toBe(201)
		const body = await res.json() as any
		expect(body.action).toBe('task.created')
		expect(body.task).toBeDefined()
		expect(body.task.title).toBe('Implement landing page for Acme')
		expect(body.task.type).toBe('feature')

		// Verify task exists in DB
		const dbTask = await taskService.get(body.task.id)
		expect(dbTask).toBeDefined()
		expect(dbTask!.title).toBe('Implement landing page for Acme')
		expect(dbTask!.created_by).toBe('provider:test-intake')
	})

	test('returns noop for non-actionable payload', async () => {
		const providers = new Map([
			['noop-provider', makeProvider('noop-provider', 'handlers/noop.ts')],
		])
		const services: Services = {
			taskService: new TaskService(dbResult.db),
			runService: new RunService(dbResult.db),
			workerService: {} as any,
			enrollmentService: {} as any,
			activityService: new ActivityService(dbResult.db),
			artifactService: new ArtifactService(dbResult.db),
			workflowEngine: {} as any,
		}

		const app = buildApp(providers, services)
		const res = await app.request(
			'/api/intake/noop-provider',
			post({ text: '' }),
		)

		expect(res.status).toBe(200)
		const body = await res.json() as any
		expect(body.action).toBe('noop')
		expect(body.reason).toBe('Not actionable')
	})

	test('rejects invalid handler output', async () => {
		const providers = new Map([
			['bad-handler', makeProvider('bad-handler', 'handlers/bad-result.ts')],
		])
		const services: Services = {
			taskService: new TaskService(dbResult.db),
			runService: new RunService(dbResult.db),
			workerService: {} as any,
			enrollmentService: {} as any,
			activityService: new ActivityService(dbResult.db),
			artifactService: new ArtifactService(dbResult.db),
			workflowEngine: {} as any,
		}

		const app = buildApp(providers, services)
		const res = await app.request(
			'/api/intake/bad-handler',
			post({ text: 'test' }),
		)

		expect(res.status).toBe(502)
		const body = await res.json() as any
		expect(body.error).toContain('invalid intake result')
	})

	test('returns 502 when handler fails', async () => {
		const providers = new Map([
			['fail-provider', makeProvider('fail-provider', 'handlers/failing.ts')],
		])
		const services: Services = {
			taskService: new TaskService(dbResult.db),
			runService: new RunService(dbResult.db),
			workerService: {} as any,
			enrollmentService: {} as any,
			activityService: new ActivityService(dbResult.db),
			artifactService: new ArtifactService(dbResult.db),
			workflowEngine: {} as any,
		}

		const app = buildApp(providers, services)
		const res = await app.request(
			'/api/intake/fail-provider',
			post({ text: 'test' }),
		)

		expect(res.status).toBe(502)
		const body = await res.json() as any
		expect(body.error).toContain('Handler failed')
	})

	test('returns 404 for unknown provider', async () => {
		const services: Services = {
			taskService: new TaskService(dbResult.db),
			runService: new RunService(dbResult.db),
			workerService: {} as any,
			enrollmentService: {} as any,
			activityService: new ActivityService(dbResult.db),
			artifactService: new ArtifactService(dbResult.db),
			workflowEngine: {} as any,
		}

		const app = buildApp(new Map(), services)
		const res = await app.request(
			'/api/intake/nonexistent',
			post({ text: 'test' }),
		)

		expect(res.status).toBe(404)
	})

	test('rejects notification_channel provider for intake', async () => {
		const providers = new Map([
			['notif', makeProvider('notif', 'handlers/noop.ts', 'notification_channel')],
		])
		const services: Services = {
			taskService: new TaskService(dbResult.db),
			runService: new RunService(dbResult.db),
			workerService: {} as any,
			enrollmentService: {} as any,
			activityService: new ActivityService(dbResult.db),
			artifactService: new ArtifactService(dbResult.db),
			workflowEngine: {} as any,
		}

		const app = buildApp(providers, services)
		const res = await app.request(
			'/api/intake/notif',
			post({ text: 'test' }),
		)

		expect(res.status).toBe(400)
		const body = await res.json() as any
		expect(body.error).toContain('not an intent_channel')
	})

	test('rejects provider without intent.ingest capability', async () => {
		const providers = new Map([
			['no-cap', makeProvider('no-cap', 'handlers/noop.ts', 'intent_channel', ['notify.send'])],
		])
		const services: Services = {
			taskService: new TaskService(dbResult.db),
			runService: new RunService(dbResult.db),
			workerService: {} as any,
			enrollmentService: {} as any,
			activityService: new ActivityService(dbResult.db),
			artifactService: new ArtifactService(dbResult.db),
			workflowEngine: {} as any,
		}

		const app = buildApp(providers, services)
		const res = await app.request(
			'/api/intake/no-cap',
			post({ text: 'test' }),
		)

		expect(res.status).toBe(400)
		const body = await res.json() as any
		expect(body.error).toContain('does not support intent.ingest')
	})
})

// ─── Example Handler E2E ─────────────────────────────────────────────────────

describe('Text Intake Handler E2E', () => {
	const testRoot = join(tmpdir(), `qp-text-intake-e2e-${Date.now()}`)

	beforeAll(async () => {
		await mkdir(join(testRoot, '.autopilot', 'handlers'), { recursive: true })

		// Copy the real text-intake handler
		const handlerSrc = await Bun.file(
			join(import.meta.dir, '..', '..', '..', '.autopilot', 'handlers', 'text-intake.ts'),
		).text()
		await writeFile(join(testRoot, '.autopilot', 'handlers', 'text-intake.ts'), handlerSrc)
	})

	afterAll(async () => {
		await rm(testRoot, { recursive: true, force: true })
	})

	const provider: Provider = {
		id: 'text-intake',
		name: 'Text Intake',
		kind: 'intent_channel',
		handler: 'handlers/text-intake.ts',
		capabilities: [{ op: 'intent.ingest' }],
		events: [],
		config: { default_type: 'feature' },
		secret_refs: [],
		description: '',
	}

	test('converts text into task.create action', async () => {
		const result = await invokeProvider(
			provider,
			'intent.ingest',
			{ text: 'Implement dark mode for the dashboard' },
			{ companyRoot: testRoot },
		)

		expect(result.ok).toBe(true)
		const intake = IntakeResultSchema.parse(result.metadata)
		expect(intake.action).toBe('task.create')
		if (intake.action === 'task.create') {
			expect(intake.input.title).toBe('Implement dark mode for the dashboard')
			expect(intake.input.type).toBe('feature')
		}
	})

	test('returns noop for empty text', async () => {
		const result = await invokeProvider(
			provider,
			'intent.ingest',
			{ text: '' },
			{ companyRoot: testRoot },
		)

		expect(result.ok).toBe(true)
		const intake = IntakeResultSchema.parse(result.metadata)
		expect(intake.action).toBe('noop')
	})

	test('uses payload type override', async () => {
		const result = await invokeProvider(
			provider,
			'intent.ingest',
			{ text: 'Fix broken login', type: 'bug', priority: 'critical' },
			{ companyRoot: testRoot },
		)

		expect(result.ok).toBe(true)
		const intake = IntakeResultSchema.parse(result.metadata)
		expect(intake.action).toBe('task.create')
		if (intake.action === 'task.create') {
			expect(intake.input.type).toBe('bug')
			expect(intake.input.priority).toBe('critical')
		}
	})

	test('includes source provider in metadata', async () => {
		const result = await invokeProvider(
			provider,
			'intent.ingest',
			{ text: 'Add search feature' },
			{ companyRoot: testRoot },
		)

		expect(result.ok).toBe(true)
		const intake = IntakeResultSchema.parse(result.metadata)
		if (intake.action === 'task.create') {
			expect(intake.input.metadata).toBeDefined()
			expect((intake.input.metadata as any).source_provider).toBe('text-intake')
		}
	})
})
