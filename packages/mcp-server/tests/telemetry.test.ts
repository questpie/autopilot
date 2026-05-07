/**
 * MCP telemetry tests — id inference, redaction, and best-effort fetch.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { inferIds, recordInvocation } from '../src/telemetry'

interface FetchCall {
	url: string
	method: string
	body: unknown
}

const originalFetch = globalThis.fetch
const originalEnvRunId = process.env.AUTOPILOT_RUN_ID
const originalLocalDev = process.env.AUTOPILOT_LOCAL_DEV
const originalApiKey = process.env.AUTOPILOT_API_KEY

function installFetchRecorder(opts?: { reject?: boolean }): FetchCall[] {
	const calls: FetchCall[] = []
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = input instanceof Request ? input.url : String(input)
		const method = init?.method ?? (input instanceof Request ? input.method : 'GET')
		const body = typeof init?.body === 'string' ? safeJson(init.body) : undefined
		calls.push({ url, method, body })
		if (opts?.reject) throw new Error('boom')
		return Response.json({ ok: true })
	}) as typeof fetch
	return calls
}

function safeJson(value: string): unknown {
	try {
		return JSON.parse(value)
	} catch {
		return value
	}
}

beforeEach(() => {
	delete process.env.AUTOPILOT_RUN_ID
	process.env.AUTOPILOT_LOCAL_DEV = 'true'
	delete process.env.AUTOPILOT_API_KEY
})

afterEach(() => {
	globalThis.fetch = originalFetch
	if (originalEnvRunId === undefined) delete process.env.AUTOPILOT_RUN_ID
	else process.env.AUTOPILOT_RUN_ID = originalEnvRunId
	if (originalLocalDev === undefined) delete process.env.AUTOPILOT_LOCAL_DEV
	else process.env.AUTOPILOT_LOCAL_DEV = originalLocalDev
	if (originalApiKey === undefined) delete process.env.AUTOPILOT_API_KEY
	else process.env.AUTOPILOT_API_KEY = originalApiKey
})

describe('inferIds', () => {
	test('extracts run_id for run_* tools from `id` arg', () => {
		expect(inferIds('run_cancel', { id: 'run-1' })).toEqual({ runId: 'run-1' })
		expect(inferIds('run_get', { id: 'run-2' })).toEqual({ runId: 'run-2' })
	})

	test('extracts task_id for task_* tools from `id` arg', () => {
		expect(inferIds('task_delete', { id: 'task-1' })).toEqual({ taskId: 'task-1' })
		expect(inferIds('task_get', { id: 'task-9' })).toEqual({ taskId: 'task-9' })
	})

	test('uses parent_task_id and task_id explicitly', () => {
		expect(inferIds('task_spawn_children', { parent_task_id: 'task-p' })).toEqual({
			taskId: 'task-p',
		})
		expect(inferIds('task_depend', { task_id: 'task-d' })).toEqual({
			taskId: 'task-d',
		})
	})

	test('extracts project_id from args', () => {
		expect(inferIds('config_get', { project_id: 'proj-1', type: 'context' })).toEqual({
			projectId: 'proj-1',
		})
	})

	test('falls back to AUTOPILOT_RUN_ID env when no run_id in args', () => {
		process.env.AUTOPILOT_RUN_ID = 'env-run'
		expect(inferIds('task_get', { id: 'task-1' })).toEqual({
			runId: 'env-run',
			taskId: 'task-1',
		})
	})

	test('returns empty object when nothing identifiable', () => {
		expect(inferIds('search', { query: 'hello' })).toEqual({})
	})
})

describe('recordInvocation', () => {
	test('does nothing when no identity and no auth', async () => {
		delete process.env.AUTOPILOT_LOCAL_DEV
		delete process.env.AUTOPILOT_API_KEY
		const calls = installFetchRecorder()
		await recordInvocation(
			{
				name: 'search',
				args: { query: 'hi' },
				startedAt: 0,
				runId: undefined,
				taskId: undefined,
				projectId: undefined,
				source: 'mcp-server',
			},
			{ success: true, durationMs: 4 },
		)
		expect(calls).toEqual([])
	})

	test('posts tool_use to /api/runs/:id/events when runId is set', async () => {
		const calls = installFetchRecorder()
		await recordInvocation(
			{
				name: 'task_get',
				args: { id: 'task-1', api_key: 'sekret' },
				startedAt: 0,
				runId: 'run-7',
				taskId: undefined,
				projectId: undefined,
				source: 'mcp-server',
			},
			{ success: true, durationMs: 12 },
		)

		expect(calls.length).toBe(1)
		const call = calls[0]!
		expect(call.method).toBe('POST')
		expect(new URL(call.url).pathname).toBe('/api/runs/run-7/events')

		const body = call.body as {
			type: string
			summary: string
			metadata: { tool: string; success: boolean; args: Record<string, unknown> }
		}
		expect(body.type).toBe('tool_use')
		expect(body.summary).toContain('mcp task_get ok')
		expect(body.metadata.tool).toBe('task_get')
		expect(body.metadata.success).toBe(true)
		expect(body.metadata.args.api_key).toBe('<redacted>')
		expect(body.metadata.args.id).toBe('task-1')
	})

	test('posts to /api/mcp/telemetry when taskId is set', async () => {
		const calls = installFetchRecorder()
		await recordInvocation(
			{
				name: 'task_delete',
				args: { id: 'task-1' },
				startedAt: 0,
				runId: undefined,
				taskId: 'task-1',
				projectId: 'proj-1',
				source: 'mcp-server',
			},
			{ success: false, durationMs: 30, error: { class: 'Error', message: 'nope' } },
		)
		expect(calls.length).toBe(1)
		const call = calls[0]!
		expect(new URL(call.url).pathname).toBe('/api/mcp/telemetry')
		const body = call.body as {
			tool: string
			success: boolean
			task_id: string
			project_id: string
			error?: { message: string }
		}
		expect(body.tool).toBe('task_delete')
		expect(body.success).toBe(false)
		expect(body.task_id).toBe('task-1')
		expect(body.project_id).toBe('proj-1')
		expect(body.error?.message).toBe('nope')
	})

	test('emits both run event and mcp telemetry when both ids exist', async () => {
		const calls = installFetchRecorder()
		await recordInvocation(
			{
				name: 'task_cancel',
				args: { id: 'task-1' },
				startedAt: 0,
				runId: 'run-7',
				taskId: 'task-1',
				projectId: undefined,
				source: 'mcp-server',
			},
			{ success: true, durationMs: 5 },
		)
		expect(calls.map((c) => new URL(c.url).pathname)).toEqual([
			'/api/runs/run-7/events',
			'/api/mcp/telemetry',
		])
	})

	test('does not throw when fetch rejects', async () => {
		installFetchRecorder({ reject: true })
		await expect(
			recordInvocation(
				{
					name: 'task_get',
					args: { id: 'task-1' },
					startedAt: 0,
					runId: 'run-7',
					taskId: 'task-1',
					projectId: undefined,
					source: 'mcp-server',
				},
				{ success: true, durationMs: 1 },
			),
		).resolves.toBeUndefined()
	})

	test('does not include sensitive arg values in telemetry payloads', async () => {
		const calls = installFetchRecorder()
		await recordInvocation(
			{
				name: 'task_update',
				args: { id: 'task-1', secret: 'shh', token: 'tok' },
				startedAt: 0,
				runId: 'run-7',
				taskId: 'task-1',
				projectId: undefined,
				source: 'mcp-server',
			},
			{ success: true, durationMs: 5 },
		)
		const eventBody = calls[0]!.body as {
			metadata: { args: Record<string, unknown> }
		}
		expect(eventBody.metadata.args.secret).toBe('<redacted>')
		expect(eventBody.metadata.args.token).toBe('<redacted>')
		const telemetryBody = calls[1]!.body as { args: Record<string, unknown> }
		expect(telemetryBody.args.secret).toBe('<redacted>')
		expect(telemetryBody.args.token).toBe('<redacted>')
	})
})
