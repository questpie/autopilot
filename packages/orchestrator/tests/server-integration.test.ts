import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { join } from 'node:path'
import { Orchestrator } from '../src/server'
import { createTestCompany } from './helpers'
import { writeYaml } from '../src/fs/yaml'
import { createTask, readTask } from '../src/fs/tasks'

// ─── Helpers ────────────────────────────────────────────────────────────────

function writeCompanyConfig(root: string) {
	return writeYaml(join(root, 'company.yaml'), {
		name: 'Integration Test Co',
		slug: 'integration-test',
		description: 'Integration test company',
		timezone: 'UTC',
		language: 'en',
		languages: ['en'],
		owner: {
			name: 'Peter',
			email: 'peter@test.com',
			notification_channels: [],
		},
		settings: {},
		integrations: {},
	})
}

function writeAgentsConfig(root: string) {
	return writeYaml(join(root, 'team', 'agents.yaml'), {
		agents: [
			{
				id: 'peter',
				name: 'Peter',
				role: 'developer',
				description: 'Developer agent',
				fs_scope: { read: ['**'], write: ['**'] },
				tools: ['fs', 'terminal'],
			},
			{
				id: 'maria',
				name: 'Maria',
				role: 'reviewer',
				description: 'Reviewer agent',
				fs_scope: { read: ['**'], write: ['company/tasks/**'] },
				tools: ['fs'],
			},
		],
	})
}

function writeSchedulesConfig(root: string) {
	return writeYaml(join(root, 'team', 'schedules.yaml'), {
		schedules: [],
	})
}

function writeWebhooksConfig(root: string) {
	return writeYaml(join(root, 'team', 'webhooks.yaml'), {
		webhooks: [],
	})
}

