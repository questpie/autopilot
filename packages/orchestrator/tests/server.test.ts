import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { join } from 'node:path'
import { Orchestrator } from '../src/server'
import { createTestCompany } from './helpers'
import { writeYaml } from '../src/fs/yaml'
import { createTask } from '../src/fs/tasks'

function writeCompanyConfig(root: string) {
	return writeYaml(join(root, 'company.yaml'), {
		name: 'Test Company',
		slug: 'test-co',
		description: 'A test company',
		timezone: 'UTC',
		language: 'en',
		languages: ['en'],
		owner: {
			name: 'Test Owner',
			email: 'owner@test.com',
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
				id: 'dev-agent',
				name: 'Dev Agent',
				role: 'developer',
				description: 'Development agent',
				fs_scope: { read: ['**'], write: ['**'] },
				tools: ['fs', 'terminal'],
			},
		],
	})
}

function writeSchedulesConfig(root: string) {
	return writeYaml(join(root, 'team', 'schedules.yaml'), {
		schedules: [
			{
				id: 'test-schedule',
				agent: 'dev-agent',
				cron: '0 9 * * *',
				description: 'Test schedule',
				enabled: true,
			},
		],
	})
}

function writeWebhooksConfig(root: string) {
	return writeYaml(join(root, 'team', 'webhooks.yaml'), {
		webhooks: [
			{
				id: 'test-webhook',
				path: '/hooks/test',
				agent: 'dev-agent',
				description: 'Test webhook',
				auth: 'none',
				action: { type: 'spawn_agent', priority: 'normal' },
				enabled: true,
			},
		],
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

describe('Orchestrator', () => {
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

	test('constructor initializes without error', () => {
		const orchestrator = new Orchestrator({ companyRoot })
		expect(orchestrator).toBeDefined()
		expect(orchestrator.isRunning()).toBe(false)
		expect(orchestrator.getStreamManager()).toBeDefined()
		expect(orchestrator.getWorkflowLoader()).toBeDefined()
	})

	test('constructor accepts custom webhook port', () => {
		const orchestrator = new Orchestrator({ companyRoot, webhookPort: 9999 })
		expect(orchestrator).toBeDefined()
	})

	test('start fails without company.yaml', async () => {
		const orchestrator = new Orchestrator({ companyRoot })
		await expect(orchestrator.start()).rejects.toThrow()
		expect(orchestrator.isRunning()).toBe(false)
	})

	test('start and stop lifecycle', async () => {
		await writeCompanyConfig(companyRoot)
		await writeSchedulesConfig(companyRoot)
		await writeWebhooksConfig(companyRoot)

		const orchestrator = new Orchestrator({ companyRoot, webhookPort: 0 })
		await orchestrator.start()

		expect(orchestrator.isRunning()).toBe(true)

		await orchestrator.stop()
		expect(orchestrator.isRunning()).toBe(false)
	})

	test('start is idempotent', async () => {
		await writeCompanyConfig(companyRoot)
		await writeSchedulesConfig(companyRoot)
		await writeWebhooksConfig(companyRoot)

		const orchestrator = new Orchestrator({ companyRoot, webhookPort: 0 })
		await orchestrator.start()
		await orchestrator.start() // should not throw

		expect(orchestrator.isRunning()).toBe(true)

		await orchestrator.stop()
	})

	test('stop is idempotent', async () => {
		const orchestrator = new Orchestrator({ companyRoot })
		await orchestrator.stop() // should not throw
		await orchestrator.stop() // should not throw
		expect(orchestrator.isRunning()).toBe(false)
	})

	test('handleTaskChange processes a task without workflow', async () => {
		await writeCompanyConfig(companyRoot)
		await writeAgentsConfig(companyRoot)

		await createTask(companyRoot, {
			id: 'test-task-1',
			title: 'Test Task',
			type: 'implementation',
			status: 'backlog',
			priority: 'medium',
			created_by: 'human-1',
		})

		const orchestrator = new Orchestrator({ companyRoot })
		// handleTaskChange is public so we can test it directly
		await orchestrator.handleTaskChange('test-task-1')
		// Should not throw — just logs and returns
	})

	test('handleTaskChange processes a task with workflow', async () => {
		await writeCompanyConfig(companyRoot)
		await writeAgentsConfig(companyRoot)
		await writeWorkflow(companyRoot)

		await createTask(companyRoot, {
			id: 'test-task-2',
			title: 'Implement Feature',
			type: 'implementation',
			status: 'assigned',
			priority: 'medium',
			created_by: 'human-1',
			assigned_to: 'dev-agent',
			workflow: 'development',
			workflow_step: 'implement',
		})

		const orchestrator = new Orchestrator({ companyRoot })
		await orchestrator.handleTaskChange('test-task-2')
		// Should evaluate workflow and log assign_agent result
	})

	test('handleTaskChange with human gate step', async () => {
		await writeCompanyConfig(companyRoot)
		await writeAgentsConfig(companyRoot)
		await writeWorkflow(companyRoot)

		await createTask(companyRoot, {
			id: 'test-task-3',
			title: 'Review Feature',
			type: 'review',
			status: 'review',
			priority: 'medium',
			created_by: 'human-1',
			workflow: 'development',
			workflow_step: 'review',
		})

		const orchestrator = new Orchestrator({ companyRoot })
		await orchestrator.handleTaskChange('test-task-3')
		// Should evaluate workflow and log notify_human result
	})

	test('handleTaskChange with terminal step', async () => {
		await writeCompanyConfig(companyRoot)
		await writeAgentsConfig(companyRoot)
		await writeWorkflow(companyRoot)

		await createTask(companyRoot, {
			id: 'test-task-4',
			title: 'Completed Feature',
			type: 'implementation',
			status: 'done',
			priority: 'medium',
			created_by: 'human-1',
			workflow: 'development',
			workflow_step: 'complete',
		})

		const orchestrator = new Orchestrator({ companyRoot })
		await orchestrator.handleTaskChange('test-task-4')
		// Should evaluate workflow and log complete result
	})

	test('handleTaskChange with nonexistent task does not throw', async () => {
		await writeCompanyConfig(companyRoot)

		const orchestrator = new Orchestrator({ companyRoot })
		await orchestrator.handleTaskChange('nonexistent-task')
		// Should log "task not found" and return without error
	})

	test('handleTaskChange with invalid workflow does not throw', async () => {
		await writeCompanyConfig(companyRoot)
		await writeAgentsConfig(companyRoot)

		await createTask(companyRoot, {
			id: 'test-task-5',
			title: 'Bad Workflow Task',
			type: 'implementation',
			status: 'assigned',
			priority: 'medium',
			created_by: 'human-1',
			workflow: 'nonexistent-workflow',
			workflow_step: 'some-step',
		})

		const orchestrator = new Orchestrator({ companyRoot })
		await orchestrator.handleTaskChange('test-task-5')
		// Should catch the error from workflow loader and log it
	})
})
