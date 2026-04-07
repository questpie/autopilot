import { Hono } from 'hono'
import { validator as zValidator } from 'hono-openapi'
import { z } from 'zod'
import type { AppEnv } from '../app'

const childCandidateSchema = z.object({
	title: z.string().min(1),
	description: z.string().optional(),
	type: z.string().min(1),
	priority: z.string().optional(),
	assigned_to: z.string().optional(),
	workflow_id: z.string().optional(),
	context: z.string().optional(),
	metadata: z.string().optional(),
	dedupe_key: z.string().optional(),
})

const taskGraph = new Hono<AppEnv>()
	// POST /tasks/:id/spawn-children — idempotent child task materialization
	.post(
		'/:id/spawn-children',
		zValidator('param', z.object({ id: z.string() })),
		zValidator(
			'json',
			z.object({
				children: z.array(childCandidateSchema).min(1),
				relation_type: z.string().optional(),
				origin_run_id: z.string().optional(),
			}),
		),
		async (c) => {
			const { taskGraphService } = c.get('services')
			const actor = c.get('actor')
			const { id } = c.req.valid('param')
			const body = c.req.valid('json')

			try {
				const result = await taskGraphService.spawnChildren({
					parent_task_id: id,
					children: body.children,
					relation_type: body.relation_type,
					origin_run_id: body.origin_run_id,
					created_by: actor?.id ?? 'system',
				})
				return c.json(result, 200)
			} catch (err) {
				const message = err instanceof Error ? err.message : 'spawn failed'
				if (message.includes('not found')) {
					return c.json({ error: message }, 404)
				}
				return c.json({ error: message }, 500)
			}
		},
	)
	// GET /tasks/:id/children — list child tasks
	.get(
		'/:id/children',
		zValidator('param', z.object({ id: z.string() })),
		zValidator('query', z.object({ relation_type: z.string().optional() })),
		async (c) => {
			const { taskGraphService } = c.get('services')
			const { id } = c.req.valid('param')
			const { relation_type } = c.req.valid('query')
			const children = await taskGraphService.listChildren(id, relation_type)
			return c.json(children, 200)
		},
	)
	// GET /tasks/:id/parents — list parent tasks
	.get(
		'/:id/parents',
		zValidator('param', z.object({ id: z.string() })),
		zValidator('query', z.object({ relation_type: z.string().optional() })),
		async (c) => {
			const { taskGraphService } = c.get('services')
			const { id } = c.req.valid('param')
			const { relation_type } = c.req.valid('query')
			const parents = await taskGraphService.listParents(id, relation_type)
			return c.json(parents, 200)
		},
	)
	// GET /tasks/:id/rollup — derived child status rollup
	.get(
		'/:id/rollup',
		zValidator('param', z.object({ id: z.string() })),
		zValidator('query', z.object({ relation_type: z.string().optional() })),
		async (c) => {
			const { taskGraphService } = c.get('services')
			const { id } = c.req.valid('param')
			const { relation_type } = c.req.valid('query')
			const rollup = await taskGraphService.childRollup(id, relation_type)
			return c.json(rollup, 200)
		},
	)

export { taskGraph }
