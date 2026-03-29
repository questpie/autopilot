import { describe, it, expect, beforeEach, afterEach, spyOn } from 'bun:test'
import { routeMessage } from '../src/router/message-router'
import { container } from '../src/container'
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
	})

	afterEach(() => {
		resolveAsyncSpy.mockRestore()
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
})
