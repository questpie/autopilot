/**
 * MCP E2E smoke tests — drive the full registered tool catalog through a
 * minimal in-test Hono app that mimics the orchestrator surface.
 *
 * This is an MCP-side smoke test, not a full orchestrator integration test.
 * The in-test app registers just the routes the MCP tools touch and records
 * every request that lands. `globalThis.fetch` is rerouted to `app.request`
 * so the MCP `tools.ts` handlers transparently hit the in-test app without
 * needing a real HTTP listener.
 *
 * Coverage targets:
 *  - HTTP method + path mapping for representative tools across config,
 *    tasks, runs, knowledge, schedules, workers.
 *  - Telemetry side-effect: when AUTOPILOT_RUN_ID is set, every successful
 *    invocation produces an extra POST /api/runs/:id/events.
 *  - Redaction: secret-shaped argument values are masked before they reach
 *    telemetry payloads.
 *  - Confirmation policy: sensitive tools without `confirm: true` return a
 *    `confirmation_required` envelope and produce zero HTTP traffic.
 *  - Auth header: Bearer when AUTOPILOT_API_KEY is set, X-Local-Dev when
 *    AUTOPILOT_LOCAL_DEV=true. Tested via subprocess because the MCP env
 *    is parsed once at module load.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Hono } from 'hono'
import { registerTools } from '../src/tools'

// ─── Tool capture ─────────────────────────────────────────────────────────

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

async function invokeTool(name: string, args: Record<string, unknown>) {
	const tool = collectTools().get(name)
	if (!tool) throw new Error(`missing tool ${name}`)
	return tool.handler(args)
}

// ─── In-test Hono app ─────────────────────────────────────────────────────

interface RecordedRequest {
	method: string
	path: string
	url: string
	body: unknown
	headers: Record<string, string>
	query: Record<string, string>
}

/**
 * Minimal Hono app that mimics the orchestrator endpoints touched by the
 * MCP tools. Each handler echoes a small canned payload so the MCP client
 * can JSON.parse the response without choking, and records the request
 * onto the shared `recorded` array for the test to assert against.
 */
