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
import type { SessionMessageRow } from '../../services/session-messages'

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
		const { workflowEngine, conversationBindingService, sessionService, sessionMessageService, queryService, runService, taskService } = c.get('services')
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

			const initiator = `provider:${providerId}`

			// ── Store user message unconditionally (before any routing) ───
			const userMsgMetadata: Record<string, unknown> = {}
			if (result.sender_id) userMsgMetadata.sender_id = result.sender_id
			if (result.sender_name) userMsgMetadata.sender_name = result.sender_name
			const userMsg = await sessionMessageService.create({
				session_id: session.id,
				role: 'user',
				content: result.message,
				metadata: Object.keys(userMsgMetadata).length > 0 ? JSON.stringify(userMsgMetadata) : undefined,
			})

			// ── Detect /reset, /new, /clear ──────────────────────────────
			const trimmed = result.message.trim().toLowerCase()
			if (trimmed === '/reset' || trimmed === '/new' || trimmed === '/clear') {
				await sessionService.updateResumeState(session.id, null, null)
				await sessionMessageService.clearForSession(session.id)
				// Close old session so bridge ignores completions from pre-reset queries
				await sessionService.close(session.id)

				// Send visible chat confirmation via notify.send
				if (provider.capabilities.some((cap) => cap.op === 'notify.send')) {
					invokeProvider(
						provider,
						'notify.send',
						{
							event_type: 'session_reset',
							severity: 'info',
							title: '',
							summary: 'Session reset. New messages will start a fresh agent session.',
							conversation_id: result.conversation_id,
							thread_id: result.thread_id,
						},
						{ companyRoot },
						secretService,
					).catch((err) => {
						console.warn(`[conversations] reset confirmation send failed:`, err instanceof Error ? err.message : String(err))
					})
				}

				return c.json({ action: 'session.reset', session_id: session.id }, 200)
			}

			// ── Detect /read prefix → read-only query mode ──────────────
			let queryPrompt = result.message
			let allowMutation = true
			const readMatch = result.message.match(/^\/(read|readonly)(?:\s+([\s\S]+))?$/i)
			if (readMatch) {
				const readContent = readMatch[2]?.trim()
				if (readContent) {
					queryPrompt = readContent
					allowMutation = false
				} else {
					// /read with no content — send helpful message
					if (provider.capabilities.some((cap) => cap.op === 'notify.send')) {
						invokeProvider(
							provider,
							'notify.send',
							{
								event_type: 'command_help',
								severity: 'info',
								title: '',
								summary: 'Usage: /read <prompt> — runs a read-only query that cannot modify files.',
								conversation_id: result.conversation_id,
								thread_id: result.thread_id,
							},
							{ companyRoot },
							secretService,
						).catch((err) => {
							console.warn(`[conversations] /read help send failed:`, err instanceof Error ? err.message : String(err))
						})
					}
					return c.json({ action: 'command.help', command: 'read' }, 200)
				}
			}

			// ── Check if session has an active query/run → queue instead of dispatching
			const activeQuery = await queryService.findActiveForSession(session.id)
			if (activeQuery && activeQuery.run_id) {
				const activeRun = await runService.get(activeQuery.run_id)
				if (activeRun && (activeRun.status === 'pending' || activeRun.status === 'claimed' || activeRun.status === 'running')) {
					return c.json({ action: 'queued', session_id: session.id }, 200)
				}
			}

			// ── Build query prompt ───────────────────────────────────────
			const hasResume = !!session.runtime_session_ref

			// ── Offline worker policy: clear stale resume state ─────
			let effectiveResume = hasResume
			if (hasResume && session.preferred_worker_id) {
				const { workerService } = c.get('services')
				const worker = await workerService.get(session.preferred_worker_id)
				if (workerService.isUnavailable(worker, 90_000)) {
					console.warn(`[conversations] preferred worker ${session.preferred_worker_id} is unavailable — cold-starting session ${session.id}`)
					await sessionService.updateResumeState(session.id, null, null)
					effectiveResume = false
				}
			}

			let instructionMessages: SessionMessageRow[] = []

			if (effectiveResume) {
				// Resume mode: system notifications since the last completed query in this session
				const lastCompletedQuery = await queryService.findLastCompletedForSession(session.id)
				const since = lastCompletedQuery?.created_at ?? session.created_at
				instructionMessages = await sessionMessageService.listSystemSince(session.id, since)
			} else {
				// Cold start: recent history (excluding the message we just stored — it goes as the prompt)
				const recent = await sessionMessageService.listRecent(session.id)
				instructionMessages = recent.filter(m => m.id !== userMsg.id)
			}

			const instructions = buildQueryInstructions(queryPrompt, {
				sessionMessages: instructionMessages,
				allowMutation,
				hasResume: effectiveResume,
			})

			// ── Create query with session_id ─────────────────────────────
			const query = await queryService.create({
				prompt: queryPrompt,
				agent_id: agentId,
				allow_repo_mutation: allowMutation,
				session_id: session.id,
				created_by: initiator,
			})

			// ── Create run with resume state ─────────────────────────────
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
				runtime_session_ref: effectiveResume ? (session.runtime_session_ref ?? undefined) : undefined,
				preferred_worker_id: effectiveResume ? (session.preferred_worker_id ?? undefined) : undefined,
			})

			await queryService.linkRun(query.id, runId)

			// ── Mark user message consumed (after dispatch is complete) ──
			await sessionMessageService.markConsumed([userMsg.id], query.id)

			return c.json({
				action: 'query.dispatched',
				session_id: session.id,
				query_id: query.id,
				run_id: runId,
			}, 200)
		}

		// ── Conversation command routing ─────────────────────────────────
		if (result.action === 'conversation.command') {
			const commandConfig = authoredConfig.company.conversation_commands?.[result.command]
			if (!commandConfig) {
				return c.json({
					action: 'unknown_command',
					command: result.command,
					available: Object.keys(authoredConfig.company.conversation_commands ?? {}),
				}, 200)
			}

			if (commandConfig.action === 'task.create') {
				const actor = `provider:${providerId}`

				// Idempotency for provider retries: handlers should pass a stable
				// thread_id for command messages (Telegram uses message_id).
				if (result.thread_id) {
					const existingBinding = await conversationBindingService.findExact(
						providerId,
						result.conversation_id,
						result.thread_id,
					)
					if (existingBinding?.task_id) {
						const existingTask = await taskService.get(existingBinding.task_id)
						return c.json({
							action: 'task.created',
							task_id: existingBinding.task_id,
							workflow_id: existingTask?.workflow_id ?? undefined,
							command: result.command,
							existing: true,
						}, 200)
					}
				}

				// Render templates
				const templateCtx: Record<string, string> = {
					args: result.args,
					command: result.command,
					conversation_id: result.conversation_id,
					thread_id: result.thread_id ?? '',
					sender_id: result.sender_id ?? '',
					sender_name: result.sender_name ?? '',
				}

				const title = renderTemplate(commandConfig.title_template ?? '{{args}}', templateCtx)
				const description = renderTemplate(commandConfig.description_template ?? '{{args}}', templateCtx)

				if (!title) {
					return c.json({ action: 'noop', reason: `Usage: /${result.command} <prompt>` }, 200)
				}

				const materialized = await workflowEngine.materializeTask({
					title,
					type: commandConfig.type ?? 'task',
					description,
					workflow_id: commandConfig.workflow_id,
					created_by: actor,
					metadata: commandConfig.capability_profiles?.length
						? JSON.stringify({ capability_profiles: commandConfig.capability_profiles })
						: undefined,
				})

				if (!materialized) {
					return c.json({ error: 'Failed to create task' }, 500)
				}

				// If the command config has instructions, update the run
				if (commandConfig.instructions && materialized.runId) {
					const run = await runService.get(materialized.runId)
					if (run) {
						const combinedInstructions = run.instructions
							? `${run.instructions}\n\n${commandConfig.instructions}`
							: commandConfig.instructions
						await runService.updateInstructions(materialized.runId, combinedInstructions)
					}
				}

				// Bind to conversation
				const bindingId = `bind-${Date.now()}-${randomBytes(6).toString('hex')}`
				try {
					await conversationBindingService.create({
						id: bindingId,
						provider_id: providerId,
						external_conversation_id: result.conversation_id,
						external_thread_id: result.thread_id,
						mode: 'task_thread',
						task_id: materialized.task.id,
					})
				} catch (err) {
					// A retry can race with the original request. Return 200 so the
					// provider stops retrying instead of creating more tasks.
					if (err instanceof Error && err.message.includes('already exists') && result.thread_id) {
						const existingBinding = await conversationBindingService.findExact(
							providerId,
							result.conversation_id,
							result.thread_id,
						)
						if (existingBinding?.task_id) {
							const existingTask = await taskService.get(existingBinding.task_id)
							return c.json({
								action: 'task.created',
								task_id: existingBinding.task_id,
								workflow_id: existingTask?.workflow_id ?? undefined,
								command: result.command,
								existing: true,
							}, 200)
						}
					}
					throw err
				}

				return c.json({
					action: 'task.created',
					task_id: materialized.task.id,
					workflow_id: materialized.task.workflow_id ?? undefined,
					command: result.command,
				}, 200)
			}

			// Future: other command actions (query, schedule, etc.)
			return c.json({ error: `Unsupported command action: ${commandConfig.action}` }, 400)
		}

		// ── Task creation routing ─────────────────────────────────────────
		if (result.action === 'task.create') {
			const actor = `provider:${providerId}`
			const { input } = result

			const materialized = await workflowEngine.materializeTask({
				title: input.title,
				type: input.type,
				description: input.description,
				priority: input.priority,
				assigned_to: input.assigned_to,
				workflow_id: input.workflow_id,
				metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
				created_by: actor,
			})

			if (!materialized) {
				return c.json({ error: 'Failed to create task' }, 500)
			}

			// Create conversation binding to tie the chat thread to the new task
			const bindingId = `bind-${Date.now()}-${randomBytes(6).toString('hex')}`
			await conversationBindingService.create({
				id: bindingId,
				provider_id: providerId,
				external_conversation_id: result.conversation_id,
				external_thread_id: result.thread_id,
				mode: 'task_thread',
				task_id: materialized.task.id,
			})

			return c.json(
				{
					action: 'task.created',
					task_id: materialized.task.id,
					workflow_id: materialized.task.workflow_id ?? undefined,
				},
				200,
			)
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

function renderTemplate(template: string, ctx: Record<string, string>): string {
	return template.replace(/\{\{(\w+)\}\}/g, (_, key) => ctx[key] ?? '')
}
