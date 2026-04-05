/**
 * Query API routes — the non-task assistant plane.
 *
 * A query is NOT a task. It uses the same worker/runtime execution
 * model via taskless runs, but never creates hidden tasks.
 *
 * POST /queries       — create a query (dispatches a taskless run)
 * GET  /queries       — list queries
 * GET  /queries/:id   — get single query with result
 */
import { Hono } from 'hono'
import { validator as zValidator } from 'hono-openapi'
import { z } from 'zod'
import { randomBytes } from 'node:crypto'
import { QueryRequestSchema } from '@questpie/autopilot-spec'
import type { AppEnv } from '../app'

const queries = new Hono<AppEnv>()
	// POST /queries — create and dispatch a query
	.post(
		'/',
		zValidator('json', QueryRequestSchema),
		async (c) => {
			const { queryService, runService } = c.get('services')
			const authoredConfig = c.get('authoredConfig')
			const body = c.req.valid('json')
			const initiator = c.get('actor')?.id ?? 'system'

			const agentId = body.agent_id ?? authoredConfig.defaults.task_assignee
			if (!agentId) {
				return c.json({ error: 'agent_id required (no company default configured)' }, 400)
			}

			// ── Thin continuity: resolve carryover from prior query ──────
			let carryoverSummary: string | null = null
			let runtimeSessionRef: string | undefined
			let preferredWorkerId: string | undefined

			if (body.continue_from) {
				const prior = await queryService.get(body.continue_from)
				if (!prior) {
					return c.json({ error: `continue_from query not found: ${body.continue_from}` }, 404)
				}
				carryoverSummary = prior.summary?.slice(0, 500) ?? null

				if (prior.runtime_session_ref && prior.run_id) {
					runtimeSessionRef = prior.runtime_session_ref
					const priorRun = await runService.get(prior.run_id)
					preferredWorkerId = priorRun?.worker_id ?? undefined
				}
			}

			const query = await queryService.create({
				prompt: body.prompt,
				agent_id: agentId,
				allow_repo_mutation: body.allow_repo_mutation,
				continue_from: body.continue_from,
				carryover_summary: carryoverSummary ?? undefined,
				created_by: initiator,
			})

			const instructions = buildQueryInstructions(
				body.prompt,
				body.allow_repo_mutation,
				carryoverSummary,
			)

			const runId = `run-${Date.now()}-${randomBytes(6).toString('hex')}`
			await runService.create({
				id: runId,
				agent_id: agentId,
				runtime: body.runtime ?? authoredConfig.defaults.runtime,
				initiated_by: initiator,
				instructions,
				runtime_session_ref: runtimeSessionRef,
				preferred_worker_id: preferredWorkerId,
			})

			await queryService.linkRun(query.id, runId)

			return c.json({
				query_id: query.id,
				run_id: runId,
				status: 'pending',
				continue_from: body.continue_from ?? null,
			}, 201)
		},
	)
	// GET /queries — list queries
	.get(
		'/',
		zValidator(
			'query',
			z.object({
				status: z.string().optional(),
				agent_id: z.string().optional(),
			}),
		),
		async (c) => {
			const { queryService } = c.get('services')
			const filter = c.req.valid('query')
			const result = await queryService.list(filter)
			return c.json(result, 200)
		},
	)
	// GET /queries/:id — get single query (returns QueryResultSchema shape + inspection fields)
	.get(
		'/:id',
		zValidator('param', z.object({ id: z.string() })),
		async (c) => {
			const { queryService } = c.get('services')
			const { id } = c.req.valid('param')
			const query = await queryService.get(id)
			if (!query) return c.json({ error: 'query not found' }, 404)

			return c.json({
				query_id: query.id,
				summary: query.summary,
				mutated_repo: query.mutated_repo,
				status: query.status,
				run_id: query.run_id,
				error: query.status === 'failed' ? query.summary : null,
				continue_from: query.continue_from,
				prompt: query.prompt,
				agent_id: query.agent_id,
				allow_repo_mutation: query.allow_repo_mutation,
				carryover_summary: query.carryover_summary,
				created_by: query.created_by,
				created_at: query.created_at,
				ended_at: query.ended_at,
			}, 200)
		},
	)

export { queries }

// ─── Helpers ──────────────────────────────────────────────────────────────

function buildQueryInstructions(
	prompt: string,
	allowMutation: boolean,
	carryoverSummary: string | null,
): string {
	const parts: string[] = []

	if (carryoverSummary) {
		parts.push(`<PRIOR_QUERY_CONTEXT>\n${carryoverSummary}\n</PRIOR_QUERY_CONTEXT>`)
	}

	parts.push(
		allowMutation
			? 'You are in QUERY MODE with repo mutation allowed. You may read and edit files in the repo/company config.'
			: 'You are in QUERY MODE (read-only). You may inspect, explain, brainstorm, and draft, but do NOT modify any files.',
	)

	parts.push(prompt)

	return parts.join('\n\n')
}
