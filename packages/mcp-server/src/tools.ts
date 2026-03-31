/**
 * MCP tool definitions for QUESTPIE Autopilot.
 *
 * D33: Core tools (tasks, agents, status, activity)
 * D34: Search + file tools
 * D35: Session + chat tools
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { apiGet, apiPost, apiPut, apiStream } from './api-client'

export function registerTools(server: McpServer): void {
	// ─── D33: Core tools ────────────────────────────────────────────────

	server.tool('task_list', 'List tasks with optional filters', {
		status: z.string().optional().describe('Filter by status (backlog, in_progress, done, etc.)'),
		assigned_to: z.string().optional().describe('Filter by assigned agent ID'),
		limit: z.number().optional().describe('Max results (default 50)'),
	}, async (args) => {
		const params = new URLSearchParams()
		if (args.status) params.set('status', args.status)
		if (args.assigned_to) params.set('assigned_to', args.assigned_to)
		if (args.limit) params.set('limit', String(args.limit))
		const qs = params.toString()
		const data = await apiGet(`/api/tasks${qs ? `?${qs}` : ''}`)
		return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
	})

	server.tool('task_get', 'Get a single task by ID', {
		id: z.string().describe('Task ID'),
	}, async (args) => {
		const data = await apiGet(`/api/tasks/${encodeURIComponent(args.id)}`)
		return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
	})

	server.tool('task_create', 'Create a new task', {
		title: z.string().describe('Task title'),
		description: z.string().optional().describe('Task description'),
		type: z.string().optional().describe('Task type (feature, bug, chore, etc.)'),
		priority: z.string().optional().describe('Priority (critical, high, medium, low)'),
		assigned_to: z.string().optional().describe('Agent ID to assign'),
	}, async (args) => {
		const data = await apiPost('/api/tasks', args)
		return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
	})

	server.tool('task_update', 'Update a task', {
		id: z.string().describe('Task ID'),
		status: z.string().optional().describe('New status'),
		title: z.string().optional().describe('New title'),
		description: z.string().optional().describe('New description'),
		assigned_to: z.string().optional().describe('New assignee'),
	}, async (args) => {
		const { id, ...updates } = args
		const data = await apiPut(`/api/tasks/${encodeURIComponent(id)}`, updates)
		return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
	})

	server.tool('agent_list', 'List all agents', {}, async () => {
		const data = await apiGet('/api/agents')
		return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
	})

	server.tool('agent_steer', 'Send a steering message to a running agent session', {
		session_id: z.string().describe('Session ID'),
		message: z.string().describe('Message to send'),
	}, async (args) => {
		const data = await apiPost(`/api/agent-sessions/${encodeURIComponent(args.session_id)}/steer`, {
			message: args.message,
		})
		return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
	})

	server.tool('status', 'Get system status', {}, async () => {
		const data = await apiGet('/api/status')
		return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
	})

	server.tool('activity', 'Get recent activity', {
		agent: z.string().optional().describe('Filter by agent ID'),
		limit: z.number().optional().describe('Max results (default 20)'),
	}, async (args) => {
		const params = new URLSearchParams()
		if (args.agent) params.set('agent', args.agent)
		if (args.limit) params.set('limit', String(args.limit))
		const qs = params.toString()
		const data = await apiGet(`/api/activity${qs ? `?${qs}` : ''}`)
		return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
	})

	// ─── D34: Search + file tools ───────────────────────────────────────

	server.tool('search', 'Search across tasks, knowledge, messages, and agents', {
		query: z.string().describe('Search query'),
		type: z.string().optional().describe('Filter by entity type (task, knowledge, message, agent)'),
		limit: z.number().optional().describe('Max results (default 20)'),
	}, async (args) => {
		const params = new URLSearchParams({ q: args.query })
		if (args.type) params.set('type', args.type)
		if (args.limit) params.set('limit', String(args.limit))
		const data = await apiGet(`/api/search?${params}`)
		return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
	})

	server.tool('file_read', 'Read a file from the company directory', {
		path: z.string().describe('Relative path from company root'),
	}, async (args) => {
		const data = await apiGet(`/api/fs/${encodeURIComponent(args.path)}`)
		return { content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }] }
	})

	server.tool('file_write', 'Write content to a file in the company directory', {
		path: z.string().describe('Relative path from company root'),
		content: z.string().describe('File content to write'),
	}, async (args) => {
		const data = await apiPost(`/api/fs/${encodeURIComponent(args.path)}`, { content: args.content })
		return { content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }] }
	})

	server.tool('file_list', 'List files in a directory', {
		path: z.string().optional().describe('Directory path (default: root)'),
	}, async (args) => {
		const data = await apiGet(`/api/fs${args.path ? `/${encodeURIComponent(args.path)}` : ''}`)
		return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
	})

	// ─── D35: Session + chat tools ──────────────────────────────────────

	server.tool('session_list', 'List active agent sessions', {}, async () => {
		const data = await apiGet('/api/agent-sessions')
		return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
	})

	server.tool('session_stream', 'Get session stream events', {
		session_id: z.string().describe('Session ID'),
	}, async (args) => {
		const data = await apiStream(`/api/agent-sessions/${encodeURIComponent(args.session_id)}/stream`)
		return { content: [{ type: 'text', text: data }] }
	})

	server.tool('chat_send', 'Send a message to an agent via streaming chat', {
		agent_id: z.string().describe('Agent ID'),
		message: z.string().describe('Message to send'),
	}, async (args) => {
		const data = await apiPost(`/api/chat/${encodeURIComponent(args.agent_id)}`, {
			message: args.message,
		})
		return { content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }] }
	})

	server.tool('chat_history', 'Get chat history for a channel', {
		channel_id: z.string().describe('Channel ID'),
		limit: z.number().optional().describe('Max messages (default 50)'),
	}, async (args) => {
		const params = new URLSearchParams()
		if (args.limit) params.set('limit', String(args.limit))
		const qs = params.toString()
		const data = await apiGet(`/api/channels/${encodeURIComponent(args.channel_id)}/messages${qs ? `?${qs}` : ''}`)
		return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
	})
}
