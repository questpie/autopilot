/**
 * MCP tool invocation telemetry.
 *
 * Every wrapped tool call produces structured telemetry sent to the
 * orchestrator so that operators can audit what an LLM did via MCP. We emit
 * two flavours:
 *
 *  - When a `runId` is in scope we POST a `tool_use` run event to the
 *    existing /api/runs/:id/events endpoint (worker-event compatible).
 *  - When a `taskId` is in scope (with or without runId) we POST a structured
 *    record to /api/mcp/telemetry, which writes an activity row keyed off the
 *    task. The orchestrator side will additionally append a tool_use run event
 *    if runId is present and no event was posted directly (to avoid double
 *    counting we still always go through this telemetry endpoint when a task
 *    is involved — it is the source of truth for the activity feed).
 *
 * Telemetry must never throw. If the network call fails we log via
 * `console.warn('[mcp-telemetry] …')` and return — the original tool result
 * has already been computed and the caller cares about that, not telemetry.
 */

import { env } from './env'
import { redactArgs } from './redact'

export interface InvocationContext {
	name: string
	args: Record<string, unknown>
	startedAt: number
	runId: string | undefined
	taskId: string | undefined
	projectId: string | undefined
	source: string
}

export interface InvocationOutcome {
	success: boolean
	durationMs: number
	error?: { class: string; message: string }
}

const SUMMARY_MAX = 140

function apiHeaders(): Record<string, string> {
	const headers: Record<string, string> = { 'Content-Type': 'application/json' }
	if (env.AUTOPILOT_LOCAL_DEV === 'true') {
		headers['X-Local-Dev'] = 'true'
	} else if (env.AUTOPILOT_API_KEY) {
		headers.Authorization = `Bearer ${env.AUTOPILOT_API_KEY}`
	}
	return headers
}

function hasAuth(): boolean {
	return env.AUTOPILOT_LOCAL_DEV === 'true' || !!env.AUTOPILOT_API_KEY
}

function pickString(args: Record<string, unknown>, key: string): string | undefined {
	const value = args[key]
	return typeof value === 'string' && value.length > 0 ? value : undefined
}

export function inferIds(
	name: string,
	args: Record<string, unknown>,
): { runId?: string; taskId?: string; projectId?: string } {
	const projectId = pickString(args, 'project_id')

	let runId = pickString(args, 'run_id') ?? pickString(args, 'origin_run_id')
	if (!runId && name.startsWith('run_')) {
		runId = pickString(args, 'id') ?? runId
	}
	if (!runId) {
		const envRun = process.env.AUTOPILOT_RUN_ID
		if (typeof envRun === 'string' && envRun.length > 0) runId = envRun
	}

	let taskId = pickString(args, 'task_id') ?? pickString(args, 'parent_task_id')
	if (!taskId && name.startsWith('task_')) {
		taskId = pickString(args, 'id') ?? taskId
	}

	return { runId, taskId, projectId }
}

function truncate(value: string, max: number): string {
	if (value.length <= max) return value
	return `${value.slice(0, max - 1)}…`
}

function summaryFor(name: string, outcome: InvocationOutcome): string {
	const status = outcome.success ? 'ok' : 'failed'
	const base = `mcp ${name} ${status} (${outcome.durationMs}ms)`
	return truncate(base, SUMMARY_MAX)
}

function buildMetadata(
	ctx: InvocationContext,
	outcome: InvocationOutcome,
): Record<string, unknown> {
	const meta: Record<string, unknown> = {
		tool: ctx.name,
		source: ctx.source,
		success: outcome.success,
		duration_ms: outcome.durationMs,
		args: redactArgs(ctx.args),
	}
	if (outcome.error) meta.error = outcome.error
	if (ctx.taskId) meta.task_id = ctx.taskId
	if (ctx.projectId) meta.project_id = ctx.projectId
	return meta
}

async function postRunEvent(
	runId: string,
	ctx: InvocationContext,
	outcome: InvocationOutcome,
): Promise<void> {
	try {
		const url = `${env.AUTOPILOT_API_URL}/api/runs/${encodeURIComponent(runId)}/events`
		await fetch(url, {
			method: 'POST',
			headers: apiHeaders(),
			body: JSON.stringify({
				type: 'tool_use',
				summary: summaryFor(ctx.name, outcome),
				metadata: buildMetadata(ctx, outcome),
			}),
		})
	} catch (err) {
		console.warn(
			'[mcp-telemetry] failed to post run event',
			err instanceof Error ? err.message : String(err),
		)
	}
}

async function postMcpTelemetry(
	ctx: InvocationContext,
	outcome: InvocationOutcome,
): Promise<void> {
	try {
		const url = `${env.AUTOPILOT_API_URL}/api/mcp/telemetry`
		const body: Record<string, unknown> = {
			tool: ctx.name,
			source: ctx.source,
			success: outcome.success,
			duration_ms: outcome.durationMs,
			args: redactArgs(ctx.args),
		}
		if (ctx.runId) body.run_id = ctx.runId
		if (ctx.taskId) body.task_id = ctx.taskId
		if (ctx.projectId) body.project_id = ctx.projectId
		if (outcome.error) body.error = outcome.error
		await fetch(url, {
			method: 'POST',
			headers: apiHeaders(),
			body: JSON.stringify(body),
		})
	} catch (err) {
		console.warn(
			'[mcp-telemetry] failed to post mcp telemetry',
			err instanceof Error ? err.message : String(err),
		)
	}
}

export async function recordInvocation(
	ctx: InvocationContext,
	outcome: InvocationOutcome,
): Promise<void> {
	const hasIdentity = !!(ctx.runId || ctx.taskId)
	if (!hasIdentity && !hasAuth()) return

	if (ctx.runId) {
		await postRunEvent(ctx.runId, ctx, outcome)
	}
	if (ctx.taskId) {
		await postMcpTelemetry(ctx, outcome)
	}
}
