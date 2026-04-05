/**
 * Intent intake route.
 *
 * POST /api/intake/:providerId
 *
 * Receives an inbound payload, invokes the matching intent_channel provider
 * handler with the `intent.ingest` operation, validates the normalized result,
 * and materializes it into a real task through the existing task+workflow path.
 *
 * Auth: user auth (same as /api/tasks) for V1.
 */
import { Hono } from 'hono'
import { validator as zValidator } from 'hono-openapi'
import { z } from 'zod'
import { IntakeResultSchema } from '@questpie/autopilot-spec'
import type { AppEnv } from '../app'
import { invokeProvider } from '../../providers/handler-runtime'

const intake = new Hono<AppEnv>()
	.post(
		'/:providerId',
		zValidator('param', z.object({ providerId: z.string() })),
		async (c) => {
			const { workflowEngine } = c.get('services')
			const authoredConfig = c.get('authoredConfig')
			const companyRoot = c.get('companyRoot')
			const { providerId } = c.req.valid('param')

			// Look up provider
			const provider = authoredConfig.providers.get(providerId)
			if (!provider) {
				return c.json({ error: `Provider not found: ${providerId}` }, 404)
			}

			if (provider.kind !== 'intent_channel') {
				return c.json({ error: `Provider ${providerId} is not an intent_channel` }, 400)
			}

			const hasIngest = provider.capabilities.some((cap) => cap.op === 'intent.ingest')
			if (!hasIngest) {
				return c.json({ error: `Provider ${providerId} does not support intent.ingest` }, 400)
			}

			// Read the raw inbound payload
			const payload = await c.req.json().catch(() => null)
			if (!payload || typeof payload !== 'object') {
				return c.json({ error: 'Request body must be a JSON object' }, 400)
			}

			// Invoke the handler with intent.ingest
			const { secretService } = c.get('services')
			const handlerResult = await invokeProvider(
				provider,
				'intent.ingest',
				payload as Record<string, unknown>,
				{ companyRoot },
				secretService,
			)

			if (!handlerResult.ok) {
				return c.json({ error: `Handler failed: ${handlerResult.error}` }, 502)
			}

			// Parse the handler's metadata as an intake action
			const parsed = IntakeResultSchema.safeParse(handlerResult.metadata)
			if (!parsed.success) {
				return c.json({
					error: 'Handler returned invalid intake result',
					details: parsed.error.message.slice(0, 300),
				}, 502)
			}

			const result = parsed.data

			// Handle noop
			if (result.action === 'noop') {
				return c.json({ action: 'noop', reason: result.reason }, 200)
			}

			// Materialize through the shared task creation path
			const taskInput = result.input
			const materialized = await workflowEngine.materializeTask({
				title: taskInput.title,
				type: taskInput.type,
				description: taskInput.description,
				priority: taskInput.priority,
				assigned_to: taskInput.assigned_to,
				workflow_id: taskInput.workflow_id,
				metadata: taskInput.metadata ? JSON.stringify(taskInput.metadata) : undefined,
				created_by: `provider:${providerId}`,
			})

			if (!materialized) {
				return c.json({ error: 'Failed to create task' }, 500)
			}

			return c.json({ action: 'task.created', task: materialized.task }, 201)
		},
	)

export { intake }
