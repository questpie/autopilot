/**
 * MCP server tests — all functional, no source-reading.
 */
import { describe, expect, test } from 'bun:test'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerTools } from '../src/tools'

type CapturedTool = {
	description: string
	schema: unknown
	handler: (args: Record<string, unknown>) => Promise<unknown>
}

function collectTools(): Map<string, CapturedTool> {
	const tools = new Map<string, CapturedTool>()
	const server = {
		tool(
			name: string,
			description: string,
			schema: unknown,
			handler: (args: Record<string, unknown>) => Promise<unknown>,
		) {
			tools.set(name, { description, schema, handler })
		},
	}
	registerTools(server as unknown as McpServer)
	return tools
}

// ─── MCP server scaffold ────────────────────────────────────────────────────

describe('MCP server scaffold', () => {
	test('McpServer can be instantiated', () => {
		expect(new McpServer({ name: 'test', version: '1.0.0' })).toBeDefined()
	})

	test('registerTools does not throw', () => {
		const server = new McpServer({ name: 'test', version: '1.0.0' })
		expect(() => registerTools(server)).not.toThrow()
	})

	test('registers the full operator control catalog', () => {
		const tools = collectTools()
		const expected = [
			'artifact_create',
			'config_default_skills',
			'config_delete',
			'config_get',
			'config_list',
			'config_reload',
			'config_seed_default_skills',
			'config_set',
			'knowledge_delete',
			'knowledge_list',
			'knowledge_read',
			'knowledge_search',
			'knowledge_write',
			'project_list',
			'project_register',
			'project_unregister',
			'run_artifact_content',
			'run_artifact_create',
			'run_artifacts',
			'run_cancel',
			'run_continue',
			'run_events',
			'run_get',
			'run_list',
			'schedule_create',
			'schedule_delete',
			'schedule_get',
			'schedule_history',
			'schedule_list',
			'schedule_trigger',
			'schedule_update',
			'search',
			'task_activity',
			'task_approve',
			'task_cancel',
			'task_children',
			'task_create',
			'task_delete',
			'task_depend',
			'task_dependencies',
			'task_dependents',
			'task_get',
			'task_list',
			'task_parents',
			'task_reject',
			'task_relations',
			'task_reply',
			'task_retry',
			'task_rollup',
			'task_spawn_children',
			'task_update',
			'worker_join_token_create',
			'worker_list',
		]

		expect([...tools.keys()].sort()).toEqual(expected)
	})
})

// ─── Tool HTTP mapping ──────────────────────────────────────────────────────

interface FetchCall {
	url: string
	method: string
	body: unknown
	headers: Record<string, string>
}

function normalizeHeaders(headers: HeadersInit | undefined): Record<string, string> {
	if (!headers) return {}
	if (headers instanceof Headers) return Object.fromEntries(headers.entries())
	if (Array.isArray(headers)) return Object.fromEntries(headers)
	return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key, String(value)]))
}

async function bodyFrom(input: RequestInfo | URL, init?: RequestInit): Promise<unknown> {
	const raw =
		init?.body ??
		(input instanceof Request ? await input.clone().text().catch(() => undefined) : undefined)
	if (typeof raw !== 'string' || !raw) return undefined
	try {
		return JSON.parse(raw)
	} catch {
		return raw
	}
}

function installFetchRecorder(
	responseFor?: (call: FetchCall) => Response | Promise<Response>,
): FetchCall[] {
	const calls: FetchCall[] = []
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = input instanceof Request ? input.url : String(input)
		const method = init?.method ?? (input instanceof Request ? input.method : 'GET')
		const headers = normalizeHeaders(init?.headers ?? (input instanceof Request ? input.headers : undefined))
		const call = { url, method, headers, body: await bodyFrom(input, init) }
		calls.push(call)
		return (
			(await responseFor?.(call)) ??
			Response.json({ ok: true, path: new URL(url).pathname, method, body: call.body })
		)
	}) as typeof fetch
	return calls
}

