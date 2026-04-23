import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Hono } from 'hono'
import type { AppEnv, Services } from '../src/api/app'
import { tasks as tasksRoute } from '../src/api/routes/tasks'
import type { Actor } from '../src/auth/types'
import { type CompanyDbResult, createCompanyDb } from '../src/db'
import { RunService } from '../src/services/runs'
import { TaskRelationService } from '../src/services/task-relations'
import { TaskService } from '../src/services/tasks'
import { WorkflowEngine } from '../src/services/workflow-engine'

let testDir: string
let dbResult: CompanyDbResult
let taskService: TaskService
let runService: RunService
let taskRelationService: TaskRelationService
let workflowEngine: WorkflowEngine
let app: Hono<AppEnv>

beforeAll(async () => {
	testDir = join(tmpdir(), `autopilot-task-project-scope-${Date.now()}`)
	await mkdir(testDir, { recursive: true })
	dbResult = await createCompanyDb(testDir)
	taskService = new TaskService(dbResult.db)
	runService = new RunService(dbResult.db)
	taskRelationService = new TaskRelationService(dbResult.db)
	workflowEngine = new WorkflowEngine(
		{
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
				[
					'dev',
					{
						id: 'dev',
						name: 'Developer',
						role: 'developer',
						description: '',
						model: null,
						provider: null,
						variant: null,
						capability_profiles: [],
					},
				],
			]),
			workflows: new Map([
				[
					'simple',
					{
						id: 'simple',
						name: 'Simple',
						description: '',
						steps: [
							{
								id: 'implement',
								type: 'agent',
								agent_id: 'dev',
								instructions: 'Implement',
								actions: [],
								approvers: [],
							},
							{
								id: 'done',
								type: 'done',
								agent_id: null,
								instructions: null,
								actions: [],
								approvers: [],
							},
						],
					},
				],
			]),
			environments: new Map(),
			providers: new Map(),
			capabilityProfiles: new Map(),
			defaults: { runtime: 'claude-code', workflow: 'simple', task_assignee: 'dev' },
		},
		taskService,
		runService,
	)

	app = new Hono<AppEnv>()
	app.use('*', async (c, next) => {
		c.set('services', {
			taskService,
			runService,
			taskRelationService,
			workflowEngine,
		} as unknown as Services)
		c.set('actor', { type: 'user', id: 'test-user' } as Actor)
		await next()
	})
	app.route('/api/tasks', tasksRoute)
})

afterAll(async () => {
	dbResult.raw.close()
	await rm(testDir, { recursive: true, force: true })
})

describe('task project_id scoping', () => {
	test('filters tasks by project_id', async () => {
		await taskService.create({
			id: 'task-proj-a',
			title: 'Task A',
			type: 'feature',
			project_id: 'proj-a',
			created_by: 'test',
		})
		await taskService.create({
			id: 'task-proj-b',
			title: 'Task B',
			type: 'feature',
			project_id: 'proj-b',
			created_by: 'test',
		})

		const res = await app.request('http://localhost/api/tasks?project_id=proj-a')
		expect(res.status).toBe(200)
		const body = (await res.json()) as Array<{ id: string; project_id: string | null }>
		expect(body).toHaveLength(1)
		expect(body[0]).toMatchObject({ id: 'task-proj-a', project_id: 'proj-a' })
	})

	test('materializeTask propagates project_id into runs', async () => {
		const result = await workflowEngine.materializeTask({
			title: 'Scoped task',
			type: 'feature',
			project_id: 'proj-scoped',
			created_by: 'test',
		})
		expect(result).toBeDefined()
		expect(result?.task.project_id).toBe('proj-scoped')
		expect(result?.runId).toBeTruthy()

		const run = await runService.get(result!.runId!)
		expect(run?.project_id).toBe('proj-scoped')
	})
})
