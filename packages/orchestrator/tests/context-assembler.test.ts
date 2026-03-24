import { describe, it, expect, afterEach } from 'bun:test'
import { createTestCompany } from './helpers'
import { assembleContext } from '../src/context/assembler'
import { loadAgentMemory } from '../src/context/memory-loader'
import { buildCompanySnapshot } from '../src/context/snapshot'
import { writeYaml } from '../src/fs/yaml'
import { join } from 'node:path'
import { mkdir } from 'node:fs/promises'
import type { Agent, Company, Task } from '@questpie/autopilot-spec'
import type { StorageBackend } from '../src/fs/storage'

const mockStorage: StorageBackend = {
	initialize: async () => {},
	close: async () => {},
	createTask: async (t) => t,
	readTask: async () => null,
	updateTask: async (id, u, by) => ({ ...u } as any),
	moveTask: async (id, s, by) => ({} as any),
	listTasks: async () => [],
	countTasks: async () => 0,
	deleteTask: async () => {},
	sendMessage: async (m) => m,
	readMessages: async () => [],
	searchMessages: async () => [],
	appendActivity: async () => {},
	readActivity: async () => [],
}

const testCompany: Company = {
	name: 'TestCorp',
	slug: 'testcorp',
	description: 'A test company',
	timezone: 'UTC',
	language: 'en',
	languages: ['en'],
	owner: {
		name: 'Test Owner',
		email: 'owner@test.com',
		notification_channels: [],
	},
	settings: {
		auto_assign: true,
		require_approval: ['merge', 'deploy', 'spend', 'publish'],
		max_concurrent_agents: 6,
		agent_provider: 'anthropic',
		agent_model: 'claude-sonnet-4-20250514',
		budget: {
			daily_token_limit: 5_000_000,
			alert_at: 80,
		},
	},
	integrations: {},
}

const testAgent: Agent = {
	id: 'developer-1',
	name: 'Peter',
	role: 'developer',
	description: 'Senior developer',
	model: 'claude-sonnet-4-20250514',
	fs_scope: {
		read: ['tasks/**', 'comms/**', 'context/**', 'dashboard/**'],
		write: ['tasks/active/**', 'comms/channels/dev/**'],
	},
	tools: ['fs', 'terminal'],
	mcps: [],
	triggers: [],
}

const testAgents: Agent[] = [
	testAgent,
	{
		id: 'planner-1',
		name: 'Sophia',
		role: 'planner',
		description: 'Project planner',
		model: 'claude-sonnet-4-20250514',
		fs_scope: {
			read: ['**'],
			write: ['tasks/**'],
		},
		tools: ['fs'],
		mcps: [],
		triggers: [],
	},
]

const testTask: Task = {
	id: 'task-abc123',
	title: 'Implement login page',
	description: 'Build the login page with OAuth support',
	type: 'implementation',
	status: 'in_progress',
	priority: 'high',
	created_by: 'planner-1',
	assigned_to: 'developer-1',
	reviewers: [],
	parent: null,
	depends_on: [],
	blocks: [],
	related: [],
	context: {
		spec: 'projects/web/specs/login.md',
		plan: 'projects/web/plans/login-plan.md',
	},
	blockers: [],
	created_at: '2025-01-01T00:00:00.000Z',
	updated_at: '2025-01-02T00:00:00.000Z',
	history: [
		{
			at: '2025-01-01T00:00:00.000Z',
			by: 'planner-1',
			action: 'created',
		},
	],
}

