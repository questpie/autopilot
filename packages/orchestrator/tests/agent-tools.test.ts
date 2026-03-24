import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { createAutopilotTools, executeTool, type ToolContext, type ToolDefinition } from '../src/agent/tools'
import type { StorageBackend, ActivityEntry, Task, Message } from '../src/fs/storage'
import { createTestCompany } from './helpers'

function createMockStorage() {
	const tasks: Map<string, any> = new Map()
	const messages: any[] = []
	const activityLog: ActivityEntry[] = []

	const storage: StorageBackend = {
		initialize: async () => {},
		close: async () => {},

		createTask: async (task: Task) => {
			const id = task.id ?? `task-${Date.now().toString(36)}`
			const created = { ...task, id }
			tasks.set(id, created)
			return created
		},
		readTask: async (id: string) => tasks.get(id) ?? null,
		updateTask: async (id: string, updates: Partial<Task>) => {
			const existing = tasks.get(id)
			if (!existing) throw new Error(`Task not found: ${id}`)
			const updated = { ...existing, ...updates }
			tasks.set(id, updated)
			return updated
		},
		moveTask: async (id: string, newStatus: string) => {
			const existing = tasks.get(id)
			if (!existing) throw new Error(`Task not found: ${id}`)
			existing.status = newStatus
			tasks.set(id, existing)
			return existing
		},
		listTasks: async () => [...tasks.values()],
		countTasks: async () => tasks.size,
		deleteTask: async (id: string) => {
			tasks.delete(id)
		},

		sendMessage: async (msg: Message) => {
			messages.push(msg)
			return msg
		},
		readMessages: async () => messages,
		searchMessages: async () => [],

		appendActivity: async (entry: ActivityEntry) => {
			activityLog.push(entry)
		},
		readActivity: async () => activityLog,
	}

	return { storage, tasks, messages, activityLog }
}

describe('createAutopilotTools', () => {
	let cleanup: () => Promise<void>
	let companyRoot: string
	let mockStorage: ReturnType<typeof createMockStorage>
	let tools: ToolDefinition[]

	beforeEach(async () => {
		const ctx = await createTestCompany()
		companyRoot = ctx.root
		cleanup = ctx.cleanup
		mockStorage = createMockStorage()
		tools = createAutopilotTools(companyRoot, mockStorage.storage)
	})

	afterEach(async () => {
		if (cleanup) await cleanup()
	})

	const makeContext = (agentId = 'test-agent'): ToolContext => ({
		companyRoot: companyRoot,
		agentId,
		storage: mockStorage.storage,
	})

	it('returns an array of tool definitions', () => {
		expect(Array.isArray(tools)).toBe(true)
		expect(tools.length).toBeGreaterThan(0)
	})

	it('each tool has name, description, schema, execute', () => {
		for (const tool of tools) {
			expect(typeof tool.name).toBe('string')
			expect(tool.name.length).toBeGreaterThan(0)
			expect(typeof tool.description).toBe('string')
			expect(tool.schema).toBeDefined()
			expect(typeof tool.execute).toBe('function')
		}
	})

	it('create_task tool creates a task via storage', async () => {
		const result = await executeTool(
			tools,
			'create_task',
			{ title: 'Test task', type: 'implementation', priority: 'medium' },
			makeContext(),
		)
		expect(result.isError).toBeUndefined()
		expect(result.content[0]!.text).toContain('Created task')
		expect(result.content[0]!.text).toContain('Test task')
		expect(mockStorage.tasks.size).toBe(1)
		const task = [...mockStorage.tasks.values()][0]!
		expect(task.title).toBe('Test task')
		expect(task.created_by).toBe('test-agent')
	})

	it('update_task tool updates task via storage', async () => {
		// Create a task first
		await executeTool(
			tools,
			'create_task',
			{ title: 'To update', type: 'implementation' },
			makeContext(),
		)
		const taskId = [...mockStorage.tasks.keys()][0]!

		const result = await executeTool(
			tools,
			'update_task',
			{ task_id: taskId, status: 'in_progress' },
			makeContext(),
		)
		expect(result.isError).toBeUndefined()
		expect(result.content[0]!.text).toContain('Updated task')
		const updated = mockStorage.tasks.get(taskId)!
		expect(updated.status).toBe('in_progress')
	})

	it('send_message tool sends message via storage', async () => {
		const result = await executeTool(
			tools,
			'send_message',
			{ to: 'channel:dev', content: 'Hello team' },
			makeContext('dev-agent'),
		)
		expect(result.isError).toBeUndefined()
		expect(result.content[0]!.text).toContain('Message sent to channel:dev')
		expect(mockStorage.messages).toHaveLength(1)
		expect(mockStorage.messages[0]!.content).toBe('Hello team')
		expect(mockStorage.messages[0]!.from).toBe('dev-agent')
	})

	it('pin_to_board tool creates a pin', async () => {
		const result = await executeTool(
			tools,
			'pin_to_board',
			{ group: 'alerts', title: 'Test pin', type: 'info' },
			makeContext(),
		)
		expect(result.isError).toBeUndefined()
		expect(result.content[0]!.text).toContain('Pinned: Test pin')
	})

	it('search tool returns results (graceful fallback)', async () => {
		// The search tool tries to import db modules which may not have an initialized db.
		// It should gracefully return "Search index not available." rather than throwing.
		const result = await executeTool(
			tools,
			'search',
			{ query: 'test query' },
			makeContext(),
		)
		expect(result.isError).toBeUndefined()
		// Either "No results found." or "Search index not available." is acceptable
		expect(
			result.content[0]!.text === 'No results found.' ||
				result.content[0]!.text === 'Search index not available.',
		).toBe(true)
	})

	it('tools use correct ToolContext.agentId', async () => {
		await executeTool(
			tools,
			'create_task',
			{ title: 'Agent check', type: 'implementation' },
			makeContext('custom-agent-id'),
		)
		const task = [...mockStorage.tasks.values()][0]!
		expect(task.created_by).toBe('custom-agent-id')
	})
})