function buildInTestApp(recorded: RecordedRequest[]): Hono {
	const app = new Hono()

	app.use('*', async (c, next) => {
		const url = new URL(c.req.url)
		const headerEntries: Array<[string, string]> = []
		c.req.raw.headers.forEach((value, key) => {
			headerEntries.push([key.toLowerCase(), value])
		})
		let body: unknown
		if (c.req.method !== 'GET' && c.req.method !== 'DELETE') {
			const text = await c.req.raw
				.clone()
				.text()
				.catch(() => '')
			if (text) {
				try {
					body = JSON.parse(text)
				} catch {
					body = text
				}
			}
		}
		const queryEntries: Array<[string, string]> = []
		url.searchParams.forEach((value, key) => {
			queryEntries.push([key, value])
		})
		recorded.push({
			method: c.req.method,
			path: url.pathname,
			url: c.req.url,
			body,
			headers: Object.fromEntries(headerEntries),
			query: Object.fromEntries(queryEntries),
		})
		await next()
	})

	// Config
	app.get('/api/config/skills/_defaults', (c) =>
		c.json([{ id: 'skill-default', name: 'Default Skill' }]),
	)
	app.post('/api/config/skills/_seed-defaults', (c) =>
		c.json({ ok: true, seeded: ['skill-default'] }),
	)
	app.put('/api/config/:type/:id', (c) =>
		c.json({ ok: true, type: c.req.param('type'), id: c.req.param('id') }),
	)
	app.delete('/api/config/:type/:id', (c) =>
		c.json({ ok: true, deleted: c.req.param('id') }),
	)
	app.post('/api/config/reload', (c) => c.json({ ok: true, reloaded: true }))

	// Tasks
	app.post('/api/tasks', (c) => c.json({ id: 'task-new', status: 'pending' }, 201))
	app.patch('/api/tasks/:id', (c) =>
		c.json({ id: c.req.param('id'), status: 'updated' }),
	)
	app.post('/api/tasks/:id/retry', (c) => c.json({ id: c.req.param('id'), retried: true }))
	app.post('/api/tasks/:id/cancel', (c) => c.json({ id: c.req.param('id'), cancelled: true }))
	app.delete('/api/tasks/:id', (c) => c.json({ id: c.req.param('id'), deleted: true }))

	// Runs
	app.get('/api/runs/:id/events', (c) =>
		c.json([{ id: 1, type: 'started', summary: 'started' }]),
	)
	app.post('/api/runs/:id/events', (c) => c.json({ ok: true }))
	app.post('/api/runs/:id/artifacts', (c) =>
		c.json({ id: 'art-new', preview_url: null }, 201),
	)
	app.get('/api/runs/:id/artifacts/:artId/content', (c) =>
		c.text('artifact body', 200, { 'Content-Type': 'text/plain' }),
	)

	// Knowledge
	app.put('/api/knowledge/*', (c) => c.json({ id: 'k-new', path: 'doc' }))
	app.get('/api/knowledge/*', (c) => {
		const url = new URL(c.req.url)
		if (url.pathname.endsWith('/search')) {
			return c.json({ results: [{ path: 'doc', score: 1 }] })
		}
		return c.json({ id: 'k-1', path: 'doc', content: 'hello' })
	})
	app.delete('/api/knowledge/*', (c) => c.json({ deleted: true }))

	// Schedules
	app.post('/api/schedules', (c) =>
		c.json({ id: 'sched-new', name: 'Daily', enabled: true }, 201),
	)
	app.get('/api/schedules/:id', (c) =>
		c.json({ id: c.req.param('id'), name: 'Daily', cron: '0 9 * * *' }),
	)
	app.get('/api/schedules/:id/history', (c) => c.json([]))
	app.post('/api/schedules/:id/trigger', (c) =>
		c.json({ ok: true, schedule_id: c.req.param('id') }),
	)
	app.delete('/api/schedules/:id', (c) =>
		c.json({ id: c.req.param('id'), deleted: true }),
	)

	// Workers / enrollment
	app.post('/api/enrollment/tokens', (c) =>
		c.json({ token: 'join-tok-redacted', ttl_seconds: 3600 }, 201),
	)

	// MCP telemetry sink
	app.post('/api/mcp/telemetry', (c) => c.json({ ok: true }))

	return app
}

// ─── Fetch routing ────────────────────────────────────────────────────────

const originalFetch = globalThis.fetch
let recorded: RecordedRequest[] = []
let testApp: Hono | undefined

beforeEach(() => {
	recorded = []
	testApp = buildInTestApp(recorded)
	// Route every fetch through the in-test Hono app. The MCP server builds
	// absolute URLs against env.AUTOPILOT_API_URL — Hono.request accepts the
	// full URL string and routes by pathname.
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = input instanceof Request ? input.url : String(input)
		if (!testApp) throw new Error('test app not initialised')
		return testApp.request(url, init ?? (input instanceof Request ? input : undefined))
	}) as typeof fetch
})

afterEach(() => {
	globalThis.fetch = originalFetch
})

// ─── Helpers ──────────────────────────────────────────────────────────────

function nonTelemetry(reqs: RecordedRequest[]): RecordedRequest[] {
	return reqs.filter((r) => {
		if (r.path === '/api/mcp/telemetry') return false
		if (/^\/api\/runs\/[^/]+\/events$/.test(r.path) && r.method === 'POST') return false
		return true
	})
}

function telemetryEvents(reqs: RecordedRequest[]): RecordedRequest[] {
	return reqs.filter(
		(r) => /^\/api\/runs\/[^/]+\/events$/.test(r.path) && r.method === 'POST',
	)
}

function telemetrySink(reqs: RecordedRequest[]): RecordedRequest[] {
	return reqs.filter((r) => r.path === '/api/mcp/telemetry')
}

// ─── HTTP wiring (representative coverage) ────────────────────────────────