async function invokeTool(name: string, args: Record<string, unknown>) {
	const tool = collectTools().get(name)
	if (!tool) throw new Error(`missing tool ${name}`)
	return tool.handler(args)
}

/** Telemetry calls are emitted by the wrapper out-of-band. Filter them out so
 *  tests that assert tool→API endpoint mapping stay focused. */
function filterTelemetry(calls: FetchCall[]): FetchCall[] {
	return calls.filter((call) => {
		const path = new URL(call.url).pathname
		if (path === '/api/mcp/telemetry') return false
		if (/^\/api\/runs\/[^/]+\/events$/.test(path) && call.method === 'POST') return false
		return true
	})
}

describe('MCP tool HTTP mapping', () => {
	test('task control tools call retry/cancel/delete endpoints', async () => {
		const recorded = installFetchRecorder()

		await invokeTool('task_retry', { id: 'task-1' })
		await invokeTool('task_cancel', { id: 'task-1', reason: 'operator stopped it', confirm: true })
		await invokeTool('task_delete', { id: 'task-1', force: true, confirm: true })

		const calls = filterTelemetry(recorded)
		expect(calls.map((call) => [new URL(call.url).pathname, call.method])).toEqual([
			['/api/tasks/task-1/retry', 'POST'],
			['/api/tasks/task-1/cancel', 'POST'],
			['/api/tasks/task-1', 'DELETE'],
		])
		expect(calls[1]?.body).toEqual({ reason: 'operator stopped it' })
		expect(new URL(calls[2]!.url).searchParams.get('force')).toBe('true')
	})

	test('run tools expose events, explicit artifacts, cancel, and continuation', async () => {
		const recorded = installFetchRecorder()

		await invokeTool('run_events', { id: 'run-1' })
		await invokeTool('run_artifact_create', {
			run_id: 'run-1',
			title: 'note.md',
			content: '# Note',
			mime_type: 'text/markdown',
			metadata: '{"source":"test"}',
		})
		await invokeTool('run_cancel', { id: 'run-1', reason: 'bad output', confirm: true })
		await invokeTool('run_continue', {
			id: 'run-1',
			message: 'Try again with shorter output',
			initiated_by: 'u1',
		})

		const calls = filterTelemetry(recorded)
		expect(calls.map((call) => [new URL(call.url).pathname, call.method])).toEqual([
			['/api/runs/run-1/events', 'GET'],
			['/api/runs/run-1/artifacts', 'POST'],
			['/api/runs/run-1/cancel', 'POST'],
			['/api/runs/run-1/continue', 'POST'],
		])
		expect(calls[1]?.body).toEqual({
			kind: 'other',
			title: 'note.md',
			ref_kind: 'inline',
			ref_value: '# Note',
			mime_type: 'text/markdown',
			metadata: { source: 'test' },
		})
	})

	test('run_artifact_content returns text envelope for non-json content', async () => {
		installFetchRecorder(
			() =>
				new Response('hello artifact', {
					headers: { 'Content-Type': 'text/plain' },
				}),
		)

		const result = (await invokeTool('run_artifact_content', {
			run_id: 'run-1',
			artifact_id: 'art-1',
		})) as { content: Array<{ text: string }> }
		const payload = JSON.parse(result.content[0]!.text)

		expect(payload).toEqual({
			content_type: 'text/plain',
			size: 14,
			text: 'hello artifact',
		})
	})

	test('config skill tools hit default catalog endpoints', async () => {
		const recorded = installFetchRecorder()

		await invokeTool('config_default_skills', {})
		await invokeTool('config_seed_default_skills', { confirm: true })

		const calls = filterTelemetry(recorded)
		expect(calls.map((call) => [new URL(call.url).pathname, call.method])).toEqual([
			['/api/config/skills/_defaults', 'GET'],
			['/api/config/skills/_seed-defaults', 'POST'],
		])
	})

	test('schedule and worker setup tools map to operational endpoints', async () => {
		const recorded = installFetchRecorder()

		await invokeTool('schedule_get', { id: 'sched-1' })
		await invokeTool('schedule_history', { id: 'sched-1', limit: 5 })
		await invokeTool('schedule_trigger', { id: 'sched-1', confirm: true })
		await invokeTool('worker_list', {})
		await invokeTool('worker_join_token_create', {
			description: 'mac mini',
			ttl_seconds: 3600,
			confirm: true,
		})

		const calls = filterTelemetry(recorded)
		expect(calls.map((call) => [new URL(call.url).pathname, call.method])).toEqual([
			['/api/schedules/sched-1', 'GET'],
			['/api/schedules/sched-1/history', 'GET'],
			['/api/schedules/sched-1/trigger', 'POST'],
			['/api/workers', 'GET'],
			['/api/enrollment/tokens', 'POST'],
		])
		expect(new URL(calls[1]!.url).searchParams.get('limit')).toBe('5')
		expect(calls[4]?.body).toEqual({ description: 'mac mini', ttl_seconds: 3600 })
	})
})

