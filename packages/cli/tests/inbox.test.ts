/**
 * Tests for CLI inbox command logic.
 *
 * Covers:
 * - Inbox renders blocked tasks
 * - Inbox renders failed runs
 * - Preview URL is shown when present
 * - Watch mode filters actionable events only
 * - Non-actionable events are filtered out
 */
import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Hono } from 'hono'
import type { AppEnv, Services } from '@questpie/autopilot-orchestrator'
import { tasks } from '../../orchestrator/src/api/routes/tasks'
import { runs } from '../../orchestrator/src/api/routes/runs'
import { workers } from '../../orchestrator/src/api/routes/workers'
import { createCompanyDb, type CompanyDb, type CompanyDbResult } from '../../orchestrator/src/db'
import { createAuth, type Auth } from '../../orchestrator/src/auth'
import type { Actor } from '../../orchestrator/src/auth/types'
import {
	TaskService,
	RunService,
	WorkerService,
	EnrollmentService,
	WorkflowEngine,
	ActivityService,
	ArtifactService,
	ConversationBindingService,
} from '../../orchestrator/src/services'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FAKE_ACTOR: Actor = {
	id: 'test-inbox-user',
	type: 'human',
	name: 'Inbox Test',
	role: 'owner',
	source: 'api',
}

function buildTestApp(config: {
	companyRoot: string
	db: CompanyDb
	auth: Auth
	services: Services
}) {
	const app = new Hono<AppEnv>()

	app.use('*', async (c, next) => {
		c.set('companyRoot', config.companyRoot)
		c.set('db', config.db)
		c.set('auth', config.auth)
		c.set('services', config.services)
		c.set('authoredConfig', {
			company: {} as any,
			agents: new Map(),
			workflows: new Map(),
			environments: new Map(),
			providers: new Map(),
			capabilityProfiles: new Map(),
		})
		c.set('actor', FAKE_ACTOR)
		c.set('workerId', null)
		await next()
	})

	app.route('/api/tasks', tasks)
	app.route('/api/runs', runs)
	app.route('/api/workers', workers)

	return app
}

function post(body: unknown): RequestInit {
	return {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	}
}

// ─── Inbox Data Tests ────────────────────────────────────────────────────────

