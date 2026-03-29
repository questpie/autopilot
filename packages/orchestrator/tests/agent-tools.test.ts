import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import {
	type ToolContext,
	type ToolDefinition,
	createAutopilotTools,
	executeTool,
} from '../src/agent/tools'
import { EventBus } from '../src/events/event-bus'
import type {
	ActivityEntry,
	Channel,
	ChannelFilter,
	ChannelMember,
	Message,
	MessageFilter,
	StorageBackend,
	Task,
} from '../src/fs/storage'
import { createTestCompany } from './helpers'

function createMockStorage() {
	const tasks = new Map<string, Task>()
	const messages: Message[] = []
	const activityLog: ActivityEntry[] = []
	const channels: Map<string, Channel & { members: ChannelMember[] }> = new Map()

	const ensureChannel = (channel: Channel) => {
		const existing = channels.get(channel.id)
		if (existing) return existing
		const withMembers = { ...channel, members: [] as ChannelMember[] }
		channels.set(channel.id, withMembers)
		return withMembers
	}

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
		updateTask: async (id: string, updates: Partial<Task>, _updatedBy: string) => {
			const existing = tasks.get(id)
			if (!existing) throw new Error(`Task not found: ${id}`)
			const updated = { ...existing, ...updates }
			tasks.set(id, updated)
			return updated
		},
		moveTask: async (id: string, newStatus: string, _movedBy: string) => {
			const existing = tasks.get(id)
			if (!existing) throw new Error(`Task not found: ${id}`)
			existing.status = newStatus as Task['status']
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
		readMessages: async (_filter: MessageFilter) => messages,
		searchMessages: async () => [],

		appendActivity: async (entry: ActivityEntry) => {
			activityLog.push(entry)
		},
		readActivity: async () => activityLog,

		createChannel: async (channel) => ensureChannel(channel),
		readChannel: async (id) => channels.get(id) ?? null,
		listChannels: async (_filter?: ChannelFilter) => Array.from(channels.values()),
		deleteChannel: async (id) => {
			channels.delete(id)
		},

		addChannelMember: async (channelId, actorId, actorType, role = 'member') => {
			const channel = channels.get(channelId)
			if (!channel) throw new Error(`Channel not found: ${channelId}`)
			if (channel.members.some((m) => m.actor_id === actorId)) return
			channel.members.push({
				channel_id: channelId,
				actor_id: actorId,
				actor_type: actorType === 'human' ? 'human' : 'agent',
				role: role === 'owner' || role === 'readonly' ? role : 'member',
				joined_at: new Date().toISOString(),
			})
		},
		removeChannelMember: async (channelId, actorId) => {
			const channel = channels.get(channelId)
			if (!channel) return
			channel.members = channel.members.filter((m) => m.actor_id !== actorId)
		},
		getChannelMembers: async (channelId) => channels.get(channelId)?.members ?? [],
		isChannelMember: async (channelId, actorId) => {
			const channel = channels.get(channelId)
			return channel?.members.some((m) => m.actor_id === actorId) ?? false
		},
		getOrCreateDirectChannel: async (actorA, actorB) => {
			const sorted = [actorA, actorB].sort()
			const id = `dm-${sorted[0]}-${sorted[1]}`
			const existing = channels.get(id)
			if (existing) return existing
			const now = new Date().toISOString()
			const channel: Channel = {
				id,
				name: `DM ${sorted[0]} ${sorted[1]}`,
				type: 'direct',
				description: '',
				created_by: actorA,
				created_at: now,
				updated_at: now,
				metadata: {},
			}
			const created = ensureChannel(channel)
			await storage.addChannelMember(id, actorA, 'agent', 'member')
			await storage.addChannelMember(id, actorB, 'agent', 'member')
			return created
		},
	}

	return { storage, tasks, messages, activityLog, channels }
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
		eventBus: new EventBus(),
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

	it('task tool creates a task via storage', async () => {
		const result = await executeTool(
			tools,
			'task',
			{ action: 'create', title: 'Test task', type: 'implementation', priority: 'medium' },
			makeContext(),
		)
		const firstContent = result.content[0]
		expect(result.isError).toBeUndefined()
		expect(firstContent?.text).toContain('Created task')
		expect(firstContent?.text).toContain('Test task')
		expect(mockStorage.tasks.size).toBe(1)
		const task = [...mockStorage.tasks.values()][0]
		expect(task).toBeDefined()
		expect(task.title).toBe('Test task')
		expect(task.created_by).toBe('test-agent')
	})

	it('task tool updates task via storage', async () => {
		// Create a task first
		await executeTool(
			tools,
			'task',
			{ action: 'create', title: 'To update', type: 'implementation' },
			makeContext(),
		)
		const taskId = [...mockStorage.tasks.keys()][0]
		expect(taskId).toBeDefined()

		const result = await executeTool(
			tools,
			'task',
			{ action: 'update', task_id: taskId as string, status: 'in_progress' },
			makeContext(),
		)
		const firstContent = result.content[0]
		expect(result.isError).toBeUndefined()
		expect(firstContent?.text).toContain('Updated task')
		const updated = mockStorage.tasks.get(taskId as string)
		expect(updated).toBeDefined()
		if (!updated) throw new Error('expected updated task')
		expect(updated.status).toBe('in_progress')
	})

	it('message tool sends message via storage', async () => {
		const result = await executeTool(
			tools,
			'message',
			{ channel: 'task-123', content: 'Hello team' },
			makeContext('dev-agent'),
		)
		const firstContent = result.content[0]
		expect(result.isError).toBeUndefined()
		expect(firstContent?.text).toContain('Message sent to #task-123')
		expect(mockStorage.messages).toHaveLength(1)
		expect(mockStorage.messages[0]?.content).toBe('Hello team')
		expect(mockStorage.messages[0]?.from).toBe('dev-agent')
	})

	it('pin tool exists in tool list', () => {
		const pinTool = tools.find(t => t.name === 'pin')
		expect(pinTool).toBeDefined()
		expect(pinTool!.description).toContain('Pin')
	})

	it('search tool returns results (graceful fallback)', async () => {
		// The search tool tries to import db modules which may not have an initialized db.
		// It should gracefully return an error or empty result rather than throwing.
		const result = await executeTool(tools, 'search', { query: 'test query' }, makeContext())
		const firstContent = result.content[0]
		// Should return some text (error message or empty results), not throw
		expect(firstContent?.text).toBeDefined()
	})

	it('tools use correct ToolContext.agentId', async () => {
		await executeTool(
			tools,
			'task',
			{ action: 'create', title: 'Agent check', type: 'implementation' },
			makeContext('custom-agent-id'),
		)
		const task = [...mockStorage.tasks.values()][0]
		expect(task).toBeDefined()
		expect(task.created_by).toBe('custom-agent-id')
	})

	it('executeTool returns error for unknown tool name', async () => {
		const result = await executeTool(tools, 'nonexistent_tool', {}, makeContext())
		expect(result.isError).toBe(true)
		expect(result.content[0]?.text).toContain('Unknown tool')
	})

	it('task tool returns error for unknown action', async () => {
		const result = await executeTool(tools, 'task', { action: 'delete', title: 'X' }, makeContext())
		// 'delete' is not a valid action — should error at schema parse or unknown action
		expect(result.content[0]?.text).toBeDefined()
	})

	it('message tool sends to DM channel', async () => {
		const result = await executeTool(tools, 'message', {
			channel: 'dm-agent-dev',
			content: 'Direct message test',
		}, makeContext())
		expect(result.isError).toBeFalsy()
	})

	it('all tools have unique names', () => {
		const names = tools.map(t => t.name)
		const unique = new Set(names)
		expect(unique.size).toBe(names.length)
	})

	it('all tool schemas are Zod objects', () => {
		for (const tool of tools) {
			expect(tool.schema).toBeDefined()
			expect(typeof tool.schema.parse).toBe('function')
		}
	})
})
