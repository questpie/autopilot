/**
 * MCP tool definitions for QUESTPIE Autopilot.
 *
 * Only tools that map to real, existing orchestrator endpoints.
 * Tasks: GET/POST/PATCH /api/tasks
 * Runs:  GET /api/runs
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { apiGet, apiPost, apiPatch } from './api-client'

export function registerTools(server: McpServer): void {
	// ─── Tasks ──────────────────────────────────────────────────────────

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
		const data = await apiPatch(`/api/tasks/${encodeURIComponent(id)}`, updates)
		return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
	})

	// ─── Runs ───────────────────────────────────────────────────────────

	server.tool('run_list', 'List runs with optional filters', {
		task_id: z.string().optional().describe('Filter by task ID'),
		status: z.string().optional().describe('Filter by status'),
		limit: z.number().optional().describe('Max results (default 50)'),
	}, async (args) => {
		const params = new URLSearchParams()
		if (args.task_id) params.set('task_id', args.task_id)
		if (args.status) params.set('status', args.status)
		if (args.limit) params.set('limit', String(args.limit))
		const qs = params.toString()
		const data = await apiGet(`/api/runs${qs ? `?${qs}` : ''}`)
		return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
	})

	server.tool('run_get', 'Get a single run by ID', {
		id: z.string().describe('Run ID'),
	}, async (args) => {
		const data = await apiGet(`/api/runs/${encodeURIComponent(args.id)}`)
		return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
	})

	// ─── Approval ──────────────────────────────────────────────────────

	server.tool('task_approve', 'Approve a task waiting on a human_approval workflow step', {
		id: z.string().describe('Task ID'),
	}, async (args) => {
		const data = await apiPost(`/api/tasks/${encodeURIComponent(args.id)}/approve`, {})
		return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
	})

	server.tool('task_reject', 'Reject a task waiting on a human_approval workflow step', {
		id: z.string().describe('Task ID'),
		message: z.string().describe('Rejection reason'),
	}, async (args) => {
		const data = await apiPost(`/api/tasks/${encodeURIComponent(args.id)}/reject`, { message: args.message })
		return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
	})

	server.tool('task_reply', 'Reply to a task waiting on a human_approval step and advance the workflow. The reply message becomes instructions for the next agent step.', {
		id: z.string().describe('Task ID'),
		message: z.string().describe('Reply message (becomes instructions for next run)'),
	}, async (args) => {
		const data = await apiPost(`/api/tasks/${encodeURIComponent(args.id)}/reply`, { message: args.message })
		return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
	})

	server.tool('task_activity', 'Get approval/rejection/reply history for a task', {
		id: z.string().describe('Task ID'),
	}, async (args) => {
		const data = await apiGet(`/api/tasks/${encodeURIComponent(args.id)}/activity`)
		return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
	})

	// ─── Artifacts ─────────────────────────────────────────────────────

	server.tool('run_artifacts', 'List artifacts produced by a run. Artifacts are references (file paths, URLs, or short inline text) — not large blobs.', {
		run_id: z.string().describe('Run ID'),
	}, async (args) => {
		const data = await apiGet(`/api/runs/${encodeURIComponent(args.run_id)}/artifacts`)
		return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
	})
}
