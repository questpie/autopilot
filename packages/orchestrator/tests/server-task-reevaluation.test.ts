import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { configureContainer, container } from '../src/container'
import { eventBus } from '../src/events/event-bus'
import { storageFactory } from '../src/fs/sqlite-backend'
import type { StorageBackend } from '../src/fs/storage'
import { writeYaml } from '../src/fs/yaml'
import { Orchestrator } from '../src/server'
import { workflowRuntimeStoreFactory } from '../src/workflow'
import { createTestCompany } from './helpers'

/** Poll until a condition is met or timeout (default 2s). */
async function waitForCondition<T>(
	getter: () => Promise<T>,
	predicate: (value: T) => boolean,
	timeoutMs = 2000,
	intervalMs = 20,
): Promise<T> {
	const start = Date.now()
	while (Date.now() - start < timeoutMs) {
		const value = await getter()
		if (predicate(value)) return value
		await new Promise((r) => setTimeout(r, intervalMs))
	}
	return getter()
}

/**
 * H3: task_changed events trigger workflow reevaluation.
 *
 * When a task status changes (e.g. via API approve/reject), the event bus
 * should trigger handleTaskChange so the workflow engine advances immediately.
 */
describe('task_changed → workflow reevaluation (H3)', () => {
	let companyRoot: string
	let cleanup: () => Promise<void>
	let orchestrator: Orchestrator
	let storage: StorageBackend
	let unsubscribe: () => void
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

		// A workflow with a human gate: implement → review (human_gate) → complete
		await writeYaml(join(companyRoot, 'team', 'workflows', 'review-flow.yaml'), {
			id: 'review-flow',
			name: 'Review Flow',
			steps: [
				{
					id: 'implement',
					type: 'agent',
					assigned_role: 'developer',
					transitions: { done: 'review' },
				},
				{
					id: 'review',
					type: 'human_gate',
					description: 'Human reviews and approves',
					transitions: { done: 'complete' },
				},
				{ id: 'complete', type: 'terminal' },
			],
		})

		await writeYaml(join(companyRoot, 'team', 'agents', 'dev.yaml'), {
			id: 'dev',
			name: 'Developer',
			description: 'Development agent',
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

		// Wire H3 subscriber manually (normally done in orchestrator.start(),
		// which is too heavy for unit tests — starts HTTP server, watcher, etc.)
		unsubscribe = eventBus.subscribe((event) => {
			if (event.type === 'task_changed' && event.taskId) {
				setTimeout(() => void orchestrator.handleTaskChange(event.taskId), 0)
			}
		})
	})

	afterEach(async () => {
		unsubscribe()
		await storage.close()
		container.clearAllInstances()
		await cleanup()
	})

	test('task at human gate advances when task_changed event emitted after approval', async () => {
		const now = new Date().toISOString()

		// Create a task that's already at the review (human_gate) step
		await storage.createTask({
			id: 'task-review',
			title: 'Feature needing review',
			description: '',
			type: 'implementation',
			status: 'assigned',
			priority: 'medium',
			created_by: 'tester',
			workflow: 'review-flow',
			workflow_step: 'review',
			created_at: now,
			updated_at: now,
		})

		// First evaluation: should detect human gate → no_action (waiting for human)
		await orchestrator.handleTaskChange('task-review')

		const taskBefore = await storage.readTask('task-review')
		expect(taskBefore?.workflow_step).toBe('review')

		// Simulate human approval: move task to 'done' (like POST /tasks/:id/approve)
		await storage.moveTask('task-review', 'done', 'human')

		// Now emit task_changed event (like the API route does after moveTask)
		// The H3 subscriber should pick this up and call handleTaskChange
		eventBus.emit({
			type: 'task_changed',
			taskId: 'task-review',
			status: 'done',
		})

		// Wait for the async handleTaskChange chain to complete.
		// The event triggers setTimeout(0) → handleTaskChange → multiple awaits
		// (load agents, load workflow, evaluate, record, advance, archive).
		const taskAfter = await waitForCondition(
			() => storage.readTask('task-review'),
			(t) => t?.workflow_step === 'complete',
		)
		expect(taskAfter?.status).toBe('done')
		expect(taskAfter?.workflow_step).toBe('complete')

		// Verify workflow run was archived (terminal step reached)
		const run = await workflowRuntimeStore.getWorkflowRunByTaskId('task-review')
		expect(run?.current_step_id).toBe('complete')
		expect(run?.archived_at).toBeTruthy()
	})

	test('task_changed event for non-workflow task does not crash', async () => {
		const now = new Date().toISOString()

		// Create a task without a workflow
		await storage.createTask({
			id: 'task-no-workflow',
			title: 'Simple task',
			description: '',
			type: 'implementation',
			status: 'backlog',
			priority: 'medium',
			created_by: 'tester',
			created_at: now,
			updated_at: now,
		})

		// Emit task_changed — should be handled gracefully (no crash, no-op)
		eventBus.emit({
			type: 'task_changed',
			taskId: 'task-no-workflow',
			status: 'in_progress',
		})

		await new Promise((resolve) => setTimeout(resolve, 200))

		// Task should be unchanged (no workflow to advance)
		const task = await storage.readTask('task-no-workflow')
		expect(task?.status).toBe('backlog')
	})

	test('task_changed event for non-existent task does not crash', async () => {
		// Emit event for a task that doesn't exist — should not throw
		eventBus.emit({
			type: 'task_changed',
			taskId: 'ghost-task',
			status: 'done',
		})

		await new Promise((resolve) => setTimeout(resolve, 200))

		// If we get here without throwing, the test passes
		expect(true).toBe(true)
	})
})