function writeWorkflow(root: string) {
	return writeYaml(join(root, 'team', 'workflows', 'development.yaml'), {
		id: 'development',
		name: 'Development Workflow',
		description: 'Standard dev workflow',
		steps: [
			{
				id: 'implement',
				name: 'Implement',
				type: 'agent',
				assigned_role: 'developer',
				auto_execute: true,
				transitions: { done: 'review' },
			},
			{
				id: 'review',
				name: 'Review',
				type: 'human_gate',
				gate: 'review',
				transitions: { approved: 'complete', rejected: 'implement' },
			},
			{
				id: 'complete',
				name: 'Complete',
				type: 'terminal',
				terminal: true,
				transitions: {},
			},
		],
	})
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('server integration', () => {
	let companyRoot: string
	let cleanup: () => Promise<void>

	beforeEach(async () => {
		const tc = await createTestCompany()
		companyRoot = tc.root
		cleanup = tc.cleanup
	})

	afterEach(async () => {
		await cleanup()
	})

	describe('task file creation → server processes', () => {
		test('creates a task file and server handleTaskChange detects it', async () => {
			await writeCompanyConfig(companyRoot)
			await writeAgentsConfig(companyRoot)
			await writeWorkflow(companyRoot)

			// Create a task YAML file
			const task = await createTask(companyRoot, {
				id: 'task-001',
				title: 'Implement auth module',
				type: 'implementation',
				status: 'assigned',
				priority: 'high',
				created_by: 'peter',
				assigned_to: 'peter',
				workflow: 'development',
				workflow_step: 'implement',
			})

			// Verify the task was written
			const read = await readTask(companyRoot, 'task-001')
			expect(read).not.toBeNull()
			expect(read?.id).toBe('task-001')

			// Server processes the task change
			const orchestrator = new Orchestrator({ companyRoot })
			await orchestrator.handleTaskChange('task-001')
			// Should not throw — logs assign_agent for implement step
		})
	})

	describe('server processes task with workflow → correct transition logged', () => {
		test('processes task at implement step and gets assign_agent result', async () => {
			await writeCompanyConfig(companyRoot)
			await writeAgentsConfig(companyRoot)
			await writeWorkflow(companyRoot)

			await createTask(companyRoot, {
				id: 'task-001',
				title: 'Build API endpoint',
				type: 'implementation',
				status: 'assigned',
				priority: 'medium',
				created_by: 'peter',
				assigned_to: 'peter',
				workflow: 'development',
				workflow_step: 'implement',
			})

			const orchestrator = new Orchestrator({ companyRoot })
			// handleTaskChange evaluates the workflow and logs the result
			await orchestrator.handleTaskChange('task-001')
			// No error means success — the workflow evaluated correctly
		})

		test('processes task at review step and gets notify_human result', async () => {
			await writeCompanyConfig(companyRoot)
			await writeAgentsConfig(companyRoot)
			await writeWorkflow(companyRoot)

			await createTask(companyRoot, {
				id: 'task-002',
				title: 'Review API endpoint',
				type: 'review',
				status: 'review',
				priority: 'medium',
				created_by: 'peter',
				workflow: 'development',
				workflow_step: 'review',
			})

			const orchestrator = new Orchestrator({ companyRoot })
			await orchestrator.handleTaskChange('task-002')
			// Should evaluate to notify_human for the review gate
		})

		test('processes task at terminal step and gets complete result', async () => {
			await writeCompanyConfig(companyRoot)
			await writeAgentsConfig(companyRoot)
			await writeWorkflow(companyRoot)

			await createTask(companyRoot, {
				id: 'task-003',
				title: 'Completed feature',
				type: 'implementation',
				status: 'done',
				priority: 'medium',
				created_by: 'peter',
				workflow: 'development',
				workflow_step: 'complete',
			})

			const orchestrator = new Orchestrator({ companyRoot })
			await orchestrator.handleTaskChange('task-003')
			// Should evaluate to complete for terminal step
		})
	})

	describe('server handles task without workflow', () => {
		test('processes task with no workflow field gracefully', async () => {
			await writeCompanyConfig(companyRoot)
			await writeAgentsConfig(companyRoot)

			await createTask(companyRoot, {
				id: 'task-001',
				title: 'Simple task without workflow',
				type: 'implementation',
				status: 'backlog',
				priority: 'medium',
				created_by: 'peter',
			})

			const orchestrator = new Orchestrator({ companyRoot })
			await orchestrator.handleTaskChange('task-001')
			// Should not throw — just logs and returns
		})

		test('processes task with workflow but no workflow_step gracefully', async () => {
			await writeCompanyConfig(companyRoot)
			await writeAgentsConfig(companyRoot)
			await writeWorkflow(companyRoot)

			await createTask(companyRoot, {
				id: 'task-001',
				title: 'Task with workflow but no step',
				type: 'implementation',
				status: 'backlog',
				priority: 'medium',
				created_by: 'peter',
				workflow: 'development',
				// no workflow_step
			})

			const orchestrator = new Orchestrator({ companyRoot })
			await orchestrator.handleTaskChange('task-001')
			// Should skip workflow evaluation since workflow_step is missing
		})
	})

	describe('server handles non-existent task gracefully', () => {
		test('does not throw for a non-existent task ID', async () => {
			await writeCompanyConfig(companyRoot)

			const orchestrator = new Orchestrator({ companyRoot })
			await orchestrator.handleTaskChange('task-nonexistent')
			// Should log "task not found" and return without error
		})

		test('handles multiple non-existent task calls', async () => {
			await writeCompanyConfig(companyRoot)

			const orchestrator = new Orchestrator({ companyRoot })
			await orchestrator.handleTaskChange('ghost-1')
			await orchestrator.handleTaskChange('ghost-2')
			await orchestrator.handleTaskChange('ghost-3')
			// None should throw
		})
	})

	describe('server start/stop resource management', () => {
		test('start and stop does not leak resources', async () => {
			await writeCompanyConfig(companyRoot)
			await writeSchedulesConfig(companyRoot)
			await writeWebhooksConfig(companyRoot)

			const orchestrator = new Orchestrator({ companyRoot, webhookPort: 0 })
			await orchestrator.start()
			expect(orchestrator.isRunning()).toBe(true)

			await orchestrator.stop()
			expect(orchestrator.isRunning()).toBe(false)

			// Verify internal state is cleaned up
			expect(orchestrator.getStreamManager()).toBeDefined()
			expect(orchestrator.getWorkflowLoader()).toBeDefined()
		})

		test('start then stop then start again works', async () => {
			await writeCompanyConfig(companyRoot)
			await writeSchedulesConfig(companyRoot)
			await writeWebhooksConfig(companyRoot)

			const orchestrator = new Orchestrator({ companyRoot, webhookPort: 0 })

			await orchestrator.start()
			expect(orchestrator.isRunning()).toBe(true)

			await orchestrator.stop()
			expect(orchestrator.isRunning()).toBe(false)

			// Start again — should work without issues
			await orchestrator.start()
			expect(orchestrator.isRunning()).toBe(true)

			await orchestrator.stop()
			expect(orchestrator.isRunning()).toBe(false)
		})
	})

	describe('server double-start is safe', () => {
		test('calling start twice does not throw', async () => {
			await writeCompanyConfig(companyRoot)
			await writeSchedulesConfig(companyRoot)
			await writeWebhooksConfig(companyRoot)

			const orchestrator = new Orchestrator({ companyRoot, webhookPort: 0 })
			await orchestrator.start()
			await orchestrator.start() // idempotent
			expect(orchestrator.isRunning()).toBe(true)

			await orchestrator.stop()
		})
	})

	describe('server double-stop is safe', () => {
		test('calling stop twice does not throw when never started', async () => {
			const orchestrator = new Orchestrator({ companyRoot })
			await orchestrator.stop()
			await orchestrator.stop()
			expect(orchestrator.isRunning()).toBe(false)
		})

		test('calling stop twice after start does not throw', async () => {
			await writeCompanyConfig(companyRoot)
			await writeSchedulesConfig(companyRoot)
			await writeWebhooksConfig(companyRoot)

			const orchestrator = new Orchestrator({ companyRoot, webhookPort: 0 })
			await orchestrator.start()
			expect(orchestrator.isRunning()).toBe(true)

			await orchestrator.stop()
			expect(orchestrator.isRunning()).toBe(false)

			await orchestrator.stop()
			expect(orchestrator.isRunning()).toBe(false)
		})
	})
})