describe('MCP E2E — config tools', () => {
	test('config_default_skills hits GET /api/config/skills/_defaults', async () => {
		await invokeTool('config_default_skills', {})
		const calls = nonTelemetry(recorded)
		expect(calls).toHaveLength(1)
		expect(calls[0]!.method).toBe('GET')
		expect(calls[0]!.path).toBe('/api/config/skills/_defaults')
	})

	test('config_set with sensitive type requires confirmation; with confirm hits PUT', async () => {
		// Without confirm → no HTTP
		const blockedResult = (await invokeTool('config_set', {
			type: 'workflows',
			id: 'wf-1',
			data: '{"name":"x"}',
		})) as { content: Array<{ text: string }> }
		const blockedPayload = JSON.parse(blockedResult.content[0]!.text)
		expect(blockedPayload.confirmation_required).toBe(true)
		expect(recorded).toEqual([])

		// With confirm → PUT lands
		await invokeTool('config_set', {
			type: 'workflows',
			id: 'wf-1',
			data: '{"name":"x"}',
			confirm: true,
		})
		const calls = nonTelemetry(recorded)
		expect(calls).toHaveLength(1)
		expect(calls[0]!.method).toBe('PUT')
		expect(calls[0]!.path).toBe('/api/config/workflows/wf-1')
		expect(calls[0]!.body).toEqual({ project_id: undefined, data: { name: 'x' } })
	})

	test('config_reload posts to /api/config/reload', async () => {
		await invokeTool('config_reload', {})
		const calls = nonTelemetry(recorded)
		expect(calls).toHaveLength(1)
		expect(calls[0]!.method).toBe('POST')
		expect(calls[0]!.path).toBe('/api/config/reload')
	})
})

describe('MCP E2E — task tools', () => {
	test('task_create posts the expected body shape', async () => {
		await invokeTool('task_create', {
			title: 'Investigate bug',
			type: 'bug',
			description: 'See logs',
			priority: 'high',
		})
		const calls = nonTelemetry(recorded)
		expect(calls).toHaveLength(1)
		expect(calls[0]!.method).toBe('POST')
		expect(calls[0]!.path).toBe('/api/tasks')
		expect(calls[0]!.body).toEqual({
			title: 'Investigate bug',
			type: 'bug',
			description: 'See logs',
			priority: 'high',
		})
	})

	test('task_update PATCH the right id with body without id', async () => {
		await invokeTool('task_update', {
			id: 'task-77',
			status: 'in_progress',
			metadata: '{"note":"hi"}',
		})
		const calls = nonTelemetry(recorded)
		expect(calls).toHaveLength(1)
		expect(calls[0]!.method).toBe('PATCH')
		expect(calls[0]!.path).toBe('/api/tasks/task-77')
		expect(calls[0]!.body).toEqual({
			status: 'in_progress',
			metadata: '{"note":"hi"}',
		})
	})

	test('task_retry posts to /api/tasks/:id/retry', async () => {
		await invokeTool('task_retry', { id: 'task-1' })
		const calls = nonTelemetry(recorded)
		expect(calls).toHaveLength(1)
		expect(calls[0]!.method).toBe('POST')
		expect(calls[0]!.path).toBe('/api/tasks/task-1/retry')
	})

	test('task_cancel requires confirm; with confirm posts cancel', async () => {
		const blocked = (await invokeTool('task_cancel', {
			id: 'task-1',
			reason: 'wrong direction',
		})) as { content: Array<{ text: string }> }
		expect(JSON.parse(blocked.content[0]!.text).confirmation_required).toBe(true)
		expect(recorded).toEqual([])

		await invokeTool('task_cancel', { id: 'task-1', reason: 'wrong direction', confirm: true })
		const calls = nonTelemetry(recorded)
		expect(calls).toHaveLength(1)
		expect(calls[0]!.method).toBe('POST')
		expect(calls[0]!.path).toBe('/api/tasks/task-1/cancel')
		expect(calls[0]!.body).toEqual({ reason: 'wrong direction' })
	})
})