// ─── Sensitive tool confirmation policy ─────────────────────────────────────

describe('sensitive tool confirmation policy', () => {
	test('task_delete without confirm returns confirmation_required and makes no fetch', async () => {
		const calls = installFetchRecorder()
		const result = (await invokeTool('task_delete', { id: 'task-1' })) as {
			content: Array<{ text: string }>
		}
		const payload = JSON.parse(result.content[0]!.text)
		expect(payload.confirmation_required).toBe(true)
		expect(payload.tool).toBe('task_delete')
		expect(typeof payload.reason).toBe('string')
		expect(payload.sensitive_args).toEqual({ id: 'task-1' })
		expect(calls).toEqual([])
	})

	test('task_delete with confirm: true does make the fetch', async () => {
		const recorded = installFetchRecorder()
		await invokeTool('task_delete', { id: 'task-1', confirm: true })
		const calls = filterTelemetry(recorded)
		expect(calls.length).toBe(1)
		expect(new URL(calls[0]!.url).pathname).toBe('/api/tasks/task-1')
		expect(calls[0]!.method).toBe('DELETE')
	})

	test('confirmation_token also satisfies the policy', async () => {
		const recorded = installFetchRecorder()
		await invokeTool('task_delete', { id: 'task-1', confirmation_token: 'op-issued-xyz' })
		const calls = filterTelemetry(recorded)
		expect(calls.length).toBe(1)
		expect(new URL(calls[0]!.url).pathname).toBe('/api/tasks/task-1')
	})

	test('config_set with sensitive type requires confirmation', async () => {
		const calls = installFetchRecorder()
		const result = (await invokeTool('config_set', {
			type: 'workflows',
			id: 'wf-1',
			data: '{"name":"x"}',
		})) as { content: Array<{ text: string }> }
		const payload = JSON.parse(result.content[0]!.text)
		expect(payload.confirmation_required).toBe(true)
		expect(payload.tool).toBe('config_set')
		expect(calls).toEqual([])
	})

	test('config_set with non-sensitive type runs without confirmation', async () => {
		const recorded = installFetchRecorder()
		await invokeTool('config_set', {
			type: 'context',
			id: 'ctx-1',
			data: '{"x":1}',
		})
		const calls = filterTelemetry(recorded)
		expect(calls.length).toBe(1)
		expect(new URL(calls[0]!.url).pathname).toBe('/api/config/context/ctx-1')
		expect(calls[0]!.method).toBe('PUT')
	})

	test('confirm and confirmation_token are stripped before reaching handler', async () => {
		const recorded = installFetchRecorder()
		await invokeTool('task_delete', { id: 'task-1', confirm: true, confirmation_token: 'tok' })
		const calls = filterTelemetry(recorded)
		const url = new URL(calls[0]!.url)
		expect(url.searchParams.get('confirm')).toBeNull()
		expect(url.searchParams.get('confirmation_token')).toBeNull()
	})
})

// ─── Telemetry emission ─────────────────────────────────────────────────────

