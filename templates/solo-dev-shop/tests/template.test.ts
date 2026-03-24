import { describe, test, expect } from 'bun:test'
import { join } from 'path'
import { stat } from 'fs/promises'
import { loadAndValidate } from '../../../packages/spec/src/validate'
import {
	CompanySchema,
	AgentsFileSchema,
	HumansFileSchema,
	SchedulesFileSchema,
	WorkflowSchema,
	DashboardGroupsFileSchema,
	WebhooksFileSchema,
	ApprovalGatesFileSchema,
} from '../../../packages/spec/src/schemas'

const TEMPLATE_DIR = join(import.meta.dir, '..')

describe('solo-dev-shop template', () => {
	test('company.yaml validates against CompanySchema', async () => {
		const result = await loadAndValidate(join(TEMPLATE_DIR, 'company.yaml'), CompanySchema)
		expect(result.name).toBe('My Company')
		expect(result.slug).toBe('my-company')
		expect(result.owner.email).toBe('founder@example.com')
		expect(result.settings.max_concurrent_agents).toBe(4)
		expect(result.settings.budget.daily_token_limit).toBe(2000000)
	})

	test('team/agents.yaml validates against AgentsFileSchema', async () => {
		const result = await loadAndValidate(join(TEMPLATE_DIR, 'team/agents.yaml'), AgentsFileSchema)
		expect(result.agents).toHaveLength(8)

		const ids = result.agents.map((a: { id: string }) => a.id)
		expect(ids).toContain('ceo')
		expect(ids).toContain('sam')
		expect(ids).toContain('alex')
		expect(ids).toContain('max')
		expect(ids).toContain('riley')
		expect(ids).toContain('ops')
		expect(ids).toContain('morgan')
		expect(ids).toContain('jordan')

		for (const agent of result.agents) {
			expect(agent.fs_scope.read.length).toBeGreaterThan(0)
			expect(agent.fs_scope.write.length).toBeGreaterThan(0)
			expect(agent.tools.length).toBeGreaterThan(0)
		}
	})

	test('team/humans.yaml validates against HumansFileSchema', async () => {
		const result = await loadAndValidate(join(TEMPLATE_DIR, 'team/humans.yaml'), HumansFileSchema)
		expect(result.humans).toHaveLength(1)
		expect(result.humans[0].id).toBe('owner')
		expect(result.humans[0].role).toBe('owner')
	})

	test('team/schedules.yaml validates against SchedulesFileSchema', async () => {
		const result = await loadAndValidate(
			join(TEMPLATE_DIR, 'team/schedules.yaml'),
			SchedulesFileSchema,
		)
		expect(result.schedules).toHaveLength(4)

		const ids = result.schedules.map((s: { id: string }) => s.id)
		expect(ids).toContain('health-check')
		expect(ids).toContain('daily-standup')
		expect(ids).toContain('ceo-watchdog')
		expect(ids).toContain('weekly-review')

		for (const schedule of result.schedules) {
			expect(schedule.on_failure).toBe('alert_human')
		}
	})

	test('team/webhooks.yaml validates against WebhooksFileSchema', async () => {
		const result = await loadAndValidate(
			join(TEMPLATE_DIR, 'team/webhooks.yaml'),
			WebhooksFileSchema,
		)
		expect(result.webhooks).toHaveLength(1)
		expect(result.webhooks[0].id).toBe('telegram')
	})

	test('team/policies/approval-gates.yaml validates against ApprovalGatesFileSchema', async () => {
		const result = await loadAndValidate(
			join(TEMPLATE_DIR, 'team/policies/approval-gates.yaml'),
			ApprovalGatesFileSchema,
		)
		expect(result.gates.length).toBeGreaterThan(0)
		const gates = result.gates.map((g: { gate: string }) => g.gate)
		expect(gates).toContain('merge')
		expect(gates).toContain('deploy')
		expect(gates).toContain('publish')
		expect(gates).toContain('spend')
	})

	test('team/workflows/development.yaml validates against WorkflowSchema', async () => {
		const result = await loadAndValidate(
			join(TEMPLATE_DIR, 'team/workflows/development.yaml'),
			WorkflowSchema,
		)
		expect(result.id).toBe('development')
		expect(result.steps).toHaveLength(12)

		const stepIds = result.steps.map((s: { id: string }) => s.id)
		expect(stepIds).toEqual([
			'scope',
			'plan',
			'plan_review',
			'implement',
			'code_review',
			'human_merge',
			'deploy_staging',
			'verify',
			'human_deploy_prod',
			'deploy_prod',
			'announce',
			'complete',
		])
	})

	test('team/workflows/marketing.yaml validates against WorkflowSchema', async () => {
		const result = await loadAndValidate(
			join(TEMPLATE_DIR, 'team/workflows/marketing.yaml'),
			WorkflowSchema,
		)
		expect(result.id).toBe('marketing')
		expect(result.steps).toHaveLength(7)

		const stepIds = result.steps.map((s: { id: string }) => s.id)
		expect(stepIds).toEqual([
			'brief',
			'content_creation',
			'design_assets',
			'human_review',
			'publish',
			'monitor',
			'complete',
		])
	})

	test('team/workflows/incident.yaml validates against WorkflowSchema', async () => {
		const result = await loadAndValidate(
			join(TEMPLATE_DIR, 'team/workflows/incident.yaml'),
			WorkflowSchema,
		)
		expect(result.id).toBe('incident')
		expect(result.steps).toHaveLength(8)

		const stepIds = result.steps.map((s: { id: string }) => s.id)
		expect(stepIds).toEqual([
			'triage',
			'investigate',
			'hotfix',
			'quick_review',
			'human_merge',
			'deploy_hotfix',
			'verify',
			'complete',
		])
	})

	test('dashboard/groups.yaml validates against DashboardGroupsFileSchema', async () => {
		const result = await loadAndValidate(
			join(TEMPLATE_DIR, 'dashboard/groups.yaml'),
			DashboardGroupsFileSchema,
		)
		expect(result.groups).toHaveLength(4)
		expect(result.groups[0].id).toBe('alerts')
		expect(result.groups[0].position).toBe(0)
	})

	const gitkeepDirs = [
		'tasks/backlog',
		'tasks/active',
		'tasks/review',
		'tasks/blocked',
		'tasks/done',
		'comms/channels/general',
		'comms/channels/dev',
		'comms/direct',
		'knowledge/brand',
		'knowledge/technical',
		'knowledge/business',
		'knowledge/onboarding',
		'projects',
		'context/memory',
		'secrets',
		'dashboard/pins',
		'logs/activity',
		'logs/sessions',
		'logs/errors',
		'infra',
	]

	for (const dir of gitkeepDirs) {
		test(`${dir}/.gitkeep exists`, async () => {
			const gitkeepPath = join(TEMPLATE_DIR, dir, '.gitkeep')
			const fileStat = await stat(gitkeepPath)
			expect(fileStat.isFile()).toBe(true)
		})
	}
})