describe('MCP E2E — run tools', () => {
	test('run_events GETs /api/runs/:id/events', async () => {
		await invokeTool('run_events', { id: 'run-7' })
		const calls = nonTelemetry(recorded)
		expect(calls).toHaveLength(1)
		expect(calls[0]!.method).toBe('GET')
		expect(calls[0]!.path).toBe('/api/runs/run-7/events')
	})

	test('run_artifact_create posts inline artifact body to the right run', async () => {
		await invokeTool('run_artifact_create', {
			run_id: 'run-7',
			title: 'note.md',
			content: '# hello',
			mime_type: 'text/markdown',
			metadata: '{"k":"v"}',
		})
		const calls = nonTelemetry(recorded)
		expect(calls).toHaveLength(1)
		expect(calls[0]!.method).toBe('POST')
		expect(calls[0]!.path).toBe('/api/runs/run-7/artifacts')
		expect(calls[0]!.body).toEqual({
			kind: 'other',
			title: 'note.md',
			ref_kind: 'inline',
			ref_value: '# hello',
			mime_type: 'text/markdown',
			metadata: { k: 'v' },
		})
	})

	test('run_artifact_content reads artifact content via GET', async () => {
		const result = (await invokeTool('run_artifact_content', {
			run_id: 'run-7',
			artifact_id: 'art-1',
		})) as { content: Array<{ text: string }> }
		const calls = nonTelemetry(recorded)
		expect(calls).toHaveLength(1)
		expect(calls[0]!.method).toBe('GET')
		expect(calls[0]!.path).toBe('/api/runs/run-7/artifacts/art-1/content')
		const payload = JSON.parse(result.content[0]!.text)
		expect(payload.text).toBe('artifact body')
		expect(payload.content_type).toBe('text/plain')
	})
})

describe('MCP E2E — knowledge tools', () => {
	test('knowledge_write PUTs to /api/knowledge/:path', async () => {
		await invokeTool('knowledge_write', {
			path: 'docs/onboarding.md',
			content: '# Welcome',
			title: 'Onboarding',
			scope_type: 'company',
		})
		const calls = nonTelemetry(recorded)
		expect(calls).toHaveLength(1)
		expect(calls[0]!.method).toBe('PUT')
		expect(calls[0]!.path).toBe('/api/knowledge/docs/onboarding.md')
		expect(calls[0]!.body).toEqual({
			content: '# Welcome',
			title: 'Onboarding',
			mime_type: undefined,
		})
		expect(calls[0]!.query.scope_type).toBe('company')
	})

	test('knowledge_read GETs a path', async () => {
		await invokeTool('knowledge_read', { path: 'docs/onboarding.md' })
		const calls = nonTelemetry(recorded)
		expect(calls).toHaveLength(1)
		expect(calls[0]!.method).toBe('GET')
		expect(calls[0]!.path).toBe('/api/knowledge/docs/onboarding.md')
	})

	test('knowledge_search GETs /api/knowledge/search with q', async () => {
		await invokeTool('knowledge_search', { query: 'onboarding' })
		const calls = nonTelemetry(recorded)
		expect(calls).toHaveLength(1)
		expect(calls[0]!.method).toBe('GET')
		expect(calls[0]!.path).toBe('/api/knowledge/search')
		expect(calls[0]!.query.q).toBe('onboarding')
	})

	test('knowledge_delete requires confirm; with confirm DELETEs', async () => {
		const blocked = (await invokeTool('knowledge_delete', {
			path: 'docs/onboarding.md',
		})) as { content: Array<{ text: string }> }
		expect(JSON.parse(blocked.content[0]!.text).confirmation_required).toBe(true)
		expect(recorded).toEqual([])

		await invokeTool('knowledge_delete', { path: 'docs/onboarding.md', confirm: true })
		const calls = nonTelemetry(recorded)
		expect(calls).toHaveLength(1)
		expect(calls[0]!.method).toBe('DELETE')
		expect(calls[0]!.path).toBe('/api/knowledge/docs/onboarding.md')
	})
})

