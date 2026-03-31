import { and, desc, eq, isNull } from 'drizzle-orm'
import { Hono } from 'hono'
import { describeRoute } from 'hono-openapi'
import { validator as zValidator } from 'hono-openapi'
import { z } from 'zod'
import * as schema from '../../db/schema'
import type { AppEnv } from '../app'

const workflowRuns = new Hono<AppEnv>()
	.get(
		'/',
		describeRoute({
			tags: ['workflow-runs'],
			description: 'List workflow runs with optional task/workflow/status filters',
			responses: { 200: { description: 'Workflow runs' } },
		}),
		zValidator(
			'query',
			z.object({
				taskId: z.string().optional(),
				workflowId: z.string().optional(),
				status: z.string().optional(),
				includeArchived: z.enum(['true', 'false']).optional(),
			}),
		),
		async (c) => {
			const db = c.get('db')
			const { taskId, workflowId, status, includeArchived } = c.req.valid('query')

			const filters = [
				taskId ? eq(schema.workflowRuns.task_id, taskId) : undefined,
				workflowId ? eq(schema.workflowRuns.workflow_id, workflowId) : undefined,
				status ? eq(schema.workflowRuns.status, status) : undefined,
				includeArchived === 'true' ? undefined : isNull(schema.workflowRuns.archived_at),
			].filter(Boolean)

			const rows = await db
				.select()
				.from(schema.workflowRuns)
				.where(filters.length > 0 ? and(...filters) : undefined)
				.orderBy(desc(schema.workflowRuns.updated_at))
				.limit(100)

			return c.json(rows)
		},
	)
	.get(
		'/task/:taskId',
		describeRoute({
			tags: ['workflow-runs'],
			description: 'Get the current workflow run and step runs for a task',
			responses: {
				200: { description: 'Workflow run details' },
				404: { description: 'Workflow run not found' },
			},
		}),
		async (c) => {
			const db = c.get('db')
			const taskId = c.req.param('taskId')

			const runs = await db
				.select()
				.from(schema.workflowRuns)
				.where(eq(schema.workflowRuns.task_id, taskId))
				.limit(1)

			const run = runs[0]
			if (!run) {
				return c.json({ error: 'workflow run not found' }, 404)
			}

			const steps = await db
				.select()
				.from(schema.stepRuns)
				.where(eq(schema.stepRuns.workflow_run_id, run.id))
				.orderBy(schema.stepRuns.step_id, schema.stepRuns.attempt)

			return c.json({ run, steps })
		},
	)

export { workflowRuns }
