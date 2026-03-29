import { describe, it, expect, beforeEach, afterEach, spyOn, mock } from 'bun:test'
import { routeMessage } from '../src/router/message-router'
import { container } from '../src/container'
import * as microAgent from '../src/agent/micro-agent'
import type { Agent } from '@questpie/autopilot-spec'
import type { StorageBackend, ActivityEntry } from '../src/fs/storage'

function createMockStorage(tasks: any[] = []): StorageBackend {
	return {
		initialize: async () => {},
		close: async () => {},
		createTask: async () => ({}) as any,
		readTask: async () => null,
		updateTask: async () => ({}) as any,
		moveTask: async () => ({}) as any,
		listTasks: async () => tasks,
		countTasks: async () => tasks.length,
		deleteTask: async () => {},
		sendMessage: async () => ({}) as any,
		readMessages: async () => [],
		searchMessages: async () => [],
		appendActivity: async () => {},
		readActivity: async () => [],
	}
}

function makeAgent(overrides: Partial<Agent> & { id: string; role: string }): Agent {
	return {
		name: overrides.name ?? overrides.id,
		description: overrides.description ?? `${overrides.role} agent`,
		provider: 'tanstack-ai',
		model: 'anthropic/claude-sonnet-4',
		fs_scope: { read: ['**'], write: ['**'] },
		tools: ['fs', 'terminal'],
		mcps: [],
		triggers: [],
		...overrides,
	} as Agent
}

describe('routeMessage', () => {
	let mockStorage: StorageBackend
	let resolveAsyncSpy: ReturnType<typeof spyOn>
	let classifySpy: ReturnType<typeof spyOn>

	const agents: Agent[] = [
		makeAgent({ id: 'dev', name: 'Developer', role: 'developer' }),
		makeAgent({ id: 'ceo', name: 'CEO', role: 'meta' }),
		makeAgent({ id: 'devops', name: 'DevOps', role: 'devops' }),
		makeAgent({ id: 'marketer', name: 'Marketer', role: 'marketing' }),
	]

	beforeEach(() => {
		mockStorage = createMockStorage()
		// Mock container.resolveAsync to return our mock storage instead of
		// going through the real factory chain (which requires a real companyRoot).
		resolveAsyncSpy = spyOn(container, 'resolveAsync').mockResolvedValue({
			storage: mockStorage,
		} as any)
		// Mock classify() to prevent real LLM calls — return null to test keyword/CEO fallback
		classifySpy = spyOn(microAgent, 'classify').mockResolvedValue(null)
	})

	afterEach(() => {
		resolveAsyncSpy.mockRestore()
		classifySpy.mockRestore()
	})

	it('routes @mention to correct agent', async () => {
		const result = await routeMessage('Hey @dev can you fix this?', agents, '/tmp/fake')
		expect(result.agent.id).toBe('dev')
		expect(result.reason).toContain('@dev')
	})

	it('routes task reference (task-xxx) to assigned agent', async () => {
		const tasksWithAssignment = [
			{ id: 'task-abc123', assigned_to: 'devops', title: 'Deploy', status: 'in_progress' },
		]
		mockStorage = createMockStorage(tasksWithAssignment)
		resolveAsyncSpy.mockResolvedValue({ storage: mockStorage } as any)

		const result = await routeMessage('What is the status of task-abc123?', agents, '/tmp/fake')
		expect(result.agent.id).toBe('devops')
		expect(result.reason).toContain('task-abc123')
	})

	it('routes by keyword (developer keywords to dev agent)', async () => {
		const result = await routeMessage('Please implement the new feature and fix the bug', agents, '/tmp/fake')
		expect(result.agent.id).toBe('dev')
		expect(result.reason).toContain('developer')
	})

	it('falls back to CEO agent when no match', async () => {
		const result = await routeMessage('hello there', agents, '/tmp/fake')
		expect(result.agent.id).toBe('ceo')
		expect(result.reason).toContain('CEO')
	})

	it('returns first agent when no agents have meta role', async () => {
		const noMetaAgents = [
			makeAgent({ id: 'dev', name: 'Developer', role: 'developer' }),
			makeAgent({ id: 'devops', name: 'DevOps', role: 'devops' }),
		]
		const result = await routeMessage('hello there', noMetaAgents, '/tmp/fake')
		// Falls back to agents[0] when no meta role found
		expect(result.agent.id).toBe('dev')
		expect(result.reason).toContain('CEO')
	})

	it('handles empty message', async () => {
		const result = await routeMessage('', agents, '/tmp/fake')
		// No keywords match, so should fall back to CEO
		expect(result.agent.id).toBe('ceo')
		expect(result.reason).toContain('CEO')
	})

	// ── Keyword routing for other roles ──────────────────────────────────

	it('routes devops keywords to devops agent', async () => {
		const result = await routeMessage('We need to deploy to kubernetes and check the docker containers', agents, '/tmp/fake')
		expect(result.agent.id).toBe('devops')
	})

	it('routes marketing keywords to marketer agent', async () => {
		const result = await routeMessage('Write a blog post for the launch campaign', agents, '/tmp/fake')
		expect(result.agent.id).toBe('marketer')
	})

	// ── Priority: @mention > task ref > keyword ─────────────────────────

	it('@mention wins over keyword match', async () => {
		// "deploy" is a devops keyword, but @dev is an explicit mention
		const result = await routeMessage('@dev deploy the new version', agents, '/tmp/fake')
		expect(result.agent.id).toBe('dev')
		expect(result.reason).toContain('@dev')
	})

	it('task reference wins over keyword', async () => {
		const tasksWithAssignment = [
			{ id: 'task-xyz', assigned_to: 'marketer', title: 'Campaign', status: 'in_progress' },
		]
		mockStorage = createMockStorage(tasksWithAssignment)
		resolveAsyncSpy.mockResolvedValue({ storage: mockStorage } as any)

		// "deploy" matches devops keywords, but task-xyz is assigned to marketer
		const result = await routeMessage('Check task-xyz about the deploy', agents, '/tmp/fake')
		expect(result.agent.id).toBe('marketer')
	})

	// ── D47: Custom agent keywords ──────────────────────────────────────

	it('uses custom agent.keywords when defined', async () => {
		const customAgents: Agent[] = [
			makeAgent({ id: 'specialist', role: 'custom', keywords: ['quantum', 'physics'] } as any),
			makeAgent({ id: 'dev', role: 'developer' }),
		]
		const result = await routeMessage('Tell me about quantum computing', customAgents, '/tmp/fake')
		expect(result.agent.id).toBe('specialist')
	})

	it('falls back to role defaults when no custom keywords', async () => {
		const result = await routeMessage('Fix the bug in the API endpoint', agents, '/tmp/fake')
		expect(result.agent.id).toBe('dev') // developer role defaults
	})

	// ── Edge cases ──────────────────────────────────────────────────────

	it('@mention for non-existent agent falls through to keywords', async () => {
		const result = await routeMessage('@ghost please help with the code bug', agents, '/tmp/fake')
		// @ghost doesn't match any agent, so falls to keyword 'code' + 'bug' → dev
		expect(result.agent.id).toBe('dev')
	})

	it('case-insensitive keyword matching', async () => {
		const result = await routeMessage('DEPLOY the DOCKER containers NOW', agents, '/tmp/fake')
		expect(result.agent.id).toBe('devops')
	})
})
