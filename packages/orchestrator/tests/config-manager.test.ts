/**
 * Tests for ConfigManager — hot reload with atomic swap and validation.
 *
 * Covers:
 * - Unit: get(), status(), reload() success/failure, onReload callback, object identity
 * - Integration: worker claim picks up reloaded workflow workspace_mode
 * - Integration: conversation/provider lookup uses reloaded config
 */
import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Hono } from 'hono'
import { ConfigManager } from '../src/config/config-manager'
import type { AuthoredConfig } from '../src/services/workflow-engine'
import type { CompanyScope, Workflow, Provider } from '@questpie/autopilot-spec'
import { createCompanyDb, type CompanyDbResult, type CompanyDb } from '../src/db'
import {
	TaskService, RunService, WorkerService, EnrollmentService, WorkflowEngine,
	ActivityService, ArtifactService, ConversationBindingService, TaskRelationService,
	TaskGraphService, SecretService, QueryService, SessionMessageService,
} from '../src/services'
import type { AppEnv, Services } from '../src/api/app'
import type { Actor } from '../src/auth/types'
import { workers as workersRoute } from '../src/api/routes/workers'
import { conversations as conversationsRoute } from '../src/api/routes/conversations'

// ─── Helpers ──────────────────────────────────────────────────────────────

function makeConfig(overrides?: Partial<AuthoredConfig>): AuthoredConfig {
	return {
		company: { name: 'Test', slug: 'test', defaults: { runtime: 'claude-code' } } as CompanyScope,
		agents: new Map(),
		workflows: new Map(),
		environments: new Map(),
		providers: new Map(),
		capabilityProfiles: new Map(),
		skills: new Map(),
		context: new Map(),
		defaults: { runtime: 'claude-code' },
		queues: {},
		...overrides,
	}
}

let testDir: string

beforeAll(async () => {
	testDir = join(tmpdir(), `config-manager-test-${Date.now()}`)
	await mkdir(testDir, { recursive: true })
})

afterAll(async () => {
	await rm(testDir, { recursive: true, force: true })
})

// ─── Tests ────────────────────────────────────────────────────────────────

