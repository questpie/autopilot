import { Hono } from 'hono'
import { validator as zValidator } from 'hono-openapi'
import { z } from 'zod'
import type { AppEnv } from '../app'
import { DependencyCycleError } from '../../services/task-relations'

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
	// GET /tasks/relations — bulk fetch all task relations (for tree view)
	.get(
		'/relations',
		zValidator('query', z.object({ relation_type: z.string().optional() })),
		async (c) => {
			const { taskRelationService } = c.get('services')
			const { relation_type } = c.req.valid('query')
			const relations = await taskRelationService.listAll(relation_type)
			return c.json(relations, 200)
		},
	)
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

	// POST /tasks/:id/dependencies — add one or more dependencies
	.post(
		'/:id/dependencies',
		zValidator('param', z.object({ id: z.string() })),
		zValidator(
			'json',
			z.object({
				depends_on: z.array(z.string().min(1)).min(1),
			}),
		),
		async (c) => {
			const { taskRelationService, taskService } = c.get('services')
			const actor = c.get('actor')
			const { id } = c.req.valid('param')
			const { depends_on } = c.req.valid('json')

			const task = await taskService.get(id)
			if (!task) return c.json({ error: 'task not found' }, 404)

			const results: Array<{ depends_on: string; status: string }> = []
			for (const depId of depends_on) {
				const depTask = await taskService.get(depId)
				if (!depTask) {
					results.push({ depends_on: depId, status: 'not_found' })
					continue
				}
				try {
					await taskRelationService.addDependency({
						task_id: id,
						depends_on_task_id: depId,
						created_by: actor?.id ?? 'system',
					})
					results.push({ depends_on: depId, status: 'added' })
				} catch (err) {
					if (err instanceof DependencyCycleError) {
						results.push({ depends_on: depId, status: 'cycle_detected' })
					} else {
						results.push({ depends_on: depId, status: 'error' })
					}
				}
			}

			return c.json({ task_id: id, dependencies: results }, 200)
		},
	)
	// GET /tasks/:id/dependencies — list tasks this task depends on
	.get(
		'/:id/dependencies',
		zValidator('param', z.object({ id: z.string() })),
		async (c) => {
			const { taskRelationService, taskService } = c.get('services')
			const { id } = c.req.valid('param')

			const deps = await taskRelationService.listDependencies(id)
			const tasks = []
			for (const dep of deps) {
				const task = await taskService.get(dep.target_task_id)
				if (task) tasks.push(task)
			}
			return c.json(tasks, 200)
		},
	)
	// GET /tasks/:id/dependents — list tasks that depend on this task
	.get(
		'/:id/dependents',
		zValidator('param', z.object({ id: z.string() })),
		async (c) => {
			const { taskRelationService, taskService } = c.get('services')
			const { id } = c.req.valid('param')

			const dependents = await taskRelationService.listDependents(id)
			const tasks = []
			for (const dep of dependents) {
				const task = await taskService.get(dep.source_task_id)
				if (task) tasks.push(task)
			}
			return c.json(tasks, 200)
		},
	)

export { taskGraph }
