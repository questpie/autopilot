import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { configureContainer, container } from '../src/container'
import { storageFactory } from '../src/fs/sqlite-backend'
import type { StorageBackend } from '../src/fs/storage'
import { writeYaml } from '../src/fs/yaml'
import { Orchestrator } from '../src/server'
import { workflowRuntimeStoreFactory } from '../src/workflow'
import { createTestCompany } from './helpers'

describe('sub-workflow idempotency', () => {
	let companyRoot: string
	let cleanup: () => Promise<void>
	let orchestrator: Orchestrator
	let storage: StorageBackend
	let workflowRuntimeStore: Awaited<
		ReturnType<typeof container.resolveAsync<[typeof workflowRuntimeStoreFactory]>>
	>['workflowRuntimeStore']

	beforeEach(async () => {
		const tc = await createTestCompany()
		companyRoot = tc.root
		cleanup = tc.cleanup

		await writeYaml(join(companyRoot, 'company.yaml'), {
			name: 'Test Co',
			slug: 'test-co',
			description: 'Test company',
			timezone: 'UTC',
			language: 'en',
			languages: ['en'],
			owner: {
				name: 'Owner',
				email: 'owner@example.com',
				notification_channels: [],
			},
			settings: {},
		})

		await writeYaml(join(companyRoot, 'team', 'workflows', 'parent-flow.yaml'), {
			id: 'parent-flow',
			name: 'Parent Flow',
			steps: [
				{
					id: 'spawn-child',
					type: 'sub_workflow',
					description: 'Spawn the child workflow exactly once',
					executor: {
						kind: 'sub_workflow',
						workflow: 'child-flow',
					},
					spawn_workflow: {
						workflow: 'child-flow',
						input_map: { brief: 'task.title' },
						result_map: {},
						idempotency_key: '{{task.id}}:spawn-child',
					},
					transitions: { done: 'complete' },
				},
				{ id: 'complete', type: 'terminal' },
			],
		})

		await writeYaml(join(companyRoot, 'team', 'workflows', 'child-flow.yaml'), {
			id: 'child-flow',
			name: 'Child Flow',
			steps: [{ id: 'complete', type: 'terminal' }],
		})

		container.clearAllInstances()
		configureContainer(companyRoot)
		;(container as unknown as { instances: Map<string, unknown> }).instances.set(
			'companyRoot',
			companyRoot,
		)
		const resolved = await container.resolveAsync([storageFactory, workflowRuntimeStoreFactory])
		storage = resolved.storage
		workflowRuntimeStore = resolved.workflowRuntimeStore
		orchestrator = new Orchestrator({ companyRoot })
	})

	afterEach(async () => {
		await storage.close()
		container.clearAllInstances()
		await cleanup()
	})

	test('reuses the same child task across repeated parent evaluations', async () => {
		const now = new Date().toISOString()
		await storage.createTask({
			id: 'parent-task',
			title: 'Launch billing toggle',
			description: 'Parent task that delegates to a child workflow',
			type: 'planning',
			status: 'backlog',
			priority: 'medium',
			created_by: 'tester',
			workflow: 'parent-flow',
			context: { spec_path: '/projects/app/spec.md' },
			created_at: now,
			updated_at: now,
		})

		await orchestrator.handleTaskChange('parent-task')
		await orchestrator.handleTaskChange('parent-task')

		const childTasks = await storage.listTasks({ parent: 'parent-task' })
		expect(childTasks).toHaveLength(1)
		const childTask = childTasks[0]
		expect(childTask?.workflow).toBe('child-flow')
		expect(childTask?.context.brief).toBe('Launch billing toggle')

		if (childTask) {
			await orchestrator.handleTaskChange(childTask.id)
		}
		await orchestrator.handleTaskChange('parent-task')
		await orchestrator.handleTaskChange('parent-task')

		const parentTask = await storage.readTask('parent-task')
		expect(parentTask?.status).toBe('done')

		const parentRun = await workflowRuntimeStore.getWorkflowRunByTaskId('parent-task')
		expect(parentRun?.workflow_id).toBe('parent-flow')
		expect(parentRun?.current_step_id).toBe('complete')
		expect(parentRun?.archived_at).toBeTruthy()

		const parentStepRuns = await workflowRuntimeStore.listStepRuns(parentRun?.id ?? '')
		expect(parentStepRuns).toHaveLength(2)
		const spawnStepRun = parentStepRuns.find((stepRun) => stepRun.step_id === 'spawn-child')
		const completeStepRun = parentStepRuns.find((stepRun) => stepRun.step_id === 'complete')
		expect(spawnStepRun?.attempt).toBe(1)
		expect(spawnStepRun?.child_task_id).toBe(childTask?.id)
		expect(spawnStepRun?.status).toBe('completed')
		expect(spawnStepRun?.archived_at).toBeTruthy()
		expect(completeStepRun?.attempt).toBe(1)
		expect(completeStepRun?.status).toBe('completed')
		expect(completeStepRun?.archived_at).toBeTruthy()

		const childRun = await workflowRuntimeStore.getWorkflowRunByTaskId(childTask?.id ?? '')
		expect(childRun?.workflow_id).toBe('child-flow')
		expect(childRun?.status).toBe('completed')
		expect(childRun?.archived_at).toBeTruthy()
	})
})
