/**
 * MCP tool definitions for QUESTPIE Autopilot.
 *
 * Type-safe wrappers around orchestrator endpoints via Hono RPC client.
 * Tasks: GET/POST/PATCH /api/tasks
 * Runs:  GET /api/runs
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { tasks, runs, schedulesApi } from './api-client'

type ToolResult = { content: Array<{ type: 'text'; text: string }> }

async function ok(res: Response): Promise<ToolResult> {
	if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
	const data = await res.json()
	return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}

// ─── Handlers (standalone to avoid TS2589 depth overflow) ───────────

async function handleTaskList(args: { status?: string; assigned_to?: string }) {
	return ok(await tasks.$get({ query: { status: args.status, assigned_to: args.assigned_to } }))
}

async function handleTaskGet(args: { id: string }) {
	return ok(await tasks[':id'].$get({ param: { id: args.id } }))
}

async function handleTaskCreate(args: {
	title: string
	type: string
	description?: string
	priority?: string
	assigned_to?: string
}) {
	return ok(await tasks.$post({ json: args }))
}

async function handleTaskUpdate(args: {
	id: string
	status?: string
	title?: string
	description?: string
	assigned_to?: string
}) {
	const { id, ...updates } = args
	return ok(await tasks[':id'].$patch({ param: { id }, json: updates }))
}

async function handleRunList(args: { task_id?: string; status?: string }) {
	return ok(await runs.$get({ query: { task_id: args.task_id, status: args.status } }))
}

async function handleRunGet(args: { id: string }) {
	return ok(await runs[':id'].$get({ param: { id: args.id } }))
}

async function handleTaskApprove(args: { id: string }) {
	return ok(await tasks[':id'].approve.$post({ param: { id: args.id } }))
}

async function handleTaskReject(args: { id: string; message: string }) {
	return ok(await tasks[':id'].reject.$post({ param: { id: args.id }, json: { message: args.message } }))
}

async function handleTaskReply(args: { id: string; message: string }) {
	return ok(await tasks[':id'].reply.$post({ param: { id: args.id }, json: { message: args.message } }))
}

async function handleTaskActivity(args: { id: string }) {
	return ok(await tasks[':id'].activity.$get({ param: { id: args.id } }))
}

async function handleRunArtifacts(args: { run_id: string }) {
	return ok(await runs[':id'].artifacts.$get({ param: { id: args.run_id } }))
}

async function handleTaskSpawnChildren(args: {
	parent_task_id: string
	children: Array<{
		title: string
		type: string
		description?: string
		priority?: string
		assigned_to?: string
		workflow_id?: string
		context?: string
		metadata?: string
		dedupe_key?: string
	}>
	relation_type?: string
	origin_run_id?: string
}) {
	return ok(
		await tasks[':id']['spawn-children'].$post({
			param: { id: args.parent_task_id },
			json: {
				children: args.children,
				relation_type: args.relation_type,
				origin_run_id: args.origin_run_id,
			},
		}),
	)
}

async function handleTaskChildren(args: { id: string; relation_type?: string }) {
	return ok(await tasks[':id'].children.$get({ param: { id: args.id }, query: { relation_type: args.relation_type } }))
}

async function handleTaskParents(args: { id: string; relation_type?: string }) {
	return ok(await tasks[':id'].parents.$get({ param: { id: args.id }, query: { relation_type: args.relation_type } }))
}

async function handleScheduleList() {
	return ok(await schedulesApi.$get())
}

async function handleScheduleCreate(args: {
	name: string
	cron: string
	agent_id: string
	workflow_id?: string
	task_template?: string
	mode?: string
	query_template?: string
	concurrency_policy?: string
	timezone?: string
	enabled?: boolean
}) {
	return ok(await schedulesApi.$post({ json: args }))
}

async function handleScheduleUpdate(args: {
	id: string
	name?: string
	cron?: string
	agent_id?: string
	workflow_id?: string
	task_template?: string
	mode?: string
	query_template?: string
	concurrency_policy?: string
	timezone?: string
	enabled?: boolean
}) {
	const { id, ...updates } = args
	return ok(await schedulesApi[':id'].$patch({ param: { id }, json: updates }))
}

async function handleScheduleDelete(args: { id: string }) {
	return ok(await schedulesApi[':id'].$delete({ param: { id: args.id } }))
}

// ─── Tool registration ─────────────────────────────────────────────

export function registerTools(server: McpServer): void {
	server.tool('task_list', 'List tasks with optional filters', {
		status: z.string().optional().describe('Filter by status (backlog, in_progress, done, etc.)'),
		assigned_to: z.string().optional().describe('Filter by assigned agent ID'),
	}, handleTaskList)

	server.tool('task_get', 'Get a single task by ID', {
		id: z.string().describe('Task ID'),
	}, handleTaskGet)

	server.tool('task_create', 'Create a new task', {
		title: z.string().describe('Task title'),
		type: z.string().describe('Task type (feature, bug, chore, etc.)'),
		description: z.string().optional().describe('Task description'),
		priority: z.string().optional().describe('Priority (critical, high, medium, low)'),
		assigned_to: z.string().optional().describe('Agent ID to assign'),
	}, handleTaskCreate)

	server.tool('task_update', 'Update a task', {
		id: z.string().describe('Task ID'),
		status: z.string().optional().describe('New status'),
		title: z.string().optional().describe('New title'),
		description: z.string().optional().describe('New description'),
		assigned_to: z.string().optional().describe('New assignee'),
	}, handleTaskUpdate)

	server.tool('run_list', 'List runs with optional filters', {
		task_id: z.string().optional().describe('Filter by task ID'),
		status: z.string().optional().describe('Filter by status'),
	}, handleRunList)

	server.tool('run_get', 'Get a single run by ID', {
		id: z.string().describe('Run ID'),
	}, handleRunGet)

	server.tool('task_approve', 'Approve a task waiting on a human_approval workflow step', {
		id: z.string().describe('Task ID'),
	}, handleTaskApprove)

	server.tool('task_reject', 'Reject a task waiting on a human_approval workflow step', {
		id: z.string().describe('Task ID'),
		message: z.string().describe('Rejection reason'),
	}, handleTaskReject)

	server.tool('task_reply', 'Reply to a task waiting on a human_approval step and advance the workflow. The reply message becomes instructions for the next agent step.', {
		id: z.string().describe('Task ID'),
		message: z.string().describe('Reply message (becomes instructions for next run)'),
	}, handleTaskReply)

	server.tool('task_activity', 'Get approval/rejection/reply history for a task', {
		id: z.string().describe('Task ID'),
	}, handleTaskActivity)

	server.tool('run_artifacts', 'List artifacts produced by a run. Artifacts are references (file paths, URLs, or short inline text) — not large blobs.', {
		run_id: z.string().describe('Run ID'),
	}, handleRunArtifacts)

	server.tool('task_spawn_children', 'Create child tasks for a parent task (idempotent). Use dedupe_key to avoid duplicates on rerun.', {
		parent_task_id: z.string().describe('Parent task ID'),
		children: z.array(z.object({
			title: z.string().describe('Child task title'),
			description: z.string().optional().describe('Child task description'),
			type: z.string().describe('Task type (feature, bug, chore, etc.)'),
			priority: z.string().optional().describe('Priority (critical, high, medium, low)'),
			assigned_to: z.string().optional().describe('Agent ID to assign'),
			workflow_id: z.string().optional().describe('Workflow ID override'),
			context: z.string().optional().describe('Task context JSON'),
			metadata: z.string().optional().describe('Task metadata JSON'),
			dedupe_key: z.string().optional().describe('Unique key for idempotent creation'),
		})).describe('Child task candidates'),
		relation_type: z.string().optional().describe('Relation type (default: decomposes_to)'),
		origin_run_id: z.string().optional().describe('Run ID that triggered this decomposition'),
	}, handleTaskSpawnChildren)

	server.tool('task_children', 'List child tasks of a parent task', {
		id: z.string().describe('Parent task ID'),
		relation_type: z.string().optional().describe('Relation type filter (default: decomposes_to)'),
	}, handleTaskChildren)

	server.tool('task_parents', 'List parent tasks of a child task', {
		id: z.string().describe('Child task ID'),
		relation_type: z.string().optional().describe('Relation type filter (default: decomposes_to)'),
	}, handleTaskParents)

	// ─── Schedule tools ───────────────────────────────────────────────

	server.tool('schedule_list', 'List all schedules', {}, handleScheduleList)

	server.tool('schedule_create', 'Create a new schedule with a cron expression', {
		name: z.string().describe('Schedule name'),
		cron: z.string().describe('Cron expression (e.g. "0 9 * * *" for 9 AM daily)'),
		agent_id: z.string().describe('Agent ID to run'),
		workflow_id: z.string().optional().describe('Workflow ID'),
		task_template: z.string().optional().describe('JSON string: { title, description, type, priority }'),
		mode: z.enum(['task', 'query']).optional().describe('Execution mode: task or query'),
		query_template: z.string().optional().describe('JSON string: { prompt, allow_repo_mutation }'),
		concurrency_policy: z.enum(['skip', 'allow', 'queue']).optional().describe('Concurrency policy'),
		timezone: z.string().optional().describe('Timezone (default: UTC)'),
		enabled: z.boolean().optional().describe('Whether the schedule is enabled (default: true)'),
	}, handleScheduleCreate)

	server.tool('schedule_update', 'Update a schedule', {
		id: z.string().describe('Schedule ID'),
		name: z.string().optional().describe('New name'),
		cron: z.string().optional().describe('New cron expression'),
		agent_id: z.string().optional().describe('New agent ID'),
		workflow_id: z.string().optional().describe('New workflow ID'),
		task_template: z.string().optional().describe('New task template JSON'),
		mode: z.enum(['task', 'query']).optional().describe('Execution mode'),
		query_template: z.string().optional().describe('New query template JSON'),
		concurrency_policy: z.enum(['skip', 'allow', 'queue']).optional().describe('Concurrency policy'),
		timezone: z.string().optional().describe('Timezone'),
		enabled: z.boolean().optional().describe('Enable/disable'),
	}, handleScheduleUpdate)

	server.tool('schedule_delete', 'Delete a schedule', {
		id: z.string().describe('Schedule ID'),
	}, handleScheduleDelete)
}
