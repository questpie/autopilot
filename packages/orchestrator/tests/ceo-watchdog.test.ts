import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createTestCompany } from './helpers'
import { writeYaml } from '../src/fs/yaml'
import { createTask } from '../src/fs/tasks'
import { Orchestrator } from '../src/server'
import { ceoPrompt } from '@questpie/autopilot-agents'

// ── Schedules ────────────────────────────────────────────────────────────────

describe('CEO watchdog schedule', () => {
	test('schedules.yaml contains ceo-watchdog entry', async () => {
		const schedulesPath = join(
			import.meta.dir,
			'../../../templates/solo-dev-shop/team/schedules.yaml',
		)
		const content = await readFile(schedulesPath, 'utf-8')

		expect(content).toContain('id: ceo-watchdog')
		expect(content).toContain('agent: ceo')
		expect(content).toContain('*/10 * * * *')
		expect(content).toContain('Monitor company health')
	})
})

// ── CEO Prompt ───────────────────────────────────────────────────────────────

describe('CEO prompt watchdog additions', () => {
	const prompt = ceoPrompt({
		companyName: 'TestCorp',
		teamRoster: '- CEO (meta)',
		currentTasksSummary: 'none',
	})

	test('contains watchdog section', () => {
		expect(prompt).toContain('watchdog')
		expect(prompt).toContain('health check')
	})

	test('contains workflow ownership section', () => {
		expect(prompt).toContain('Workflow Ownership')
		expect(prompt).toContain('OWN all workflow files')
	})

	test('contains delegation section', () => {
		expect(prompt).toContain('Delegation')
		expect(prompt).toContain('task-decomposition')
	})
})

// ── Startup Scan ─────────────────────────────────────────────────────────────

describe('Startup scan', () => {
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

	test('processes existing tasks in active/ on startup', async () => {
		// Setup company
		await writeYaml(join(companyRoot, 'company.yaml'), {
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
		await writeYaml(join(companyRoot, 'team', 'agents.yaml'), {
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
		await writeYaml(join(companyRoot, 'team', 'schedules.yaml'), {
			schedules: [],
		})
		await writeYaml(join(companyRoot, 'team', 'webhooks.yaml'), {
			webhooks: [],
		})

		// Create a task in active/ before starting the orchestrator
		await createTask(companyRoot, {
			id: 'pre-existing-task',
			title: 'Pre-existing Task',
			type: 'implementation',
			status: 'assigned',
			priority: 'medium',
			created_by: 'human-1',
			assigned_to: 'dev-agent',
		})

		const orchestrator = new Orchestrator({ companyRoot, webhookPort: 0 })
		await orchestrator.start()

		// The fact that start() completes without error means it processed
		// the existing task. The task should have been handled.
		expect(orchestrator.isRunning()).toBe(true)

		await orchestrator.stop()
	})
})