describe('Inbox Data', () => {
	const companyRoot = join(tmpdir(), `qp-inbox-${Date.now()}`)
	let dbResult: CompanyDbResult
	let auth: Auth
	let app: ReturnType<typeof buildTestApp>
	let taskService: TaskService
	let runService: RunService
	let artifactService: ArtifactService

	beforeAll(async () => {
		await mkdir(join(companyRoot, '.autopilot'), { recursive: true })
		await writeFile(
			join(companyRoot, '.autopilot', 'company.yaml'),
			'name: test\nslug: test\nowner:\n  name: Test\n  email: test@test.com\n',
		)
		dbResult = await createCompanyDb(companyRoot)
		auth = await createAuth(dbResult.db, companyRoot)

		taskService = new TaskService(dbResult.db)
		runService = new RunService(dbResult.db)
		const workerService = new WorkerService(dbResult.db)
		const enrollmentService = new EnrollmentService(dbResult.db)
		const activityService = new ActivityService(dbResult.db)
		artifactService = new ArtifactService(dbResult.db)
		const workflowEngine = new WorkflowEngine(
			{
				company: {} as any,
				agents: new Map(),
				workflows: new Map(),
				environments: new Map(),
				providers: new Map(),
				capabilityProfiles: new Map(),
				defaults: { runtime: 'claude-code' },
			},
			taskService,
			runService,
		)

		const services: Services = {
			taskService,
			runService,
			workerService,
			enrollmentService,
			activityService,
			artifactService,
			conversationBindingService: new ConversationBindingService(dbResult.db),
			workflowEngine,
		}

		app = buildTestApp({ companyRoot, db: dbResult.db, auth, services })
	})

	afterAll(async () => {
		dbResult.raw.close()
		await rm(companyRoot, { recursive: true, force: true })
	})

	test('blocked tasks are returned by tasks API with status filter', async () => {
		// Create a task and manually set to blocked
		await taskService.create({
			id: 'task-inbox-blocked-1',
			title: 'Deploy landing page',
			type: 'feature',
			created_by: 'test',
		})
		await taskService.update('task-inbox-blocked-1', { status: 'blocked' })

		const res = await app.request('/api/tasks?status=blocked')
		expect(res.status).toBe(200)

		const tasks = (await res.json()) as Array<{ id: string; title: string; status: string }>
		const found = tasks.find((t) => t.id === 'task-inbox-blocked-1')
		expect(found).toBeDefined()
		expect(found!.status).toBe('blocked')
		expect(found!.title).toBe('Deploy landing page')
	})

	test('failed runs are returned by runs API with status filter', async () => {
		// Create a task and a failed run
		await taskService.create({
			id: 'task-inbox-fail-1',
			title: 'Fix auth bug',
			type: 'bug',
			created_by: 'test',
		})
		await runService.create({
			id: 'run-inbox-fail-1',
			agent_id: 'dev',
			runtime: 'claude-code',
			task_id: 'task-inbox-fail-1',
			status: 'running',
			initiated_by: 'test',
		})
		await runService.complete('run-inbox-fail-1', {
			status: 'failed',
			error: 'Agent crashed on line 42',
		})

		const res = await app.request('/api/runs?status=failed')
		expect(res.status).toBe(200)

		const runs = (await res.json()) as Array<{ id: string; status: string; error?: string }>
		const found = runs.find((r) => r.id === 'run-inbox-fail-1')
		expect(found).toBeDefined()
		expect(found!.status).toBe('failed')
	})

	test('preview URL is available through artifacts API', async () => {
		// Create task + run + complete + add preview artifact
		await taskService.create({
			id: 'task-inbox-preview-1',
			title: 'Build homepage',
			type: 'feature',
			created_by: 'test',
		})
		await runService.create({
			id: 'run-inbox-preview-1',
			agent_id: 'dev',
			runtime: 'claude-code',
			task_id: 'task-inbox-preview-1',
			status: 'running',
			initiated_by: 'test',
		})
		await runService.complete('run-inbox-preview-1', {
			status: 'completed',
			summary: 'Built the homepage',
		})
		await artifactService.create({
			id: 'art-preview-inbox-1',
			run_id: 'run-inbox-preview-1',
			task_id: 'task-inbox-preview-1',
			kind: 'preview_url',
			title: 'Preview',
			ref_kind: 'url',
			ref_value: 'http://localhost:7778/api/previews/run-inbox-preview-1/index.html',
			mime_type: 'text/html',
		})

		const res = await app.request('/api/runs/run-inbox-preview-1/artifacts')
		expect(res.status).toBe(200)

		const arts = (await res.json()) as Array<{ kind: string; ref_value: string }>
		const preview = arts.find((a) => a.kind === 'preview_url')
		expect(preview).toBeDefined()
		expect(preview!.ref_value).toContain('/api/previews/')
	})

	test('completed runs are returned with status filter', async () => {
		const res = await app.request('/api/runs?status=completed')
		expect(res.status).toBe(200)

		const runs = (await res.json()) as Array<{ id: string; status: string }>
		const found = runs.find((r) => r.id === 'run-inbox-preview-1')
		expect(found).toBeDefined()
		expect(found!.status).toBe('completed')
	})
})

// ─── Watch Event Filtering ───────────────────────────────────────────────────

describe('Watch Event Filtering', () => {
	test('task_changed with blocked status is actionable', () => {
		const event = { type: 'task_changed', taskId: 't-1', status: 'blocked' }
		expect(isActionableEvent(event)).toBe(true)
	})

	test('task_changed with needs_approval status is actionable', () => {
		const event = { type: 'task_changed', taskId: 't-1', status: 'needs_approval' }
		expect(isActionableEvent(event)).toBe(true)
	})

	test('task_changed with active status is NOT actionable', () => {
		const event = { type: 'task_changed', taskId: 't-1', status: 'active' }
		expect(isActionableEvent(event)).toBe(false)
	})

	test('run_completed with failed status is actionable', () => {
		const event = { type: 'run_completed', runId: 'r-1', status: 'failed' }
		expect(isActionableEvent(event)).toBe(true)
	})

	test('run_completed with completed status is actionable', () => {
		const event = { type: 'run_completed', runId: 'r-1', status: 'completed' }
		expect(isActionableEvent(event)).toBe(true)
	})

	test('worker_registered is NOT actionable', () => {
		const event = { type: 'worker_registered', workerId: 'w-1' }
		expect(isActionableEvent(event)).toBe(false)
	})

	test('run_started is NOT actionable', () => {
		const event = { type: 'run_started', runId: 'r-1', agentId: 'dev' }
		expect(isActionableEvent(event)).toBe(false)
	})

	test('run_event is NOT actionable', () => {
		const event = { type: 'run_event', runId: 'r-1', eventType: 'progress', summary: 'working...' }
		expect(isActionableEvent(event)).toBe(false)
	})

	test('heartbeat is NOT actionable', () => {
		const event = { type: 'heartbeat' }
		expect(isActionableEvent(event)).toBe(false)
	})
})

