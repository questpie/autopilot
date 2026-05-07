/**
 * MCP tool definitions for QUESTPIE Autopilot.
 *
 * Type-safe wrappers around orchestrator endpoints via Hono RPC client.
 * Tasks: GET/POST/PATCH /api/tasks
 * Runs:  GET /api/runs
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { env } from './env'
import {
	SENSITIVE_TOOLS,
	confirmationRequiredResponse,
	isConfirmed,
	isSensitive,
} from './policy'
import { inferIds, recordInvocation } from './telemetry'

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

async function apiRequest(
	method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
	path: string,
	body?: unknown,
	query?: Record<string, string | undefined>,
): Promise<ToolResult> {
	const url = new URL(`${env.AUTOPILOT_API_URL}${path}`)
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

async function apiContentRequest(
	path: string,
	query?: Record<string, string | undefined>,
): Promise<ToolResult> {
	const url = new URL(`${env.AUTOPILOT_API_URL}${path}`)
	for (const [key, value] of Object.entries(query ?? {})) {
		if (value) url.searchParams.set(key, value)
	}

	const res = await fetch(url, { headers: apiHeaders() })
	if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)

	const contentType = res.headers.get('content-type') ?? 'application/octet-stream'
	if (contentType.includes('application/json')) {
		const data = await res.json()
		return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
	}

	const bytes = Buffer.from(await res.arrayBuffer())
	const isText =
		/^text\//.test(contentType) ||
		/(markdown|yaml|json|xml|javascript|typescript|openapi|swagger)/.test(contentType)
	const payload = isText
		? { content_type: contentType, size: bytes.length, text: bytes.toString('utf-8') }
		: { content_type: contentType, size: bytes.length, base64: bytes.toString('base64') }
	return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] }
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
	workflow_id?: string
}) {
	return apiRequest('GET', '/api/tasks', undefined, args)
}

async function handleTaskGet(args: { id: string }) {
	return apiRequest('GET', `/api/tasks/${encodeURIComponent(args.id)}`)
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
	return apiRequest('POST', '/api/tasks', args)
}

async function handleTaskUpdate(args: {
	id: string
	status?: string
	title?: string
	description?: string
	priority?: string
	assigned_to?: string
	project_id?: string
	workflow_id?: string
	workflow_step?: string
	context?: string
	metadata?: string
}) {
	const { id, ...updates } = args
	return apiRequest('PATCH', `/api/tasks/${encodeURIComponent(id)}`, updates)
}

async function handleRunList(args: { task_id?: string; status?: string; agent_id?: string }) {
	return apiRequest('GET', '/api/runs', undefined, args)
}

async function handleRunGet(args: { id: string }) {
	return apiRequest('GET', `/api/runs/${encodeURIComponent(args.id)}`)
}

async function handleProjectList() {
	return apiRequest('GET', '/api/projects')
}

async function handleProjectRegister(args: {
	path: string
	name?: string
	git_remote?: string
	default_branch?: string
}) {
	return apiRequest('POST', '/api/projects', {
		path: args.path,
		name: args.name,
		git_remote: args.git_remote,
		default_branch: args.default_branch,
	})
}

async function handleProjectUnregister(args: { id: string }) {
	return apiRequest('DELETE', `/api/projects/${encodeURIComponent(args.id)}`)
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

async function handleConfigDefaultSkills() {
	return configRequest('GET', 'skills/_defaults')
}

async function handleConfigSeedDefaultSkills() {
	return configRequest('POST', 'skills/_seed-defaults')
}

async function handleConfigReload() {
	const url = new URL(`${env.AUTOPILOT_API_URL}/api/config/reload`)
	return ok(
		await fetch(url, {
			method: 'POST',
			headers: apiHeaders(),
		}),
	)
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
	return apiRequest('POST', `/api/tasks/${encodeURIComponent(args.id)}/approve`)
}

async function handleTaskReject(args: { id: string; message: string }) {
	return apiRequest('POST', `/api/tasks/${encodeURIComponent(args.id)}/reject`, {
		message: args.message,
	})
}

async function handleTaskReply(args: { id: string; message: string }) {
	return apiRequest('POST', `/api/tasks/${encodeURIComponent(args.id)}/reply`, {
		message: args.message,
	})
}

async function handleTaskActivity(args: { id: string }) {
	return apiRequest('GET', `/api/tasks/${encodeURIComponent(args.id)}/activity`)
}

async function handleTaskRetry(args: { id: string }) {
	return apiRequest('POST', `/api/tasks/${encodeURIComponent(args.id)}/retry`)
}

async function handleTaskCancel(args: { id: string; reason?: string }) {
	return apiRequest('POST', `/api/tasks/${encodeURIComponent(args.id)}/cancel`, {
		reason: args.reason,
	})
}

async function handleTaskDelete(args: { id: string; force?: boolean }) {
	return apiRequest('DELETE', `/api/tasks/${encodeURIComponent(args.id)}`, undefined, {
		force: args.force ? 'true' : undefined,
	})
}

async function handleTaskRelations(args: { relation_type?: string }) {
	return apiRequest('GET', '/api/tasks/relations', undefined, {
		relation_type: args.relation_type,
	})
}

async function handleRunArtifacts(args: { run_id: string }) {
	return apiRequest('GET', `/api/runs/${encodeURIComponent(args.run_id)}/artifacts`)
}

async function handleRunEvents(args: { id: string }) {
	return apiRequest('GET', `/api/runs/${encodeURIComponent(args.id)}/events`)
}

async function handleRunArtifactContent(args: { run_id: string; artifact_id: string }) {
	return apiContentRequest(
		`/api/runs/${encodeURIComponent(args.run_id)}/artifacts/${encodeURIComponent(
			args.artifact_id,
		)}/content`,
	)
}

async function handleRunArtifactCreate(args: {
	run_id: string
	title: string
	content: string
	kind?: string
	ref_kind?: 'file' | 'url' | 'inline' | 'base64'
	mime_type?: string
	metadata?: string
}) {
	const metadata = args.metadata ? JSON.parse(args.metadata) : undefined
	return apiRequest('POST', `/api/runs/${encodeURIComponent(args.run_id)}/artifacts`, {
		kind: args.kind ?? 'other',
		title: args.title,
		ref_kind: args.ref_kind ?? 'inline',
		ref_value: args.content,
		mime_type: args.mime_type,
		metadata,
	})
}

async function handleRunCancel(args: { id: string; reason?: string }) {
	return apiRequest('POST', `/api/runs/${encodeURIComponent(args.id)}/cancel`, {
		reason: args.reason,
	})
}

async function handleRunContinue(args: {
	id: string
	message: string
	initiated_by?: string
}) {
	return apiRequest('POST', `/api/runs/${encodeURIComponent(args.id)}/continue`, {
		message: args.message,
		initiated_by: args.initiated_by,
	})
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
	return apiRequest('POST', `/api/tasks/${encodeURIComponent(args.parent_task_id)}/spawn-children`, {
		children: args.children,
		relation_type: args.relation_type,
		origin_run_id: args.origin_run_id,
	})
}

async function handleTaskDepend(args: { task_id: string; depends_on: string[] }) {
	return apiRequest('POST', `/api/tasks/${encodeURIComponent(args.task_id)}/dependencies`, {
		depends_on: args.depends_on,
	})
}

async function handleTaskDependencies(args: { id: string }) {
	return apiRequest('GET', `/api/tasks/${encodeURIComponent(args.id)}/dependencies`)
}

async function handleTaskChildren(args: { id: string; relation_type?: string }) {
	return apiRequest('GET', `/api/tasks/${encodeURIComponent(args.id)}/children`, undefined, {
		relation_type: args.relation_type,
	})
}

async function handleTaskParents(args: { id: string; relation_type?: string }) {
	return apiRequest('GET', `/api/tasks/${encodeURIComponent(args.id)}/parents`, undefined, {
		relation_type: args.relation_type,
	})
}

async function handleTaskDependents(args: { id: string }) {
	return apiRequest('GET', `/api/tasks/${encodeURIComponent(args.id)}/dependents`)
}

async function handleTaskRollup(args: { id: string; relation_type?: string }) {
	return apiRequest('GET', `/api/tasks/${encodeURIComponent(args.id)}/rollup`, undefined, {
		relation_type: args.relation_type,
	})
}

async function handleScheduleList() {
	return apiRequest('GET', '/api/schedules')
}

async function handleScheduleGet(args: { id: string }) {
	return apiRequest('GET', `/api/schedules/${encodeURIComponent(args.id)}`)
}

async function handleScheduleHistory(args: { id: string; limit?: number }) {
	return apiRequest('GET', `/api/schedules/${encodeURIComponent(args.id)}/history`, undefined, {
		limit: args.limit === undefined ? undefined : String(args.limit),
	})
}

async function handleScheduleTrigger(args: { id: string }) {
	return apiRequest('POST', `/api/schedules/${encodeURIComponent(args.id)}/trigger`)
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
	return apiRequest('POST', '/api/schedules', args)
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
	return apiRequest('PATCH', `/api/schedules/${encodeURIComponent(id)}`, updates)
}

async function handleScheduleDelete(args: { id: string }) {
	return apiRequest('DELETE', `/api/schedules/${encodeURIComponent(args.id)}`)
}

async function handleSearch(args: { query: string; scope?: string }) {
	return apiRequest('GET', '/api/search', undefined, { q: args.query, scope: args.scope })
}

async function handleWorkerList() {
	return apiRequest('GET', '/api/workers')
}

async function handleWorkerJoinTokenCreate(args: { description?: string; ttl_seconds?: number }) {
	return apiRequest('POST', '/api/enrollment/tokens', {
		description: args.description,
		ttl_seconds: args.ttl_seconds,
	})
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

const TELEMETRY_SOURCE = 'mcp-server'

const CONFIRMATION_SCHEMA: Record<string, z.ZodTypeAny> = {
	confirm: z
		.boolean()
		.optional()
		.describe('Set to true to acknowledge this sensitive operation and proceed with execution.'),
	confirmation_token: z
		.string()
		.optional()
		.describe('Alternative to `confirm`: a non-empty token issued by the operator UI.'),
}

function withGuard(
	name: string,
	handler: (args: Record<string, unknown>) => Promise<ToolResult>,
): (args: Record<string, unknown>) => Promise<ToolResult> {
	return async (rawArgs) => {
		const args = (rawArgs ?? {}) as Record<string, unknown>
		if (isSensitive(name, args) && !isConfirmed(args)) {
			console.info('[mcp-policy] sensitive tool requires confirmation', { name })
			return confirmationRequiredResponse(name, args)
		}

		const { confirm: _confirm, confirmation_token: _confirmationToken, ...handlerArgs } = args
		void _confirm
		void _confirmationToken

		const ids = inferIds(name, args)
		const startedAt = Date.now()
		try {
			const result = await handler(handlerArgs)
			const durationMs = Date.now() - startedAt
			await recordInvocation(
				{
					name,
					args: handlerArgs,
					startedAt,
					runId: ids.runId,
					taskId: ids.taskId,
					projectId: ids.projectId,
					source: TELEMETRY_SOURCE,
				},
				{ success: true, durationMs },
			)
			return result
		} catch (err) {
			const durationMs = Date.now() - startedAt
			const errorObj = err instanceof Error ? err : new Error(String(err))
			await recordInvocation(
				{
					name,
					args: handlerArgs,
					startedAt,
					runId: ids.runId,
					taskId: ids.taskId,
					projectId: ids.projectId,
					source: TELEMETRY_SOURCE,
				},
				{
					success: false,
					durationMs,
					error: { class: errorObj.name, message: errorObj.message },
				},
			)
			throw err
		}
	}
}

export function registerTools(server: McpServer): void {
	const tool = (
		name: string,
		description: string,
		schema: Record<string, z.ZodTypeAny>,
		handler: (args: never) => Promise<ToolResult>,
	): void => {
		const isSensitiveByName = SENSITIVE_TOOLS.has(name) || name === 'config_set'
		const finalSchema = isSensitiveByName ? { ...schema, ...CONFIRMATION_SCHEMA } : schema
		const guarded = withGuard(name, handler as (args: Record<string, unknown>) => Promise<ToolResult>)
		;(server.tool as unknown as Function)(name, description, finalSchema, guarded)
	}

	tool(
		'task_list',
		'List tasks with optional filters',
		{
			status: z.string().optional().describe('Filter by status (backlog, in_progress, done, etc.)'),
			assigned_to: z.string().optional().describe('Filter by assigned agent ID'),
			project_id: z.string().optional().describe('Filter by project ID'),
			workflow_id: z.string().optional().describe('Filter by workflow ID'),
		},
		handleTaskList,
	)

	tool(
		'task_get',
		'Get a single task by ID',
		{
			id: z.string().describe('Task ID'),
		},
		handleTaskGet,
	)

	tool(
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
						'Workflow ID (e.g. "direct" for one-shot, "bounded-dev" for reviewed work). Falls back to company default if omitted.',
				),
		},
		handleTaskCreate,
	)

	tool(
		'task_update',
		'Update a task',
		{
			id: z.string().describe('Task ID'),
			status: z.string().optional().describe('New status'),
			title: z.string().optional().describe('New title'),
			description: z.string().optional().describe('New description'),
			priority: z.string().optional().describe('New priority'),
			assigned_to: z.string().optional().describe('New assignee'),
			project_id: z.string().optional().describe('New project scope'),
			workflow_id: z.string().optional().describe('New workflow ID'),
			workflow_step: z.string().optional().describe('New workflow step ID'),
			context: z.string().optional().describe('Task context JSON string'),
			metadata: z.string().optional().describe('Task metadata JSON string'),
		},
		handleTaskUpdate,
	)

	tool(
		'task_retry',
		'Retry a failed task through the workflow engine',
		{
			id: z.string().describe('Task ID'),
		},
		handleTaskRetry,
	)

	tool(
		'task_cancel',
		'Cancel an active task and release/settle related workflow state',
		{
			id: z.string().describe('Task ID'),
			reason: z.string().optional().describe('Optional cancellation reason'),
		},
		handleTaskCancel,
	)

	tool(
		'task_delete',
		'Delete a task with cascade. Active runs block deletion unless force is true.',
		{
			id: z.string().describe('Task ID'),
			force: z.boolean().optional().describe('Delete even if active runs exist'),
		},
		handleTaskDelete,
	)

	tool(
		'run_list',
		'List runs with optional filters',
		{
			task_id: z.string().optional().describe('Filter by task ID'),
			status: z.string().optional().describe('Filter by status'),
			agent_id: z.string().optional().describe('Filter by agent ID'),
		},
		handleRunList,
	)

	tool(
		'run_get',
		'Get a single run by ID',
		{
			id: z.string().describe('Run ID'),
		},
		handleRunGet,
	)

	tool(
		'run_events',
		'List progress events for a run',
		{
			id: z.string().describe('Run ID'),
		},
		handleRunEvents,
	)

	tool(
		'run_cancel',
		'Cancel a pending, claimed, or running run and propagate workflow failure handling',
		{
			id: z.string().describe('Run ID'),
			reason: z.string().optional().describe('Optional cancellation reason'),
		},
		handleRunCancel,
	)

	tool(
		'run_continue',
		'Continue a completed or failed resumable run with a follow-up message',
		{
			id: z.string().describe('Original run ID'),
			message: z.string().describe('Continuation message'),
			initiated_by: z.string().optional().describe('Actor ID override'),
		},
		handleRunContinue,
	)

	tool('project_list', 'List registered projects', {}, handleProjectList)

	tool(
		'project_register',
		'Register a git project path with the orchestrator',
		{
			path: z.string().describe('Absolute project path'),
			name: z.string().optional().describe('Optional display name override'),
			git_remote: z.string().optional().describe('Git remote URL for provider compare/PR links'),
			default_branch: z.string().optional().describe('Default branch used for provider diff links'),
		},
		handleProjectRegister,
	)

	tool(
		'project_unregister',
		'Unregister a project by ID',
		{
			id: z.string().describe('Project ID'),
		},
		handleProjectUnregister,
	)

	tool(
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

	tool(
		'config_list',
		'List config records for a type',
		{
			type: z.string().describe('Config type'),
			project_id: z.string().optional().describe('Optional project scope override ID'),
		},
		handleConfigList,
	)

	tool(
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

	tool(
		'config_delete',
		'Delete a config record',
		{
			type: z.string().describe('Config type'),
			id: z.string().describe('Config record ID'),
			project_id: z.string().optional().describe('Optional project scope override ID'),
		},
		handleConfigDelete,
	)

	tool(
		'config_default_skills',
		'List the default built-in/plugin-backed skill catalog',
		{},
		handleConfigDefaultSkills,
	)

	tool(
		'config_seed_default_skills',
		'Idempotently seed missing default skills into DB config. Requires owner/admin.',
		{},
		handleConfigSeedDefaultSkills,
	)

	tool(
		'config_reload',
		'Reload DB-backed config into the live orchestrator runtime after config_set or config_delete',
		{},
		handleConfigReload,
	)

	tool(
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

	tool(
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

	tool(
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

	tool(
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

	tool(
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

	tool(
		'task_approve',
		'Approve a task waiting on a human_approval workflow step',
		{
			id: z.string().describe('Task ID'),
		},
		handleTaskApprove,
	)

	tool(
		'task_reject',
		'Reject a task waiting on a human_approval workflow step',
		{
			id: z.string().describe('Task ID'),
			message: z.string().describe('Rejection reason'),
		},
		handleTaskReject,
	)

	tool(
		'task_reply',
		'Reply to a task waiting on a human_approval step and advance the workflow. The reply message becomes instructions for the next agent step.',
		{
			id: z.string().describe('Task ID'),
			message: z.string().describe('Reply message (becomes instructions for next run)'),
		},
		handleTaskReply,
	)

	tool(
		'task_activity',
		'Get approval/rejection/reply history for a task',
		{
			id: z.string().describe('Task ID'),
		},
		handleTaskActivity,
	)

	tool(
		'run_artifacts',
		'List artifacts produced by a run. Artifacts are references (file paths, URLs, or short inline text) — not large blobs.',
		{
			run_id: z.string().describe('Run ID'),
		},
		handleRunArtifacts,
	)

	tool(
		'run_artifact_content',
		'Read resolved artifact content. Text content is returned as text; binary content is returned as base64.',
		{
			run_id: z.string().describe('Run ID'),
			artifact_id: z.string().describe('Artifact ID'),
		},
		handleRunArtifactContent,
	)

	tool(
		'run_artifact_create',
		'Create an artifact on a specific active run. Use when AUTOPILOT_RUN_ID is unavailable or when operating on another run explicitly.',
		{
			run_id: z.string().describe('Run ID'),
			title: z.string().describe('Artifact title or filename'),
			content: z.string().describe('Artifact content, URL, file path, or base64 depending on ref_kind'),
			kind: z.string().optional().describe('Artifact kind, defaults to other'),
			ref_kind: z
				.enum(['file', 'url', 'inline', 'base64'])
				.optional()
				.describe('Reference kind, defaults to inline'),
			mime_type: z.string().optional().describe('Optional MIME type'),
			metadata: z.string().optional().describe('Optional metadata JSON object'),
		},
		handleRunArtifactCreate,
	)

	tool(
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

	tool(
		'task_depend',
		'Add dependencies to a task (task will not start until all dependencies are done)',
		{
			task_id: z.string().describe('Task ID that should depend on others'),
			depends_on: z.array(z.string()).describe('Task IDs that must complete first'),
		},
		handleTaskDepend,
	)

	tool(
		'task_dependencies',
		'List tasks that a task depends on',
		{
			id: z.string().describe('Task ID'),
		},
		handleTaskDependencies,
	)

	tool(
		'task_dependents',
		'List tasks that depend on this task',
		{
			id: z.string().describe('Task ID'),
		},
		handleTaskDependents,
	)

	tool(
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

	tool(
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

	tool(
		'task_relations',
		'Bulk list task graph relations, optionally filtered by relation type',
		{
			relation_type: z.string().optional().describe('Relation type filter'),
		},
		handleTaskRelations,
	)

	tool(
		'task_rollup',
		'Get derived child status rollup for a task',
		{
			id: z.string().describe('Task ID'),
			relation_type: z.string().optional().describe('Relation type filter'),
		},
		handleTaskRollup,
	)

	// ─── Schedule tools ───────────────────────────────────────────────

	tool('schedule_list', 'List all schedules', {}, handleScheduleList)

	tool(
		'schedule_get',
		'Get one schedule by ID',
		{
			id: z.string().describe('Schedule ID'),
		},
		handleScheduleGet,
	)

	tool(
		'schedule_history',
		'List recent executions for a schedule',
		{
			id: z.string().describe('Schedule ID'),
			limit: z.number().optional().describe('Maximum execution rows to return'),
		},
		handleScheduleHistory,
	)

	tool(
		'schedule_trigger',
		'Manually trigger a schedule now',
		{
			id: z.string().describe('Schedule ID'),
		},
		handleScheduleTrigger,
	)

	tool(
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

	tool(
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

	tool(
		'schedule_delete',
		'Delete a schedule',
		{
			id: z.string().describe('Schedule ID'),
		},
		handleScheduleDelete,
	)

	// ─── Search tool ──────────────────────────────────────────────────

	tool(
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

	// ─── Worker / machine setup tools ─────────────────────────────────

	tool('worker_list', 'List registered workers/machines', {}, handleWorkerList)

	tool(
		'worker_join_token_create',
		'Create a worker join token for setting up a new machine. Requires owner/admin.',
		{
			description: z.string().optional().describe('Human-readable token description'),
			ttl_seconds: z.number().optional().describe('Token TTL in seconds'),
		},
		handleWorkerJoinTokenCreate,
	)

	tool(
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