describe('ConfigManager', () => {
	test('get() returns initial config', () => {
		const config = makeConfig()
		const cm = new ConfigManager(config, { companyRoot: testDir })
		expect(cm.get()).toBe(config)
	})

	test('status() reflects initial state', () => {
		const config = makeConfig()
		const cm = new ConfigManager(config, { companyRoot: testDir })
		const status = cm.status()
		expect(status.lastReloadAt).toBeNull()
		expect(status.lastError).toBeNull()
		expect(status.reloadCount).toBe(0)
	})

	test('reload() with valid config swaps fields atomically', async () => {
		// Set up a minimal .autopilot/company.yaml
		const autopilotDir = join(testDir, '.autopilot')
		await mkdir(autopilotDir, { recursive: true })
		await writeFile(
			join(autopilotDir, 'company.yaml'),
			'name: ReloadedCompany\nslug: reloaded\ndefaults:\n  runtime: claude-code\n',
		)

		const config = makeConfig()
		const cm = new ConfigManager(config, { companyRoot: testDir })

		const result = await cm.reload()
		expect(result.ok).toBe(true)
		expect(result.error).toBeUndefined()

		// Config should be updated
		expect(cm.get().company.name).toBe('ReloadedCompany')
		expect(cm.get().company.slug).toBe('reloaded')

		// Status should reflect success
		expect(cm.status().lastReloadAt).not.toBeNull()
		expect(cm.status().lastError).toBeNull()
		expect(cm.status().reloadCount).toBe(1)
	})

	test('reload() preserves old config on failure', async () => {
		// Set up an invalid company.yaml that will fail Zod validation
		const badDir = join(testDir, 'bad-config-' + Date.now())
		const badAutopilotDir = join(badDir, '.autopilot')
		await mkdir(badAutopilotDir, { recursive: true })
		await writeFile(
			join(badAutopilotDir, 'company.yaml'),
			'invalid: [yaml: that: breaks: parsing: {{{\n',
		)

		const config = makeConfig()
		const originalName = config.company.name
		const cm = new ConfigManager(config, { companyRoot: badDir })

		const result = await cm.reload()
		expect(result.ok).toBe(false)
		expect(result.error).toBeDefined()

		// Original config should be preserved
		expect(cm.get().company.name).toBe(originalName)

		// Status should reflect failure
		expect(cm.status().lastError).not.toBeNull()
		expect(cm.status().reloadCount).toBe(0)
	})

	test('reload() invokes onReload callback on success', async () => {
		const autopilotDir = join(testDir, '.autopilot')
		await mkdir(autopilotDir, { recursive: true })
		await writeFile(
			join(autopilotDir, 'company.yaml'),
			'name: CallbackTest\nslug: callback\ndefaults:\n  runtime: claude-code\n',
		)

		let callbackCalled = false
		const config = makeConfig()
		const cm = new ConfigManager(config, {
			companyRoot: testDir,
			onReload: () => { callbackCalled = true },
		})

		await cm.reload()
		expect(callbackCalled).toBe(true)
	})

	test('reload() does NOT invoke onReload callback on failure', async () => {
		// Set up an invalid company.yaml
		const badDir = join(testDir, 'bad-callback-' + Date.now())
		const badAutopilotDir = join(badDir, '.autopilot')
		await mkdir(badAutopilotDir, { recursive: true })
		await writeFile(
			join(badAutopilotDir, 'company.yaml'),
			'invalid: [yaml: that: breaks: {{{\n',
		)

		let callbackCalled = false
		const config = makeConfig()
		const cm = new ConfigManager(config, {
			companyRoot: badDir,
			onReload: () => { callbackCalled = true },
		})

		await cm.reload()
		expect(callbackCalled).toBe(false)
	})

	test('same object reference is mutated (existing holders see updates)', async () => {
		const autopilotDir = join(testDir, '.autopilot')
		await mkdir(autopilotDir, { recursive: true })
		await writeFile(
			join(autopilotDir, 'company.yaml'),
			'name: MutationTest\nslug: mutation\ndefaults:\n  runtime: claude-code\n',
		)

		const config = makeConfig()
		const holderRef = config // simulate a consumer holding a reference

		const cm = new ConfigManager(config, { companyRoot: testDir })
		await cm.reload()

		// The holder's reference should see the new values
		expect(holderRef.company.name).toBe('MutationTest')
		expect(holderRef).toBe(cm.get())
	})

	test('reload() includes skills field', async () => {
		const autopilotDir = join(testDir, '.autopilot')
		await mkdir(autopilotDir, { recursive: true })
		await writeFile(
			join(autopilotDir, 'company.yaml'),
			'name: SkillsTest\nslug: skills\ndefaults:\n  runtime: claude-code\n',
		)

		const config = makeConfig({
			skills: new Map([['old-skill', { id: 'old-skill', name: 'Old', description: '', path: '/fake', content: '' }]]),
		})

		const cm = new ConfigManager(config, { companyRoot: testDir })
		await cm.reload()

		// After reload from disk (no skills files), skills should be empty
		expect(cm.get().skills.size).toBe(0)
	})

	test('stop() cleans up watchers', () => {
		const config = makeConfig()
		const cm = new ConfigManager(config, { companyRoot: testDir })
		// Should not throw
		cm.stop()
		cm.stop() // idempotent
	})

	test('successive reloads increment counter', async () => {
		const autopilotDir = join(testDir, '.autopilot')
		await mkdir(autopilotDir, { recursive: true })
		await writeFile(
			join(autopilotDir, 'company.yaml'),
			'name: CountTest\nslug: count\ndefaults:\n  runtime: claude-code\n',
		)

		const config = makeConfig()
		const cm = new ConfigManager(config, { companyRoot: testDir })

		await cm.reload()
		await cm.reload()
		await cm.reload()

		expect(cm.status().reloadCount).toBe(3)
	})
})

// ─── Integration: worker claim picks up reloaded workflow config ─────────

const FAKE_ACTOR: Actor = { id: 'test-user', type: 'human', name: 'Test', role: 'owner', source: 'api' }