describe('MCP E2E — schedule tools', () => {
	test('schedule_create POSTs to /api/schedules with body', async () => {
		await invokeTool('schedule_create', {
			name: 'Daily report',
			cron: '0 9 * * *',
			agent_id: 'reporter',
			enabled: true,
		})
		const calls = nonTelemetry(recorded)
		expect(calls).toHaveLength(1)
		expect(calls[0]!.method).toBe('POST')
		expect(calls[0]!.path).toBe('/api/schedules')
		expect(calls[0]!.body).toEqual({
			name: 'Daily report',
			cron: '0 9 * * *',
			agent_id: 'reporter',
			enabled: true,
		})
	})

	test('schedule_get GETs detail', async () => {
		await invokeTool('schedule_get', { id: 'sched-1' })
		const calls = nonTelemetry(recorded)
		expect(calls).toHaveLength(1)
		expect(calls[0]!.method).toBe('GET')
		expect(calls[0]!.path).toBe('/api/schedules/sched-1')
	})

	test('schedule_history GETs history with limit query', async () => {
		await invokeTool('schedule_history', { id: 'sched-1', limit: 7 })
		const calls = nonTelemetry(recorded)
		expect(calls).toHaveLength(1)
		expect(calls[0]!.method).toBe('GET')
		expect(calls[0]!.path).toBe('/api/schedules/sched-1/history')
		expect(calls[0]!.query.limit).toBe('7')
	})

	test('schedule_trigger requires confirm; with confirm POSTs trigger', async () => {
		const blocked = (await invokeTool('schedule_trigger', { id: 'sched-1' })) as {
			content: Array<{ text: string }>
		}
		expect(JSON.parse(blocked.content[0]!.text).confirmation_required).toBe(true)
		expect(recorded).toEqual([])

		await invokeTool('schedule_trigger', { id: 'sched-1', confirm: true })
		const calls = nonTelemetry(recorded)
		expect(calls).toHaveLength(1)
		expect(calls[0]!.method).toBe('POST')
		expect(calls[0]!.path).toBe('/api/schedules/sched-1/trigger')
	})

	test('schedule_delete requires confirm; with confirm DELETEs', async () => {
		const blocked = (await invokeTool('schedule_delete', { id: 'sched-1' })) as {
			content: Array<{ text: string }>
		}
		expect(JSON.parse(blocked.content[0]!.text).confirmation_required).toBe(true)
		expect(recorded).toEqual([])

		await invokeTool('schedule_delete', { id: 'sched-1', confirm: true })
		const calls = nonTelemetry(recorded)
		expect(calls).toHaveLength(1)
		expect(calls[0]!.method).toBe('DELETE')
		expect(calls[0]!.path).toBe('/api/schedules/sched-1')
	})
})

describe('MCP E2E — worker join token', () => {
	test('worker_join_token_create requires confirm; with confirm POSTs to enrollment/tokens', async () => {
		const blocked = (await invokeTool('worker_join_token_create', {
			description: 'mac mini',
		})) as { content: Array<{ text: string }> }
		expect(JSON.parse(blocked.content[0]!.text).confirmation_required).toBe(true)
		expect(recorded).toEqual([])

		await invokeTool('worker_join_token_create', {
			description: 'mac mini',
			ttl_seconds: 3600,
			confirm: true,
		})
		const calls = nonTelemetry(recorded)
		expect(calls).toHaveLength(1)
		expect(calls[0]!.method).toBe('POST')
		expect(calls[0]!.path).toBe('/api/enrollment/tokens')
		expect(calls[0]!.body).toEqual({ description: 'mac mini', ttl_seconds: 3600 })
	})
})

// ─── Telemetry side-effects ───────────────────────────────────────────────