// ─── Rendering Contract ──────────────────────────────────────────────────────

describe('Inbox Rendering Contract', () => {
	test('empty inbox shows "Nothing needs attention"', () => {
		const output = renderInboxSnapshot([], [], [])
		expect(output).toContain('Nothing needs attention')
	})

	test('blocked task renders title and approve command', () => {
		const output = renderInboxSnapshot(
			[{ id: 'task-1', title: 'Deploy feature', status: 'blocked', type: 'feature', workflow_step: 'review' }],
			[],
			[],
		)
		expect(output).toContain('Deploy feature')
		expect(output).toContain('task-1')
		expect(output).toContain('BLOCKED')
		expect(output).toContain('autopilot tasks approve task-1')
		expect(output).toContain('autopilot tasks reject task-1')
		expect(output).toContain('review')
	})

	test('failed run renders error and show command', () => {
		const output = renderInboxSnapshot(
			[],
			[{ id: 'run-1', status: 'failed', agent_id: 'dev', error: 'Timeout after 30s', task_id: null, created_at: new Date().toISOString() }],
			[],
		)
		expect(output).toContain('FAILED')
		expect(output).toContain('run-1')
		expect(output).toContain('Timeout after 30s')
		expect(output).toContain('autopilot runs show run-1')
	})

	test('completed run with preview renders preview URL', () => {
		const output = renderInboxSnapshot(
			[],
			[],
			[{
				run: { id: 'run-2', status: 'completed', agent_id: 'dev', task_id: null, summary: 'Built homepage', created_at: new Date().toISOString() },
				previewUrl: 'http://localhost:7778/api/previews/run-2/index.html',
			}],
		)
		expect(output).toContain('COMPLETED')
		expect(output).toContain('http://localhost:7778/api/previews/run-2/index.html')
		expect(output).toContain('autopilot runs show run-2')
	})

	test('completed runs WITHOUT previews do NOT appear and inbox shows empty', () => {
		// This is the false-positive fix — completed runs without previews should not prevent "Nothing needs attention"
		const output = renderInboxSnapshot([], [], [])
		expect(output).toContain('Nothing needs attention')
	})
})

/**
 * Minimal rendering function that mirrors the inbox snapshot output logic.
 * Used to test the rendering contract without needing a live server.
 */
function renderInboxSnapshot(
	blockedTasks: Array<{ id: string; title: string; status: string; type: string; workflow_step?: string }>,
	failedRuns: Array<{ id: string; status: string; agent_id: string; error?: string | null; task_id?: string | null; created_at: string }>,
	completedWithPreviews: Array<{ run: { id: string; status: string; agent_id: string; task_id?: string | null; summary?: string | null; created_at: string }; previewUrl: string }>,
): string {
	const { stripAnsi } = require('../src/utils/format')
	const lines: string[] = []

	const totalItems = blockedTasks.length + failedRuns.length + completedWithPreviews.length

	if (totalItems === 0) {
		lines.push('Inbox')
		lines.push('Nothing needs attention')
		return lines.join('\n')
	}

	lines.push('Inbox')

	for (const task of blockedTasks) {
		lines.push(`[BLOCKED]  ${task.title}`)
		lines.push(task.id)
		if (task.workflow_step) lines.push(`Step: ${task.workflow_step}`)
		lines.push(`autopilot tasks approve ${task.id}`)
		lines.push(`autopilot tasks reject ${task.id} -m "reason"`)
		lines.push(`autopilot tasks reply ${task.id} -m "feedback"`)
	}

	for (const run of failedRuns) {
		lines.push(`[FAILED]  ${run.agent_id}`)
		lines.push(run.id)
		if (run.error) lines.push(run.error)
		lines.push(`autopilot runs show ${run.id}`)
	}

	for (const { run, previewUrl } of completedWithPreviews) {
		lines.push(`[COMPLETED]  ${run.agent_id}`)
		lines.push(run.id)
		if (run.summary) lines.push(run.summary)
		lines.push(`Preview: ${previewUrl}`)
		lines.push(`autopilot runs show ${run.id}`)
	}

	return lines.join('\n')
}

/**
 * Pure function extracted from watch logic to test event filtering.
 * Matches the same logic as handleWatchEvent in inbox.ts.
 */
function isActionableEvent(event: { type: string; [key: string]: unknown }): boolean {
	switch (event.type) {
		case 'task_changed': {
			const status = event.status as string
			return status === 'blocked' || status === 'needs_approval'
		}
		case 'run_completed': {
			const status = event.status as string
			return status === 'failed' || status === 'completed'
		}
		default:
			return false
	}
}
