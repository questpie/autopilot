/**
 * Conversation binding + session routes.
 *
 * POST /api/conversations/bindings — create a binding (user auth)
 * POST /api/conversations/:providerId — inbound conversation payload (provider-secret auth)
 *
 * The inbound route:
 * 1. Validates provider is a conversation_channel with conversation.ingest
 * 2. Authenticates via X-Provider-Secret against provider's secret refs
 * 3. Invokes handler with conversation.ingest op
 * 4. Validates normalized ConversationResult
 * 5. Routes based on action type:
 *    - query.message → session-based query plane dispatch
 *    - task.* → session or binding lookup → workflow engine dispatch
 *    - noop → 200
 */
import { randomBytes } from 'node:crypto'
import { Hono } from 'hono'
import { validator as zValidator } from 'hono-openapi'
import { z } from 'zod'
import { ConversationResultSchema } from '@questpie/autopilot-spec'
import type { AppEnv } from '../app'
import { invokeProvider, resolveSecrets } from '../../providers/handler-runtime'
import { buildQueryInstructions } from '../../services/queries'

const conversations = new Hono<AppEnv>()
	// POST /conversations/bindings — create a binding (user auth, handled in app.ts)
	.post(
		'/bindings',
		zValidator(
			'json',
			z.object({
				provider_id: z.string().min(1),
				external_conversation_id: z.string().min(1),
				external_thread_id: z.string().optional(),
				mode: z.enum(['task_thread', 'intent_intake']),
				task_id: z.string().optional(),
				metadata: z.record(z.unknown()).optional(),
			}),
		),
		async (c) => {
			const { conversationBindingService, taskService } = c.get('services')
			const authoredConfig = c.get('authoredConfig')
			const body = c.req.valid('json')

			// Validate provider exists and is a conversation_channel
			const provider = authoredConfig.providers.get(body.provider_id)
			if (!provider) {
				return c.json({ error: `Provider not found: ${body.provider_id}` }, 404)
			}
			if (provider.kind !== 'conversation_channel') {
				return c.json({ error: `Provider ${body.provider_id} is not a conversation_channel` }, 400)
			}

			// task_thread mode requires task_id
			if (body.mode === 'task_thread' && !body.task_id) {
				return c.json({ error: 'task_thread bindings require task_id' }, 400)
			}

			// Validate task_id exists if provided
			if (body.task_id) {
				const task = await taskService.get(body.task_id)
				if (!task) {
					return c.json({ error: `Task not found: ${body.task_id}` }, 404)
				}
			}

			const id = `bind-${Date.now()}-${randomBytes(6).toString('hex')}`
			let binding: Awaited<ReturnType<typeof conversationBindingService.create>> | null = null
			try {
				binding = await conversationBindingService.create({
					id,
					provider_id: body.provider_id,
					external_conversation_id: body.external_conversation_id,
					external_thread_id: body.external_thread_id,
					mode: body.mode,
					task_id: body.task_id,
					metadata: body.metadata ? JSON.stringify(body.metadata) : undefined,
				})
			} catch (err) {
				if (err instanceof Error && err.message.includes('already exists')) {
					return c.json({ error: err.message }, 409)
				}
				throw err
			}

			if (!binding) {
				return c.json({ error: 'Failed to create binding' }, 500)
			}

			return c.json(binding, 201)
		},
	)
	// POST /conversations/:providerId — inbound conversation payload (provider-secret auth)
	.post('/:providerId', zValidator('param', z.object({ providerId: z.string() })), async (c) => {
		const { workflowEngine, conversationBindingService, sessionService, queryService, runService } = c.get('services')
		const authoredConfig = c.get('authoredConfig')
		const companyRoot = c.get('companyRoot')
		const { providerId } = c.req.valid('param')

		// Look up provider
		const provider = authoredConfig.providers.get(providerId)
		if (!provider) {
			return c.json({ error: `Provider not found: ${providerId}` }, 404)
		}

		if (provider.kind !== 'conversation_channel') {
			return c.json({ error: `Provider ${providerId} is not a conversation_channel` }, 400)
		}

		const hasIngest = provider.capabilities.some((cap) => cap.op === 'conversation.ingest')
		if (!hasIngest) {
			return c.json({ error: `Provider ${providerId} does not support conversation.ingest` }, 400)
		}

		// Provider-secret auth: require auth_secret ref on conversation_channel providers
		const authSecretRef = provider.secret_refs.find((r) => r.name === 'auth_secret')
		if (!authSecretRef) {
			return c.json(
				{
					error: `Provider ${providerId} has no auth_secret configured — inbound callbacks require authentication`,
				},
				403,
			)
		}

		// Accept X-Provider-Secret (generic) or X-Telegram-Bot-Api-Secret-Token (Telegram webhook)
		const providerSecret =
			c.req.header('x-provider-secret') ?? c.req.header('x-telegram-bot-api-secret-token')
		if (!providerSecret) {
			return c.json(
				{
					error:
						'Provider secret header required (X-Provider-Secret or X-Telegram-Bot-Api-Secret-Token)',
				},
				401,
			)
		}
		const resolved = await resolveSecrets([authSecretRef], c.get('services').secretService)
		const expected = resolved.get('auth_secret')
		if (!expected || providerSecret !== expected) {
			return c.json({ error: 'Invalid provider secret' }, 401)
		}

		// Read the raw inbound payload
		const payload = await c.req.json().catch(() => null)
		if (!payload || typeof payload !== 'object') {
			return c.json({ error: 'Request body must be a JSON object' }, 400)
		}

		// Invoke the handler
		const { secretService } = c.get('services')
		const handlerResult = await invokeProvider(
			provider,
			'conversation.ingest',
			payload as Record<string, unknown>,
			{ companyRoot },
			secretService,
		)

		if (!handlerResult.ok) {
			return c.json({ error: `Handler failed: ${handlerResult.error}` }, 502)
		}

		// Parse normalized conversation result
		const parsed = ConversationResultSchema.safeParse(handlerResult.metadata)
		if (!parsed.success) {
			return c.json(
				{
					error: 'Handler returned invalid conversation result',
					details: parsed.error.message.slice(0, 300),
				},
				502,
			)
		}

		const result = parsed.data

		if (result.action === 'noop') {
			return c.json({ action: 'noop', reason: result.reason }, 200)
		}

		// ── Query message routing ─────────────────────────────────────────
		if (result.action === 'query.message') {
			const session = await sessionService.findOrCreate({
				provider_id: providerId,
				external_conversation_id: result.conversation_id,
				external_thread_id: result.thread_id,
				mode: 'query',
			})

			const agentId = authoredConfig.defaults.task_assignee
			if (!agentId) {
				return c.json({ error: 'No default agent configured for query routing' }, 400)
			}

			// ── Check if session has an active running query → steer instead of new query
			if (session.last_query_id) {
				const lastQuery = await queryService.get(session.last_query_id)
				if (lastQuery?.status === 'running' && lastQuery.run_id) {
					const activeRun = await runService.get(lastQuery.run_id)
					if (activeRun && (activeRun.status === 'running' || activeRun.status === 'claimed')) {
						// Route as steer message to the active run
						const { steerService } = c.get('services')
						const steer = await steerService.create({
							run_id: activeRun.id,
							message: result.message,
							created_by: `provider:${providerId}`,
						})

						return c.json({
							action: 'query.steered',
							session_id: session.id,
							query_id: lastQuery.id,
							run_id: activeRun.id,
							steer_id: steer.id,
						}, 200)
					}
				}
			}

			// Resolve continuity from session's last query
			let carryoverSummary: string | null = null
			let runtimeSessionRef: string | undefined
			let preferredWorkerId: string | undefined

			if (session.last_query_id) {
				const priorQuery = await queryService.get(session.last_query_id)
				if (priorQuery) {
					carryoverSummary = priorQuery.summary?.slice(0, 500) ?? null
					if (priorQuery.runtime_session_ref && priorQuery.run_id) {
						runtimeSessionRef = priorQuery.runtime_session_ref
						const priorRun = await runService.get(priorQuery.run_id)
						preferredWorkerId = priorRun?.worker_id ?? undefined
					}
				}
			}

			const initiator = `provider:${providerId}`

			const query = await queryService.create({
				prompt: result.message,
				agent_id: agentId,
				allow_repo_mutation: false,
				continue_from: session.last_query_id ?? undefined,
				carryover_summary: carryoverSummary ?? undefined,
				created_by: initiator,
			})

			const instructions = buildQueryInstructions(result.message, false, carryoverSummary)

			// Resolve agent model/provider/variant from authored config
			const agentConfig = authoredConfig.agents.get(agentId)

			const runId = `run-${Date.now()}-${randomBytes(6).toString('hex')}`
			await runService.create({
				id: runId,
				agent_id: agentId,
				runtime: authoredConfig.defaults.runtime,
				model: agentConfig?.model,
				provider: agentConfig?.provider,
				variant: agentConfig?.variant,
				initiated_by: initiator,
				instructions,
				runtime_session_ref: runtimeSessionRef,
				preferred_worker_id: preferredWorkerId,
			})

			await queryService.linkRun(query.id, runId)

			const continueFrom = session.last_query_id
			await sessionService.updateLastQuery(session.id, query.id)

			return c.json({
				action: 'query.dispatched',
				session_id: session.id,
				query_id: query.id,
				run_id: runId,
				continue_from: continueFrom,
			}, 200)
		}

		// ── Task action routing ───────────────────────────────────────────
		// 1. Try session lookup first (preferred — explicit mode tracking)
		const session = await sessionService.findByExternal(
			providerId,
			result.conversation_id,
			result.thread_id,
		)

		let taskId: string | undefined

		if (session?.mode === 'task_thread' && session.task_id) {
			taskId = session.task_id
		}

		// 2. Fall back to conversation binding (backward compat)
		if (!taskId) {
			const binding = await conversationBindingService.findByExternal(
				providerId,
				result.conversation_id,
				result.thread_id,
			)
			if (binding?.task_id) {
				taskId = binding.task_id
			}
		}

		if (!taskId) {
			return c.json(
				{
					error: 'unbound_conversation',
					provider_id: providerId,
					conversation_id: result.conversation_id,
					thread_id: result.thread_id,
				},
				422,
			)
		}

		// Dispatch through workflow engine
		const actor = `provider:${providerId}`

		switch (result.action) {
			case 'task.reply': {
				const replyResult = await workflowEngine.reply(taskId, result.message, actor)
				if (!replyResult) {
					return c.json({ error: 'Task not found or not on a human_approval step' }, 400)
				}
				return c.json(
					{ action: 'task.replied', task: replyResult.task, runId: replyResult.runId },
					200,
				)
			}

			case 'task.approve': {
				const approveResult = await workflowEngine.approve(taskId, actor)
				if (!approveResult) {
					return c.json({ error: 'Task not found or not on a human_approval step' }, 400)
				}
				return c.json({ action: 'task.approved', task: approveResult.task }, 200)
			}

			case 'task.reject': {
				const rejectResult = await workflowEngine.reject(
					taskId,
					result.message ?? 'Rejected via conversation',
					actor,
				)
				if (!rejectResult) {
					return c.json({ error: 'Task not found or not on a human_approval step' }, 400)
				}
				return c.json({ action: 'task.rejected', task: rejectResult.task }, 200)
			}
		}
	})

export { conversations }