describe('MCP E2E — telemetry side-effects', () => {
	const originalRunId = process.env.AUTOPILOT_RUN_ID

	afterEach(() => {
		if (originalRunId === undefined) delete process.env.AUTOPILOT_RUN_ID
		else process.env.AUTOPILOT_RUN_ID = originalRunId
	})

	test('AUTOPILOT_RUN_ID adds a tool_use POST to /api/runs/:run/events on success', async () => {
		process.env.AUTOPILOT_RUN_ID = 'test-run-1'
		await invokeTool('config_default_skills', {})
		const events = telemetryEvents(recorded)
		expect(events).toHaveLength(1)
		expect(events[0]!.path).toBe('/api/runs/test-run-1/events')
		const body = events[0]!.body as {
			type: string
			summary: string
			metadata: { tool: string; success: boolean; source: string }
		}
		expect(body.type).toBe('tool_use')
		expect(body.summary).toContain('mcp config_default_skills ok')
		expect(body.metadata.tool).toBe('config_default_skills')
		expect(body.metadata.success).toBe(true)
		expect(body.metadata.source).toBe('mcp-server')
	})

	test('successful run_events also writes telemetry sink because runId is in args', async () => {
		await invokeTool('run_events', { id: 'run-42' })
		const events = telemetryEvents(recorded)
		expect(events).toHaveLength(1)
		expect(events[0]!.path).toBe('/api/runs/run-42/events')
		// runId only — taskId not inferred → no telemetry sink call
		expect(telemetrySink(recorded)).toHaveLength(0)
	})

	test('task tool with both runId and taskId emits BOTH event and telemetry sink', async () => {
		process.env.AUTOPILOT_RUN_ID = 'test-run-1'
		await invokeTool('task_update', { id: 'task-99', status: 'in_progress' })
		expect(telemetryEvents(recorded).map((c) => c.path)).toEqual(['/api/runs/test-run-1/events'])
		expect(telemetrySink(recorded)).toHaveLength(1)
		const sinkBody = telemetrySink(recorded)[0]!.body as {
			tool: string
			task_id: string
			run_id: string
			source: string
		}
		expect(sinkBody.tool).toBe('task_update')
		expect(sinkBody.task_id).toBe('task-99')
		expect(sinkBody.run_id).toBe('test-run-1')
		expect(sinkBody.source).toBe('mcp-server')
	})
})

// ─── Redaction ────────────────────────────────────────────────────────────

describe('MCP E2E — telemetry redaction', () => {
	const originalRunId = process.env.AUTOPILOT_RUN_ID

	afterEach(() => {
		if (originalRunId === undefined) delete process.env.AUTOPILOT_RUN_ID
		else process.env.AUTOPILOT_RUN_ID = originalRunId
	})

	test('secret-shaped arg key is redacted in /api/runs/:id/events metadata.args', async () => {
		process.env.AUTOPILOT_RUN_ID = 'test-run-1'
		await invokeTool('task_update', {
			id: 'task-1',
			status: 'done',
			api_key: 'super-secret-token-12345',
		})

		const events = telemetryEvents(recorded)
		expect(events).toHaveLength(1)
		const raw = JSON.stringify(events[0]!.body)
		expect(raw).not.toContain('super-secret-token-12345')
		const body = events[0]!.body as {
			metadata: { args: Record<string, unknown> }
		}
		expect(body.metadata.args.api_key).toBe('<redacted>')
		expect(body.metadata.args.id).toBe('task-1')
	})

	test('secret-shaped arg key is redacted in the /api/mcp/telemetry sink body', async () => {
		await invokeTool('task_update', {
			id: 'task-1',
			status: 'done',
			api_key: 'super-secret-token-12345',
		})
		const sinks = telemetrySink(recorded)
		expect(sinks).toHaveLength(1)
		const raw = JSON.stringify(sinks[0]!.body)
		expect(raw).not.toContain('super-secret-token-12345')
		const sink = sinks[0]!.body as { args: Record<string, unknown> }
		expect(sink.args.api_key).toBe('<redacted>')
	})
})

// ─── Confirmation policy gating ───────────────────────────────────────────

