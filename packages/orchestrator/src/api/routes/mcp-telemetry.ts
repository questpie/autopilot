/**
 * MCP telemetry route — receives structured tool-invocation reports from the
 * MCP server and writes them to the activity feed (and optionally to a run's
 * event stream when no task scope is present).
 *
 * The MCP server already POSTs `tool_use` run events directly to
 * /api/runs/:id/events whenever it sees a runId, so when both run_id and
 * task_id are present we only write the activity row here. When only run_id
 * is present (no task) we also append a `tool_use` event to the run so the
 * orchestrator log stays in step with what the LLM actually did.
 */

import { Hono } from 'hono'
import { validator as zValidator } from 'hono-openapi'
import { z } from 'zod'
import type { AppEnv } from '../app'

const errorSchema = z
	.object({
		class: z.string().optional(),
		message: z.string().optional(),
	})
	.passthrough()

const telemetryBodySchema = z.object({
	tool: z.string().min(1),
	source: z.string().optional(),
	success: z.boolean(),
	duration_ms: z.number().nonnegative(),
	run_id: z.string().optional(),
	task_id: z.string().optional(),
	project_id: z.string().optional(),
	args: z.record(z.unknown()).optional(),
	error: errorSchema.optional(),
})

const mcpTelemetry = new Hono<AppEnv>().post(
	'/',
	zValidator('json', telemetryBodySchema),
	async (c) => {
		const actor = c.get('actor')
		if (!actor) return c.json({ error: 'Unauthorized' }, 401)

		const body = c.req.valid('json')
		const { activityService, runService } = c.get('services')

		const summary = `tool ${body.tool} ${body.success ? 'ok' : 'failed'}`
		const details = JSON.stringify({
			task_id: body.task_id,
			run_id: body.run_id,
			project_id: body.project_id,
			tool: body.tool,
			source: body.source,
			duration_ms: body.duration_ms,
			success: body.success,
			args: body.args,
			error: body.error,
			actor_role: actor.role,
		})

		if (body.task_id) {
			await activityService.log({
				actor: actor.id ?? 'mcp',
				type: 'mcp_invocation',
				summary,
				details,
			})
		}

		if (body.run_id && !body.task_id) {
			await runService.appendEvent(body.run_id, {
				type: 'tool_use',
				summary,
				metadata: details,
			})
		}

		return c.json({ ok: true as const }, 200)
	},
)

export { mcpTelemetry }
