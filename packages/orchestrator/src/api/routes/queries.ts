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
import { buildQueryInstructions } from '../../services/queries'

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

			const query = await queryService.create({
				prompt: body.prompt,
				agent_id: agentId,
				allow_repo_mutation: body.allow_repo_mutation,
				created_by: initiator,
			})

			const instructions = buildQueryInstructions(body.prompt, {
				allowMutation: body.allow_repo_mutation,
				hasResume: false,
			})

			// Resolve agent model/provider/variant from authored config
			const agentConfig = authoredConfig.agents.get(agentId)

			const runId = `run-${Date.now()}-${randomBytes(6).toString('hex')}`
			await runService.create({
				id: runId,
				agent_id: agentId,
				runtime: body.runtime ?? authoredConfig.defaults.runtime,
				model: agentConfig?.model,
				provider: agentConfig?.provider,
				variant: agentConfig?.variant,
				initiated_by: initiator,
				instructions,
			})

			await queryService.linkRun(query.id, runId)

			return c.json({
				query_id: query.id,
				run_id: runId,
				status: 'pending',
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
				prompt: query.prompt,
				agent_id: query.agent_id,
				allow_repo_mutation: query.allow_repo_mutation,
				created_by: query.created_by,
				created_at: query.created_at,
				ended_at: query.ended_at,
				promoted_task_id: query.promoted_task_id ?? null,
			}, 200)
		},
	)
	// POST /queries/:id/promote — promote a query to a durable task
	.post(
		'/:id/promote',
		zValidator('param', z.object({ id: z.string() })),
		zValidator(
			'json',
			z.object({
				title: z.string().min(1),
				type: z.string().default('promoted'),
				description: z.string().optional(),
				priority: z.string().optional(),
				workflow_id: z.string().optional(),
			}),
		),
		async (c) => {
			const { queryService, workflowEngine } = c.get('services')
			const { id } = c.req.valid('param')
			const body = c.req.valid('json')
			const actor = c.get('actor')?.id ?? 'system'

			const query = await queryService.get(id)
			if (!query) return c.json({ error: 'query not found' }, 404)
			if (query.promoted_task_id) {
				return c.json({ error: 'query already promoted', task_id: query.promoted_task_id }, 409)
			}

			const result = await workflowEngine.materializeTask({
				title: body.title,
				type: body.type,
				description: body.description ?? query.prompt,
				priority: body.priority,
				assigned_to: query.agent_id,
				workflow_id: body.workflow_id,
				context: JSON.stringify({ promoted_from_query: id }),
				created_by: actor,
			})

			if (!result) {
				return c.json({ error: 'failed to create task' }, 500)
			}

			await queryService.promote(id, result.task.id)

			return c.json({
				query_id: id,
				task_id: result.task.id,
				run_id: result.runId,
			}, 201)
		},
	)

export { queries }
