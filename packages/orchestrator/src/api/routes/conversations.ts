/**
 * Conversation binding routes.
 *
 * POST /api/conversations/bindings — create a binding (user auth)
 * POST /api/conversations/:providerId — inbound conversation payload (provider-secret auth)
 *
 * The inbound route:
 * 1. Validates provider is a conversation_channel with conversation.ingest
 * 2. Authenticates via X-Provider-Secret against provider's secret refs
 * 3. Invokes handler with conversation.ingest op
 * 4. Validates normalized ConversationResult
 * 5. Looks up binding by provider + external conversation/thread IDs
 * 6. Dispatches through existing workflow engine primitives
 */
import { randomBytes } from 'node:crypto'
import { Hono } from 'hono'
import { validator as zValidator } from 'hono-openapi'
import { z } from 'zod'
import { ConversationResultSchema } from '@questpie/autopilot-spec'
import type { AppEnv } from '../app'
import { invokeProvider, resolveSecrets } from '../../providers/handler-runtime'

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
			let binding
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
	.post(
		'/:providerId',
		zValidator('param', z.object({ providerId: z.string() })),
		async (c) => {
			const { workflowEngine, conversationBindingService } = c.get('services')
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
				return c.json({ error: `Provider ${providerId} has no auth_secret configured — inbound callbacks require authentication` }, 403)
			}

			// Accept X-Provider-Secret (generic) or X-Telegram-Bot-Api-Secret-Token (Telegram webhook)
			const providerSecret = c.req.header('x-provider-secret')
				?? c.req.header('x-telegram-bot-api-secret-token')
			if (!providerSecret) {
				return c.json({ error: 'Provider secret header required (X-Provider-Secret or X-Telegram-Bot-Api-Secret-Token)' }, 401)
			}
			const resolved = await resolveSecrets([authSecretRef])
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
			const handlerResult = await invokeProvider(
				provider,
				'conversation.ingest',
				payload as Record<string, unknown>,
				{ companyRoot },
			)

			if (!handlerResult.ok) {
				return c.json({ error: `Handler failed: ${handlerResult.error}` }, 502)
			}

			// Parse normalized conversation result
			const parsed = ConversationResultSchema.safeParse(handlerResult.metadata)
			if (!parsed.success) {
				return c.json({
					error: 'Handler returned invalid conversation result',
					details: parsed.error.message.slice(0, 300),
				}, 502)
			}

			const result = parsed.data

			if (result.action === 'noop') {
				return c.json({ action: 'noop', reason: result.reason }, 200)
			}

			// Look up binding
			const binding = await conversationBindingService.findByExternal(
				providerId,
				result.conversation_id,
				result.thread_id,
			)

			if (!binding) {
				return c.json({
					error: 'unbound_conversation',
					provider_id: providerId,
					conversation_id: result.conversation_id,
					thread_id: result.thread_id,
				}, 422)
			}

			if (!binding.task_id) {
				return c.json({ error: 'Binding has no task_id' }, 422)
			}

			// Dispatch through workflow engine
			const actor = `provider:${providerId}`

			switch (result.action) {
				case 'task.reply': {
					const replyResult = await workflowEngine.reply(binding.task_id, result.message, actor)
					if (!replyResult) {
						return c.json({ error: 'Task not found or not on a human_approval step' }, 400)
					}
					return c.json({ action: 'task.replied', task: replyResult.task, runId: replyResult.runId }, 200)
				}

				case 'task.approve': {
					const approveResult = await workflowEngine.approve(binding.task_id, actor)
					if (!approveResult) {
						return c.json({ error: 'Task not found or not on a human_approval step' }, 400)
					}
					return c.json({ action: 'task.approved', task: approveResult.task }, 200)
				}

				case 'task.reject': {
					const rejectResult = await workflowEngine.reject(
						binding.task_id,
						result.message ?? 'Rejected via conversation',
						actor,
					)
					if (!rejectResult) {
						return c.json({ error: 'Task not found or not on a human_approval step' }, 400)
					}
					return c.json({ action: 'task.rejected', task: rejectResult.task }, 200)
				}
			}
		},
	)

export { conversations }