function post(body: unknown): RequestInit {
	return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

describe('integration: worker claim after config reload', () => {
	let intDir: string
	let dbResult: CompanyDbResult
	let authoredConfig: AuthoredConfig
	let services: Services
	let app: InstanceType<typeof Hono<AppEnv>>

	beforeAll(async () => {
		intDir = join(tmpdir(), `config-reload-int-${Date.now()}`)
		await mkdir(intDir, { recursive: true })

		process.env.AUTOPILOT_MASTER_KEY = '0'.repeat(64)
		dbResult = await createCompanyDb(intDir)
		const db = dbResult.db

		// Start with a workflow that has NO workspace mode
		const wfNoWorkspace: Workflow = {
			id: 'dev-flow',
			name: 'Dev Flow',
			description: 'test workflow',
			steps: [
				{ id: 'work', type: 'agent', agent_id: 'dev', instructions: 'Do work' },
				{ id: 'done', type: 'done' },
			],
		}

		authoredConfig = makeConfig({
			agents: new Map([['dev', { id: 'dev', name: 'Dev', role: 'developer', triggers: [] } as any]]),
			workflows: new Map([['dev-flow', wfNoWorkspace]]),
			defaults: { runtime: 'test-rt', workflow: 'dev-flow', task_assignee: 'dev' },
		})

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

		const workflowEngine = new WorkflowEngine(authoredConfig, taskService, runService, activityService, artifactService)
		const taskGraphService = new TaskGraphService(taskService, taskRelationService, workflowEngine)
		workflowEngine.setChildRollupFn((tid, rel) => taskGraphService.childRollup(tid, rel))

		services = {
			taskService, runService, workerService, enrollmentService,
			activityService, artifactService, conversationBindingService,
			taskRelationService, taskGraphService, workflowEngine,
			secretService, queryService,
			sessionMessageService: new SessionMessageService(db),
		}

		app = new Hono<AppEnv>()
		app.use('*', async (c, next) => {
			c.set('companyRoot', intDir)
			c.set('db', db)
			c.set('auth', {} as never)
			c.set('services', services)
			c.set('authoredConfig', authoredConfig)
			c.set('orchestratorUrl', 'http://localhost:7778')
			c.set('indexDbRaw', null)
			c.set('actor', FAKE_ACTOR)
			c.set('workerId', null)
			await next()
		})
		app.route('/api/workers', workersRoute)
	})

	afterAll(async () => {
		dbResult.raw.close()
		await rm(intDir, { recursive: true, force: true })
		delete process.env.AUTOPILOT_MASTER_KEY
	})

	test('claimed run reflects workspace_mode change after config reload', async () => {
		const ts = Date.now()
		const workerId = `worker-reload-${ts}`
		const runtime = 'test-rt'

		// Register worker
		await app.request('/api/workers/register', post({
			id: workerId,
			capabilities: [{ runtime, models: [], maxConcurrent: 2, tags: [] }],
		}))

		// Create task 1 and intake — workflow has NO workspace mode
		const taskId1 = `task-before-reload-${ts}`
		await services.taskService.create({ id: taskId1, title: 'Before reload', type: 'feature', created_by: 'test' })
		await services.workflowEngine.intake(taskId1)

		// Claim run 1 — workspace_mode should be null
		const claim1Res = await app.request('/api/workers/claim', post({ worker_id: workerId, runtime }))
		expect(claim1Res.status).toBe(200)
		const claim1 = await claim1Res.json() as any
		expect(claim1.run).not.toBeNull()
		expect(claim1.run.workspace_mode).toBeNull()

		// ── SIMULATE CONFIG RELOAD ──
		// Mutate the shared authoredConfig to add workspace.mode
		authoredConfig.workflows.set('dev-flow', {
			id: 'dev-flow',
			name: 'Dev Flow',
			description: 'test workflow',
			workspace: { mode: 'isolated_worktree' },
			steps: [
				{ id: 'work', type: 'agent', agent_id: 'dev', instructions: 'Do work' },
				{ id: 'done', type: 'done' },
			],
		})

		// Create task 2 — same workflow but config now has workspace mode
		const taskId2 = `task-after-reload-${ts}`
		await services.taskService.create({ id: taskId2, title: 'After reload', type: 'feature', created_by: 'test' })
		await services.workflowEngine.intake(taskId2)

		// Claim run 2 — should reflect the reloaded workspace_mode
		const claim2Res = await app.request('/api/workers/claim', post({ worker_id: workerId, runtime }))
		expect(claim2Res.status).toBe(200)
		const claim2 = await claim2Res.json() as any
		expect(claim2.run).not.toBeNull()
		expect(claim2.run.workspace_mode).toBe('isolated_worktree')
	})
})

// ─── Integration: conversation/provider lookup uses reloaded config ──────

describe('integration: provider lookup after config reload', () => {
	let intDir2: string
	let dbResult2: CompanyDbResult
	let authoredConfig2: AuthoredConfig
	let services2: Services
	let app2: InstanceType<typeof Hono<AppEnv>>

	beforeAll(async () => {
		intDir2 = join(tmpdir(), `config-provider-int-${Date.now()}`)
		await mkdir(intDir2, { recursive: true })

		process.env.AUTOPILOT_MASTER_KEY = '0'.repeat(64)
		dbResult2 = await createCompanyDb(intDir2)
		const db = dbResult2.db

		// Start with NO providers
		authoredConfig2 = makeConfig({
			agents: new Map([['dev', { id: 'dev', name: 'Dev', role: 'developer', triggers: [] } as any]]),
			defaults: { runtime: 'test-rt', task_assignee: 'dev' },
		})

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

		const workflowEngine = new WorkflowEngine(authoredConfig2, taskService, runService, activityService, artifactService)
		const taskGraphService = new TaskGraphService(taskService, taskRelationService, workflowEngine)
		workflowEngine.setChildRollupFn((tid, rel) => taskGraphService.childRollup(tid, rel))

		services2 = {
			taskService, runService, workerService, enrollmentService,
			activityService, artifactService, conversationBindingService,
			taskRelationService, taskGraphService, workflowEngine,
			secretService, queryService,
			sessionMessageService: new SessionMessageService(db),
		}

		app2 = new Hono<AppEnv>()
		app2.use('*', async (c, next) => {
			c.set('companyRoot', intDir2)
			c.set('db', db)
			c.set('auth', {} as never)
			c.set('services', services2)
			c.set('authoredConfig', authoredConfig2)
			c.set('orchestratorUrl', 'http://localhost:7778')
			c.set('indexDbRaw', null)
			c.set('actor', FAKE_ACTOR)
			c.set('workerId', null)
			await next()
		})
		app2.route('/api/conversations', conversationsRoute)
	})

	afterAll(async () => {
		dbResult2.raw.close()
		await rm(intDir2, { recursive: true, force: true })
		delete process.env.AUTOPILOT_MASTER_KEY
	})

	test('conversation binding fails before provider added, succeeds after config reload', async () => {
		// Try creating a binding — should fail because provider doesn't exist yet
		const res1 = await app2.request('/api/conversations/bindings', post({
			provider_id: 'telegram-bot',
			external_conversation_id: 'chat-123',
			mode: 'intent_intake',
		}))
		expect(res1.status).toBe(404)

		// ── SIMULATE CONFIG RELOAD: add a conversation_channel provider ──
		const telegramProvider: Provider = {
			id: 'telegram-bot',
			name: 'Telegram Bot',
			kind: 'conversation_channel',
			handler: { type: 'shell', command: 'echo' },
			events: ['task_completed'],
			secret_refs: [],
			metadata: {},
		}
		authoredConfig2.providers.set('telegram-bot', telegramProvider)

		// Now the same binding request should succeed
		const res2 = await app2.request('/api/conversations/bindings', post({
			provider_id: 'telegram-bot',
			external_conversation_id: 'chat-456',
			mode: 'intent_intake',
		}))
		expect(res2.status).toBe(201)
		const binding = await res2.json() as any
		expect(binding.provider_id).toBe('telegram-bot')
	})
})