describe('MCP E2E — confirmation gating', () => {
	test('task_delete without confirm: 0 HTTP calls; with confirm: DELETE + telemetry', async () => {
		process.env.AUTOPILOT_RUN_ID = 'test-run-1'
		try {
			// No confirm → blocked, zero HTTP traffic at all (including telemetry).
			const blocked = (await invokeTool('task_delete', { id: 'task-1' })) as {
				content: Array<{ text: string }>
			}
			expect(JSON.parse(blocked.content[0]!.text).confirmation_required).toBe(true)
			expect(recorded).toEqual([])

			// With confirm → DELETE on /api/tasks/:id and matching telemetry.
			await invokeTool('task_delete', { id: 'task-1', confirm: true })
			const nonTel = nonTelemetry(recorded)
			expect(nonTel).toHaveLength(1)
			expect(nonTel[0]!.method).toBe('DELETE')
			expect(nonTel[0]!.path).toBe('/api/tasks/task-1')

			// 1 telemetry event (run id from env) + 1 telemetry sink (taskId from args).
			expect(telemetryEvents(recorded)).toHaveLength(1)
			expect(telemetrySink(recorded)).toHaveLength(1)
		} finally {
			delete process.env.AUTOPILOT_RUN_ID
		}
	})

	test('confirm and confirmation_token are stripped from the request body/query', async () => {
		await invokeTool('task_cancel', { id: 'task-1', confirm: true, reason: 'cleanup' })
		const calls = nonTelemetry(recorded)
		expect(calls).toHaveLength(1)
		const body = calls[0]!.body as Record<string, unknown>
		expect(body.confirm).toBeUndefined()
		expect(body.confirmation_token).toBeUndefined()
		expect(body.reason).toBe('cleanup')
	})
})

// ─── Auth header behaviour (subprocess — env captured at module load) ─────

/**
 * `env.AUTOPILOT_LOCAL_DEV` and `env.AUTOPILOT_API_KEY` are captured by the
 * @t3-oss/env-core schema at module-load time. To exercise the auth header
 * branches we must spawn a fresh process with the right env in place before
 * `tools.ts` is imported.
 */
function spawnHeaderCapture(envOverrides: Record<string, string>) {
	return Bun.spawnSync(
		[
			'bun',
			'-e',
			`
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTools } from './src/tools.ts';
const tools = new Map();
registerTools({
  tool(name, _description, _schema, handler) {
    tools.set(name, handler);
  },
});
let lastHeaders = {};
globalThis.fetch = async (url, opts) => {
  const h = opts?.headers;
  if (h instanceof Headers) {
    lastHeaders = Object.fromEntries(h.entries());
  } else if (h && typeof h === 'object') {
    lastHeaders = Object.fromEntries(
      Object.entries(h).map(([k, v]) => [k.toLowerCase(), v])
    );
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
await tools.get('config_default_skills')({});
console.log(JSON.stringify(lastHeaders));
`,
		],
		{
			cwd: import.meta.dir + '/..',
			env: {
				...process.env,
				AUTOPILOT_API_URL: 'http://localhost:7778',
				AUTOPILOT_RUN_ID: '',
				AUTOPILOT_LOCAL_DEV: '',
				AUTOPILOT_API_KEY: '',
				...envOverrides,
			},
			stdout: 'pipe',
			stderr: 'pipe',
		},
	)
}

describe('MCP E2E — auth headers', () => {
	test('AUTOPILOT_API_KEY produces Authorization: Bearer …', () => {
		const child = spawnHeaderCapture({ AUTOPILOT_API_KEY: 'mcp-e2e-key' })
		if (child.exitCode !== 0) {
			console.error('stderr:', child.stderr.toString())
		}
		expect(child.exitCode).toBe(0)
		const headers = JSON.parse(child.stdout.toString().trim()) as Record<string, string>
		expect(headers.authorization).toBe('Bearer mcp-e2e-key')
		expect(headers['x-local-dev']).toBeUndefined()
	})

	test('AUTOPILOT_LOCAL_DEV=true produces X-Local-Dev: true (and no Bearer)', () => {
		const child = spawnHeaderCapture({
			AUTOPILOT_LOCAL_DEV: 'true',
			AUTOPILOT_API_KEY: 'should-be-ignored',
		})
		if (child.exitCode !== 0) {
			console.error('stderr:', child.stderr.toString())
		}
		expect(child.exitCode).toBe(0)
		const headers = JSON.parse(child.stdout.toString().trim()) as Record<string, string>
		expect(headers['x-local-dev']).toBe('true')
		expect(headers.authorization).toBeUndefined()
	})
})
