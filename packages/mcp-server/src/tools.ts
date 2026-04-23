/**
 * MCP tool definitions for QUESTPIE Autopilot.
 *
 * Type-safe wrappers around orchestrator endpoints via Hono RPC client.
 * Tasks: GET/POST/PATCH /api/tasks
 * Runs:  GET /api/runs
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { projectsApi, runs, schedulesApi, searchApi, tasks } from './api-client'
import { env } from './env'

type ToolResult = { content: Array<{ type: 'text'; text: string }> }

async function ok(res: Response): Promise<ToolResult> {
	if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
	const data = await res.json()
	return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}

function apiHeaders(): Record<string, string> {
	const headers: Record<string, string> = { 'Content-Type': 'application/json' }
	if (env.AUTOPILOT_LOCAL_DEV === 'true') {
		headers['X-Local-Dev'] = 'true'
	} else if (env.AUTOPILOT_API_KEY) {
		headers.Authorization = `Bearer ${env.AUTOPILOT_API_KEY}`
	}
	return headers
}

async function configRequest(
	method: 'GET' | 'POST' | 'PUT' | 'DELETE',
	path: string,
	body?: unknown,
	query?: Record<string, string | undefined>,
): Promise<ToolResult> {
	const url = new URL(`${env.AUTOPILOT_API_URL}/api/config/${path}`)
	for (const [key, value] of Object.entries(query ?? {})) {
		if (value) url.searchParams.set(key, value)
	}

	return ok(
		await fetch(url, {
			method,
			headers: apiHeaders(),
			...(body !== undefined ? { body: JSON.stringify(body) } : {}),
		}),
	)
}

async function knowledgeRequest(
	method: 'GET' | 'PUT' | 'DELETE',
	path: string,
	body?: unknown,
	query?: Record<string, string | undefined>,
): Promise<ToolResult> {
	const trimmedPath = path.replace(/^\/+/, '')
	const url = new URL(`${env.AUTOPILOT_API_URL}/api/knowledge/${trimmedPath}`)
	for (const [key, value] of Object.entries(query ?? {})) {
		if (value) url.searchParams.set(key, value)
	}

	return ok(
		await fetch(url, {
			method,
			headers: apiHeaders(),
			...(body !== undefined ? { body: JSON.stringify(body) } : {}),
		}),
	)
}

// ─── Handlers (standalone to avoid TS2589 depth overflow) ───────────

async function handleTaskList(args: {
	status?: string
	assigned_to?: string
	project_id?: string
}) {
	return ok(
		await tasks.$get({
			query: { status: args.status, assigned_to: args.assigned_to, project_id: args.project_id },
		}),
	)
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
	project_id?: string
	queue?: string
	start_after?: string
	depends_on?: string[]
	workflow_id?: string
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

async function handleProjectList() {
	return ok(await projectsApi.$get())
}

async function handleProjectRegister(args: { path: string; name?: string }) {
	return ok(await projectsApi.$post({ json: { path: args.path, name: args.name } }))
}

async function handleProjectUnregister(args: { id: string }) {
	return ok(await projectsApi[':id'].$delete({ param: { id: args.id } }))
}

async function handleConfigGet(args: { type: string; id?: string; project_id?: string }) {
	if (args.id) {
		return configRequest('GET', `${args.type}/${args.id}`, undefined, {
			project_id: args.project_id,
		})
	}
	return configRequest('GET', args.type, undefined, { project_id: args.project_id })
}

async function handleConfigList(args: { type: string; project_id?: string }) {
	return configRequest('GET', args.type, undefined, { project_id: args.project_id })
}

async function handleConfigSet(args: {
	type: string
	id: string
	data: string
	project_id?: string
}) {
	return configRequest('PUT', `${args.type}/${args.id}`, {
		project_id: args.project_id,
		data: JSON.parse(args.data),
	})
}

async function handleConfigDelete(args: { type: string; id: string; project_id?: string }) {
	return configRequest('DELETE', `${args.type}/${args.id}`, undefined, {
		project_id: args.project_id,
	})
}

function knowledgeScopeQuery(args: {
	scope_type?: string
	scope_id?: string
	project_id?: string
	task_id?: string
}) {
	return {
		scope_type: args.scope_type,
		scope_id: args.scope_id,
		project_id: args.project_id,
		task_id: args.task_id,
	}
}

async function handleKnowledgeList(args: {
	path?: string
	scope_type?: string
	scope_id?: string
	project_id?: string
	task_id?: string
}) {
	const url = new URL(`${env.AUTOPILOT_API_URL}/api/knowledge`)
	for (const [key, value] of Object.entries({ path: args.path, ...knowledgeScopeQuery(args) })) {
		if (value) url.searchParams.set(key, value)
	}
	return ok(await fetch(url, { headers: apiHeaders() }))
}

async function handleKnowledgeRead(args: {
	path: string
	scope_type?: string
	scope_id?: string
	project_id?: string
	task_id?: string
}) {
	return knowledgeRequest('GET', args.path, undefined, knowledgeScopeQuery(args))
}

async function handleKnowledgeWrite(args: {
	path: string
	content: string
	title?: string
	mime_type?: string
	scope_type?: string
	scope_id?: string
	project_id?: string
	task_id?: string
}) {
	return knowledgeRequest(
		'PUT',
		args.path,
		{ content: args.content, title: args.title, mime_type: args.mime_type },
		knowledgeScopeQuery(args),
	)
}

async function handleKnowledgeDelete(args: {
	path: string
	scope_type?: string
	scope_id?: string
	project_id?: string
	task_id?: string
}) {
	return knowledgeRequest('DELETE', args.path, undefined, knowledgeScopeQuery(args))
}

async function handleKnowledgeSearch(args: {
	query: string
	scope_type?: string
	scope_id?: string
	project_id?: string
	task_id?: string
}) {
	return knowledgeRequest('GET', 'search', undefined, {
		q: args.query,
		...knowledgeScopeQuery(args),
	})
}

async function handleTaskApprove(args: { id: string }) {
	return ok(await tasks[':id'].approve.$post({ param: { id: args.id } }))
}

async function handleTaskReject(args: { id: string; message: string }) {
	return ok(
		await tasks[':id'].reject.$post({ param: { id: args.id }, json: { message: args.message } }),
	)
}

async function handleTaskReply(args: { id: string; message: string }) {
	return ok(
		await tasks[':id'].reply.$post({ param: { id: args.id }, json: { message: args.message } }),
	)
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

async function handleTaskDepend(args: { task_id: string; depends_on: string[] }) {
	return ok(
		await tasks[':id'].dependencies.$post({
			param: { id: args.task_id },
			json: { depends_on: args.depends_on },
		}),
	)
}

async function handleTaskDependencies(args: { id: string }) {
	return ok(await tasks[':id'].dependencies.$get({ param: { id: args.id } }))
}

async function handleTaskChildren(args: { id: string; relation_type?: string }) {
	return ok(
		await tasks[':id'].children.$get({
			param: { id: args.id },
			query: { relation_type: args.relation_type },
		}),
	)
}

async function handleTaskParents(args: { id: string; relation_type?: string }) {
	return ok(
		await tasks[':id'].parents.$get({
			param: { id: args.id },
			query: { relation_type: args.relation_type },
		}),
	)
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

async function handleSearch(args: { query: string; scope?: string }) {
	return ok(await searchApi.$get({ query: { q: args.query, scope: args.scope } }))
}

const ARTIFACT_EXT: Record<string, string> = {
	html: '.html',
	code: '.txt',
	document: '.md',
	image: '.svg',
}

function slugify(title: string, type: string): string {
	const slug = title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
	return slug + (ARTIFACT_EXT[type] ?? '')
}

async function handleArtifactCreate(args: {
	title: string
	content: string
	type: 'html' | 'code' | 'document' | 'image' | 'file'
	filename?: string
	language?: string
}) {
	const runId = process.env.AUTOPILOT_RUN_ID
	if (!runId)
		throw new Error('AUTOPILOT_RUN_ID not set — artifact_create requires an active run context')

	const ARTIFACT_META: Record<string, { kind: string; mime: string }> = {
		html: { kind: 'preview_file', mime: 'text/html' },
		code: { kind: 'other', mime: 'text/plain' },
		document: { kind: 'other', mime: 'text/markdown' },
		image: { kind: 'other', mime: 'image/svg+xml' },
		file: { kind: 'other', mime: 'application/octet-stream' },
	}

	const meta = ARTIFACT_META[args.type] ?? { kind: 'other', mime: 'application/octet-stream' }
	const filename = args.filename ?? slugify(args.title, args.type)
	const baseUrl = env.AUTOPILOT_API_URL

	const headers: Record<string, string> = { 'Content-Type': 'application/json' }
	if (env.AUTOPILOT_LOCAL_DEV === 'true') {
		headers['X-Local-Dev'] = 'true'
	} else if (env.AUTOPILOT_API_KEY) {
		headers.Authorization = `Bearer ${env.AUTOPILOT_API_KEY}`
	}

	const res = await fetch(`${baseUrl}/api/runs/${runId}/artifacts`, {
		method: 'POST',
		headers,
		body: JSON.stringify({
			kind: meta.kind,
			title: filename,
			ref_kind: 'inline',
			ref_value: args.content,
			mime_type: meta.mime,
			metadata: {
				artifact_type: args.type,
				language: args.language,
				original_title: args.title,
			},
		}),
	})

	if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
	const data = await res.json()
	return {
		content: [
			{
				type: 'text' as const,
				text: JSON.stringify(data, null, 2),
			},
		],
	}
}

// ─── Tool registration ─────────────────────────────────────────────

export function registerTools(server: McpServer): void {
	server.tool(
		'task_list',
		'List tasks with optional filters',
		{
			status: z.string().optional().describe('Filter by status (backlog, in_progress, done, etc.)'),
			assigned_to: z.string().optional().describe('Filter by assigned agent ID'),
			project_id: z.string().optional().describe('Filter by project ID'),
		},
		handleTaskList,
	)

	server.tool(
		'task_get',
		'Get a single task by ID',
		{
			id: z.string().describe('Task ID'),
		},
		handleTaskGet,
	)

	server.tool(
		'task_create',
		'Create a new task',
		{
			title: z.string().describe('Task title'),
			type: z.string().describe('Task type (feature, bug, chore, etc.)'),
			description: z.string().optional().describe('Task description'),
			priority: z.string().optional().describe('Priority (critical, high, medium, low)'),
			assigned_to: z.string().optional().describe('Agent ID to assign'),
			project_id: z.string().optional().describe('Project ID to scope the task to'),
			queue: z.string().optional().describe('Named queue for concurrency control'),
			start_after: z
				.string()
				.optional()
				.describe('ISO datetime — task will not start before this time'),
			depends_on: z.array(z.string()).optional().describe('Task IDs this task depends on'),
			workflow_id: z
				.string()
				.optional()
				.describe(
					'Workflow ID (e.g. "direct" for one-shot, "dogfood" for dev). Falls back to company default if omitted.',
				),
		},
		handleTaskCreate,
	)

	server.tool(
		'task_update',
		'Update a task',
		{
			id: z.string().describe('Task ID'),
			status: z.string().optional().describe('New status'),
			title: z.string().optional().describe('New title'),
			description: z.string().optional().describe('New description'),
			assigned_to: z.string().optional().describe('New assignee'),
		},
		handleTaskUpdate,
	)

	server.tool(
		'run_list',
		'List runs with optional filters',
		{
			task_id: z.string().optional().describe('Filter by task ID'),
			status: z.string().optional().describe('Filter by status'),
		},
		handleRunList,
	)

	server.tool(
		'run_get',
		'Get a single run by ID',
		{
			id: z.string().describe('Run ID'),
		},
		handleRunGet,
	)

	server.tool('project_list', 'List registered projects', {}, handleProjectList)

	server.tool(
		'project_register',
		'Register a git project path with the orchestrator',
		{
			path: z.string().describe('Absolute project path'),
			name: z.string().optional().describe('Optional display name override'),
		},
		handleProjectRegister,
	)

	server.tool(
		'project_unregister',
		'Unregister a project by ID',
		{
			id: z.string().describe('Project ID'),
		},
		handleProjectUnregister,
	)

	server.tool(
		'config_get',
		'Get config records for a type, or one specific record by id',
		{
			type: z
				.string()
				.describe(
					'Config type (company, project, agents, workflows, environments, providers, capabilities, skills, scripts, context)',
				),
			id: z.string().optional().describe('Config record ID. For project scope use the project ID.'),
			project_id: z.string().optional().describe('Optional project scope override ID'),
		},
		handleConfigGet,
	)

	server.tool(
		'config_list',
		'List config records for a type',
		{
			type: z.string().describe('Config type'),
			project_id: z.string().optional().describe('Optional project scope override ID'),
		},
		handleConfigList,
	)

	server.tool(
		'config_set',
		'Create or update a config record',
		{
			type: z.string().describe('Config type'),
			id: z
				.string()
				.describe(
					'Config record ID. For company use "company". For project scope use the project ID.',
				),
			data: z.string().describe('JSON object payload for the config record'),
			project_id: z.string().optional().describe('Optional project scope override ID'),
		},
		handleConfigSet,
	)

	server.tool(
		'config_delete',
		'Delete a config record',
		{
			type: z.string().describe('Config type'),
			id: z.string().describe('Config record ID'),
			project_id: z.string().optional().describe('Optional project scope override ID'),
		},
		handleConfigDelete,
	)

	server.tool(
		'knowledge_list',
		'List knowledge documents visible to a company, project, or task scope',
		{
			path: z.string().optional().describe('Optional virtual path prefix'),
			scope_type: z.enum(['company', 'project', 'task']).optional().describe('Scope type'),
			scope_id: z.string().optional().describe('Scope ID for project/task scope'),
			project_id: z.string().optional().describe('Project ID whose knowledge should be visible'),
			task_id: z.string().optional().describe('Task ID whose knowledge should be visible'),
		},
		handleKnowledgeList,
	)

	server.tool(
		'knowledge_read',
		'Read the most specific visible knowledge document at a virtual path',
		{
			path: z.string().describe('Virtual knowledge path'),
			scope_type: z.enum(['company', 'project', 'task']).optional().describe('Scope type'),
			scope_id: z.string().optional().describe('Scope ID for project/task scope'),
			project_id: z.string().optional().describe('Project ID whose knowledge should be visible'),
			task_id: z.string().optional().describe('Task ID whose knowledge should be visible'),
		},
		handleKnowledgeRead,
	)

	server.tool(
		'knowledge_write',
		'Create or update a knowledge document',
		{
			path: z.string().describe('Virtual knowledge path'),
			content: z.string().describe('Document content'),
			title: z.string().optional().describe('Optional display title'),
			mime_type: z.string().optional().describe('Optional MIME type'),
			scope_type: z.enum(['company', 'project', 'task']).optional().describe('Scope type'),
			scope_id: z.string().optional().describe('Scope ID for project/task scope'),
			project_id: z.string().optional().describe('Project ID to write into'),
			task_id: z.string().optional().describe('Task ID to write into'),
		},
		handleKnowledgeWrite,
	)

	server.tool(
		'knowledge_delete',
		'Delete a knowledge document from a specific scope',
		{
			path: z.string().describe('Virtual knowledge path'),
			scope_type: z.enum(['company', 'project', 'task']).optional().describe('Scope type'),
			scope_id: z.string().optional().describe('Scope ID for project/task scope'),
			project_id: z.string().optional().describe('Project ID to delete from'),
			task_id: z.string().optional().describe('Task ID to delete from'),
		},
		handleKnowledgeDelete,
	)

	server.tool(
		'knowledge_search',
		'Search visible knowledge documents',
		{
			query: z.string().describe('Search query'),
			scope_type: z.enum(['company', 'project', 'task']).optional().describe('Scope type'),
			scope_id: z.string().optional().describe('Scope ID for project/task scope'),
			project_id: z.string().optional().describe('Project ID whose knowledge should be visible'),
			task_id: z.string().optional().describe('Task ID whose knowledge should be visible'),
		},
		handleKnowledgeSearch,
	)

	server.tool(
		'task_approve',
		'Approve a task waiting on a human_approval workflow step',
		{
			id: z.string().describe('Task ID'),
		},
		handleTaskApprove,
	)

	server.tool(
		'task_reject',
		'Reject a task waiting on a human_approval workflow step',
		{
			id: z.string().describe('Task ID'),
			message: z.string().describe('Rejection reason'),
		},
		handleTaskReject,
	)

	server.tool(
		'task_reply',
		'Reply to a task waiting on a human_approval step and advance the workflow. The reply message becomes instructions for the next agent step.',
		{
			id: z.string().describe('Task ID'),
			message: z.string().describe('Reply message (becomes instructions for next run)'),
		},
		handleTaskReply,
	)

	server.tool(
		'task_activity',
		'Get approval/rejection/reply history for a task',
		{
			id: z.string().describe('Task ID'),
		},
		handleTaskActivity,
	)

	server.tool(
		'run_artifacts',
		'List artifacts produced by a run. Artifacts are references (file paths, URLs, or short inline text) — not large blobs.',
		{
			run_id: z.string().describe('Run ID'),
		},
		handleRunArtifacts,
	)

	server.tool(
		'task_spawn_children',
		'Create child tasks for a parent task (idempotent). Use dedupe_key to avoid duplicates on rerun.',
		{
			parent_task_id: z.string().describe('Parent task ID'),
			children: z
				.array(
					z.object({
						title: z.string().describe('Child task title'),
						description: z.string().optional().describe('Child task description'),
						type: z.string().describe('Task type (feature, bug, chore, etc.)'),
						priority: z.string().optional().describe('Priority (critical, high, medium, low)'),
						assigned_to: z.string().optional().describe('Agent ID to assign'),
						workflow_id: z.string().optional().describe('Workflow ID override'),
						context: z.string().optional().describe('Task context JSON'),
						metadata: z.string().optional().describe('Task metadata JSON'),
						dedupe_key: z.string().optional().describe('Unique key for idempotent creation'),
					}),
				)
				.describe('Child task candidates'),
			relation_type: z.string().optional().describe('Relation type (default: decomposes_to)'),
			origin_run_id: z.string().optional().describe('Run ID that triggered this decomposition'),
		},
		handleTaskSpawnChildren,
	)

	server.tool(
		'task_depend',
		'Add dependencies to a task (task will not start until all dependencies are done)',
		{
			task_id: z.string().describe('Task ID that should depend on others'),
			depends_on: z.array(z.string()).describe('Task IDs that must complete first'),
		},
		handleTaskDepend,
	)

	server.tool(
		'task_dependencies',
		'List tasks that a task depends on',
		{
			id: z.string().describe('Task ID'),
		},
		handleTaskDependencies,
	)

	server.tool(
		'task_children',
		'List child tasks of a parent task',
		{
			id: z.string().describe('Parent task ID'),
			relation_type: z
				.string()
				.optional()
				.describe('Relation type filter (default: decomposes_to)'),
		},
		handleTaskChildren,
	)

	server.tool(
		'task_parents',
		'List parent tasks of a child task',
		{
			id: z.string().describe('Child task ID'),
			relation_type: z
				.string()
				.optional()
				.describe('Relation type filter (default: decomposes_to)'),
		},
		handleTaskParents,
	)

	// ─── Schedule tools ───────────────────────────────────────────────

	server.tool('schedule_list', 'List all schedules', {}, handleScheduleList)

	server.tool(
		'schedule_create',
		'Create a new schedule with a cron expression',
		{
			name: z.string().describe('Schedule name'),
			cron: z.string().describe('Cron expression (e.g. "0 9 * * *" for 9 AM daily)'),
			agent_id: z.string().describe('Agent ID to run'),
			workflow_id: z.string().optional().describe('Workflow ID'),
			task_template: z
				.string()
				.optional()
				.describe('JSON string: { title, description, type, priority }'),
			mode: z.enum(['task', 'query']).optional().describe('Execution mode: task or query'),
			query_template: z
				.string()
				.optional()
				.describe('JSON string: { prompt, allow_repo_mutation }'),
			concurrency_policy: z
				.enum(['skip', 'allow', 'queue'])
				.optional()
				.describe('Concurrency policy'),
			timezone: z.string().optional().describe('Timezone (default: UTC)'),
			enabled: z.boolean().optional().describe('Whether the schedule is enabled (default: true)'),
		},
		handleScheduleCreate,
	)

	server.tool(
		'schedule_update',
		'Update a schedule',
		{
			id: z.string().describe('Schedule ID'),
			name: z.string().optional().describe('New name'),
			cron: z.string().optional().describe('New cron expression'),
			agent_id: z.string().optional().describe('New agent ID'),
			workflow_id: z.string().optional().describe('New workflow ID'),
			task_template: z.string().optional().describe('New task template JSON'),
			mode: z.enum(['task', 'query']).optional().describe('Execution mode'),
			query_template: z.string().optional().describe('New query template JSON'),
			concurrency_policy: z
				.enum(['skip', 'allow', 'queue'])
				.optional()
				.describe('Concurrency policy'),
			timezone: z.string().optional().describe('Timezone'),
			enabled: z.boolean().optional().describe('Enable/disable'),
		},
		handleScheduleUpdate,
	)

	server.tool(
		'schedule_delete',
		'Delete a schedule',
		{
			id: z.string().describe('Schedule ID'),
		},
		handleScheduleDelete,
	)

	// ─── Search tool ──────────────────────────────────────────────────

	server.tool(
		'search',
		'Full-text search across tasks, runs, context files, schedules, and knowledge',
		{
			query: z.string().describe('Search query'),
			scope: z
				.enum(['tasks', 'runs', 'context', 'schedules', 'knowledge', 'all'])
				.optional()
				.describe('Scope filter (default: all)'),
		},
		handleSearch,
	)

	server.tool(
		'artifact_create',
		'Create a previewable artifact (HTML page, code snippet, document, image). For HTML artifacts, the content is served and a preview URL is returned. Produce self-contained HTML with all dependencies via CDN.',
		{
			title: z.string().describe('Human-readable title for the artifact'),
			content: z.string().describe('Full content of the artifact'),
			type: z
				.enum(['html', 'code', 'document', 'image', 'file'])
				.describe(
					'Artifact type: html (web page/React app), code (syntax-highlighted snippet), document (markdown/text), image (SVG), file (other)',
				),
			filename: z
				.string()
				.optional()
				.describe('Filename for serving. Defaults to slugified title with appropriate extension'),
			language: z
				.string()
				.optional()
				.describe('For code type: programming language (python, tsx, sql, etc.)'),
		},
		handleArtifactCreate,
	)
}
