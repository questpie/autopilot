import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { configureContainer, container } from '../src/container'
import { storageFactory } from '../src/fs/sqlite-backend'
import type { StorageBackend } from '../src/fs/storage'
import { writeYaml } from '../src/fs/yaml'
import { Orchestrator } from '../src/server'
import { workflowRuntimeStoreFactory } from '../src/workflow'
import { createTestCompany } from './helpers'

/**
 * H4: Workflow definition snapshot tests.
 *
 * Verify that when a workflow run is created, the compiled workflow
 * definition is snapshotted into workflow_runs.workflow_definition.
 */
describe('workflow definition snapshot (H4)', () => {
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

		await writeYaml(join(companyRoot, 'team', 'workflows', 'snapshot-flow.yaml'), {
			id: 'snapshot-flow',
			name: 'Snapshot Flow',
			version: 1,
			steps: [
				{
					id: 'implement',
					type: 'agent',
					assigned_role: 'developer',
					transitions: { done: 'complete' },
				},
				{ id: 'complete', type: 'terminal' },
			],
		})

		await writeYaml(join(companyRoot, 'team', 'agents', 'dev.yaml'), {
			id: 'dev',
			name: 'Developer',
			description: 'Dev agent',
			role: 'developer',
			model: 'anthropic/claude-sonnet-4',
			provider: 'tanstack-ai',
			fs_scope: { read: ['**'], write: ['**'] },
			tools: ['fs', 'terminal'],
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

	test('workflow definition is snapshotted when run is created', async () => {
		const now = new Date().toISOString()
		await storage.createTask({
			id: 'task-snapshot',
			title: 'Test snapshot',
			description: '',
			type: 'implementation',
			status: 'backlog',
			priority: 'medium',
			created_by: 'tester',
			workflow: 'snapshot-flow',
			created_at: now,
			updated_at: now,
		})

		await orchestrator.handleTaskChange('task-snapshot')

		// Verify the workflow run was created with a snapshot
		const definition = await workflowRuntimeStore.getWorkflowDefinition('task-snapshot')
		expect(definition).not.toBeNull()
		expect(definition?.id).toBe('snapshot-flow')
		expect(definition?.name).toBe('Snapshot Flow')
		expect(definition?.steps).toHaveLength(2)
		expect(definition?.steps[0]?.id).toBe('implement')
		expect(definition?.steps[1]?.id).toBe('complete')
	})

	test('snapshot is not overwritten on subsequent evaluations', async () => {
		const now = new Date().toISOString()
		await storage.createTask({
			id: 'task-snap-stable',
			title: 'Test stable snapshot',
			description: '',
			type: 'implementation',
			status: 'backlog',
			priority: 'medium',
			created_by: 'tester',
			workflow: 'snapshot-flow',
			created_at: now,
			updated_at: now,
		})

		// First evaluation — creates run with snapshot
		await orchestrator.handleTaskChange('task-snap-stable')

		const defBefore = await workflowRuntimeStore.getWorkflowDefinition('task-snap-stable')
		expect(defBefore?.name).toBe('Snapshot Flow')

		// Modify workflow YAML on disk (simulate mid-execution edit)
		await writeYaml(join(companyRoot, 'team', 'workflows', 'snapshot-flow.yaml'), {
			id: 'snapshot-flow',
			name: 'MODIFIED Flow',
			version: 2,
			steps: [
				{
					id: 'implement',
					type: 'agent',
					assigned_role: 'developer',
					transitions: { done: 'complete' },
				},
				{ id: 'complete', type: 'terminal' },
			],
		})

		// Re-evaluate — should NOT overwrite the snapshot
		await orchestrator.handleTaskChange('task-snap-stable')

		const defAfter = await workflowRuntimeStore.getWorkflowDefinition('task-snap-stable')
		expect(defAfter?.name).toBe('Snapshot Flow') // Original, not 'MODIFIED Flow'
	})

	test('getWorkflowDefinition returns null for task without workflow run', async () => {
		const result = await workflowRuntimeStore.getWorkflowDefinition('nonexistent-task')
		expect(result).toBeNull()
	})
})