describe('MCP wrapper telemetry', () => {
	test('posts a tool_use event to /api/runs/<id>/events when AUTOPILOT_RUN_ID is set', async () => {
		const original = process.env.AUTOPILOT_RUN_ID
		process.env.AUTOPILOT_RUN_ID = 'env-run-99'
		try {
			const calls = installFetchRecorder()
			await invokeTool('config_default_skills', {})
			const eventPosts = calls.filter(
				(call) =>
					/^\/api\/runs\/[^/]+\/events$/.test(new URL(call.url).pathname) &&
					call.method === 'POST',
			)
			expect(eventPosts.length).toBe(1)
			const post = eventPosts[0]!
			expect(new URL(post.url).pathname).toBe('/api/runs/env-run-99/events')
			const body = post.body as {
				type: string
				summary: string
				metadata: { tool: string; success: boolean }
			}
			expect(body.type).toBe('tool_use')
			expect(body.metadata.tool).toBe('config_default_skills')
			expect(body.metadata.success).toBe(true)
			expect(body.summary).toContain('mcp config_default_skills ok')
		} finally {
			if (original === undefined) delete process.env.AUTOPILOT_RUN_ID
			else process.env.AUTOPILOT_RUN_ID = original
		}
	})
})

// ─── API client auth headers ────────────────────────────────────────────────

/**
 * Spawns a subprocess that imports the Hono RPC api-client, intercepts fetch
 * to capture the headers the client sends, and prints them as JSON.
 * Env vars must be set on the subprocess (module-level instantiation).
 */
function spawnHeaderCapture(envOverrides: Record<string, string>) {
	return Bun.spawnSync(
		[
			'bun',
			'-e',
			`
import { tasks } from './src/api-client.ts';
let capturedHeaders = {};
globalThis.fetch = async (url, opts) => {
  const h = opts?.headers;
  if (h instanceof Headers) {
    capturedHeaders = Object.fromEntries(h.entries());
  } else if (h && typeof h === 'object') {
    capturedHeaders = Object.fromEntries(
      Object.entries(h).map(([k, v]) => [k.toLowerCase(), v])
    );
  }
  return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
};
await tasks.$get({ query: {} });
console.log(JSON.stringify(capturedHeaders));
`,
		],
		{
			cwd: import.meta.dir + '/..',
			env: {
				...process.env,
				AUTOPILOT_API_URL: 'http://localhost:7778',
				...envOverrides,
			},
			stdout: 'pipe',
			stderr: 'pipe',
		},
	)
}

describe('API client auth headers', () => {
	test('auth header includes Bearer token when AUTOPILOT_API_KEY is set', async () => {
		const child = spawnHeaderCapture({
			AUTOPILOT_API_KEY: 'test-machine-secret',
			AUTOPILOT_LOCAL_DEV: '',
		})

		if (child.exitCode !== 0) {
			console.error('stderr:', child.stderr.toString())
		}
		expect(child.exitCode).toBe(0)
		const headers = JSON.parse(child.stdout.toString().trim())
		expect(headers.authorization).toBe('Bearer test-machine-secret')
	})

	test('local-dev mode sends X-Local-Dev header instead of Bearer', async () => {
		const child = spawnHeaderCapture({
			AUTOPILOT_LOCAL_DEV: 'true',
			AUTOPILOT_API_KEY: 'should-be-ignored',
		})

		if (child.exitCode !== 0) {
			console.error('stderr:', child.stderr.toString())
		}
		expect(child.exitCode).toBe(0)
		const headers = JSON.parse(child.stdout.toString().trim())
		expect(headers['x-local-dev']).toBe('true')
		expect(headers.authorization).toBeUndefined()
	})

	test('no auth headers when neither API key nor local-dev is set', async () => {
		const child = spawnHeaderCapture({
			AUTOPILOT_API_KEY: '',
			AUTOPILOT_LOCAL_DEV: '',
		})

		if (child.exitCode !== 0) {
			console.error('stderr:', child.stderr.toString())
		}
		expect(child.exitCode).toBe(0)
		const headers = JSON.parse(child.stdout.toString().trim())
		expect(headers.authorization).toBeUndefined()
		expect(headers['x-local-dev']).toBeUndefined()
	})
})