describe('context assembler', () => {
	let cleanup: () => Promise<void>
	let root: string

	afterEach(async () => {
		if (cleanup) await cleanup()
	})

	async function setupCompanyDir() {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup

		// Write company.yaml
		await writeYaml(join(root, 'company.yaml'), testCompany)

		// Write agents.yaml
		await writeYaml(join(root, 'team', 'agents.yaml'), { agents: testAgents })

		return root
	}

	it('should return non-empty systemPrompt', async () => {
		await setupCompanyDir()

		const result = await assembleContext({
			companyRoot: root,
			agent: testAgent,
			company: testCompany,
			allAgents: testAgents,
			storage: mockStorage,
		})

		expect(result.systemPrompt).toBeTruthy()
		expect(result.systemPrompt.length).toBeGreaterThan(100)
	})

	it('should return a reasonable token estimate', async () => {
		await setupCompanyDir()

		const result = await assembleContext({
			companyRoot: root,
			agent: testAgent,
			company: testCompany,
			allAgents: testAgents,
			storage: mockStorage,
		})

		// Token estimate should be roughly prompt length / 4
		const expectedMin = Math.floor(result.systemPrompt.length / 5)
		const expectedMax = Math.ceil(result.systemPrompt.length / 3)
		expect(result.tokenEstimate).toBeGreaterThanOrEqual(expectedMin)
		expect(result.tokenEstimate).toBeLessThanOrEqual(expectedMax)
	})

	it('should include agent name and role in context', async () => {
		await setupCompanyDir()

		const result = await assembleContext({
			companyRoot: root,
			agent: testAgent,
			company: testCompany,
			allAgents: testAgents,
			storage: mockStorage,
		})

		expect(result.systemPrompt).toContain('Peter')
		expect(result.systemPrompt).toContain('developer')
	})

	it('should include company name in context', async () => {
		await setupCompanyDir()

		const result = await assembleContext({
			companyRoot: root,
			agent: testAgent,
			company: testCompany,
			allAgents: testAgents,
			storage: mockStorage,
		})

		expect(result.systemPrompt).toContain('TestCorp')
	})

	it('should include task details when task is provided', async () => {
		await setupCompanyDir()

		const result = await assembleContext({
			companyRoot: root,
			agent: testAgent,
			company: testCompany,
			task: testTask,
			allAgents: testAgents,
			storage: mockStorage,
		})

		expect(result.systemPrompt).toContain('Implement login page')
		expect(result.systemPrompt).toContain('task-abc123')
		expect(result.systemPrompt).toContain('in_progress')
		expect(result.systemPrompt).toContain('spec')
		expect(result.systemPrompt).toContain('plan')
	})

	it('should work without a task', async () => {
		await setupCompanyDir()

		const result = await assembleContext({
			companyRoot: root,
			agent: testAgent,
			company: testCompany,
			allAgents: testAgents,
			storage: mockStorage,
		})

		expect(result.systemPrompt).not.toContain('## Current Task')
	})

	it('should include memory when memory.yaml exists', async () => {
		await setupCompanyDir()

		// Create memory file for the agent
		const memoryDir = join(root, 'context', 'memory', testAgent.id)
		await mkdir(memoryDir, { recursive: true })
		await writeYaml(join(memoryDir, 'memory.yaml'), {
			facts: {
				architecture: ['Uses React + TypeScript', 'Monorepo with Turborepo'],
			},
			decisions: [
				{
					date: '2025-01-15',
					decision: 'Use TanStack Router',
					reason: 'Better type safety',
				},
			],
			patterns: ['Always use named exports'],
			mistakes: [],
		})

		const result = await assembleContext({
			companyRoot: root,
			agent: testAgent,
			company: testCompany,
			allAgents: testAgents,
			storage: mockStorage,
		})

		expect(result.systemPrompt).toContain('Agent Memory')
		expect(result.systemPrompt).toContain('Uses React + TypeScript')
		expect(result.systemPrompt).toContain('Use TanStack Router')
	})

	it('should work with empty memory (no memory.yaml)', async () => {
		await setupCompanyDir()

		const result = await assembleContext({
			companyRoot: root,
			agent: testAgent,
			company: testCompany,
			allAgents: testAgents,
			storage: mockStorage,
		})

		expect(result.systemPrompt).not.toContain('Agent Memory')
	})

	it('should list team roster in context', async () => {
		await setupCompanyDir()

		const result = await assembleContext({
			companyRoot: root,
			agent: testAgent,
			company: testCompany,
			allAgents: testAgents,
			storage: mockStorage,
		})

		expect(result.systemPrompt).toContain('Sophia')
		expect(result.systemPrompt).toContain('planner-1')
	})
})

describe('loadAgentMemory', () => {
	let cleanup: () => Promise<void>
	let root: string

	afterEach(async () => {
		if (cleanup) await cleanup()
	})

	it('should return null when no memory.yaml exists', async () => {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup

		const memory = await loadAgentMemory(root, 'nonexistent-agent')
		expect(memory).toBeNull()
	})

	it('should load memory when memory.yaml exists', async () => {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup

		const memoryDir = join(root, 'context', 'memory', 'dev-1')
		await mkdir(memoryDir, { recursive: true })
		await writeYaml(join(memoryDir, 'memory.yaml'), {
			facts: { stack: ['Bun', 'TypeScript'] },
			decisions: [],
			patterns: ['Use tabs'],
			mistakes: [],
		})

		const memory = await loadAgentMemory(root, 'dev-1')
		expect(memory).not.toBeNull()
		expect(memory?.facts.stack).toEqual(['Bun', 'TypeScript'])
		expect(memory?.patterns).toEqual(['Use tabs'])
	})
})

describe('buildCompanySnapshot', () => {
	let cleanup: () => Promise<void>
	let root: string

	afterEach(async () => {
		if (cleanup) await cleanup()
	})

	it('should return empty snapshot for empty company', async () => {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup

		// Write agents.yaml so loadAgents works
		await writeYaml(join(root, 'team', 'agents.yaml'), { agents: testAgents })

		const snapshot = await buildCompanySnapshot(root, testAgent, mockStorage)

		expect(snapshot.activeTasks).toEqual([])
		expect(snapshot.recentMessages).toEqual([])
		expect(snapshot.dashboardPins).toEqual([])
		expect(snapshot.agentStatuses).toHaveLength(2)
	})

	it('should include active tasks in snapshot', async () => {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup

		await writeYaml(join(root, 'team', 'agents.yaml'), { agents: testAgents })

		const taskData = {
			id: 'task-1',
			title: 'Build feature X',
			description: '',
			type: 'implementation',
			status: 'in_progress',
			priority: 'medium',
			created_by: 'planner-1',
			assigned_to: 'developer-1',
			reviewers: [],
			parent: null,
			depends_on: [],
			blocks: [],
			related: [],
			context: {},
			blockers: [],
			created_at: '2025-01-01T00:00:00.000Z',
			updated_at: '2025-01-01T00:00:00.000Z',
			history: [],
		}

		const storageWithTask: StorageBackend = {
			...mockStorage,
			listTasks: async () => [taskData as any],
		}

		const snapshot = await buildCompanySnapshot(root, testAgent, storageWithTask)

		expect(snapshot.activeTasks).toHaveLength(1)
		expect(snapshot.activeTasks[0]?.title).toBe('Build feature X')
		expect(snapshot.activeTasks[0]?.assigned_to).toBe('developer-1')
	})
})
