import { Hono } from 'hono'
import { describeRoute } from 'hono-openapi'
import { resolver, validator as zValidator } from 'hono-openapi'
import { z } from 'zod'
import { ChatRequestSchema } from '@questpie/autopilot-spec'
import { loadAgents, loadCompany } from '../../fs/company'
import { routeMessage } from '../../router'
import { spawnAgent } from '../../agent/spawner'
import { container } from '../../container'
import { storageFactory } from '../../fs/sqlite-backend'
import { streamManagerFactory } from '../../session/stream'
import type { AppEnv } from '../app'

const ChatResponseSchema = z.object({
	agent: z.object({ id: z.string() }).passthrough(),
	reason: z.string(),
})

const ChatErrorResponseSchema = z.object({
	routed_to: z.null(),
	reason: z.string(),
})

const chat = new Hono<AppEnv>()
	// ── POST /chat — Route a message to the most relevant agent ──────────
	.post(
		'/',
		describeRoute({
			tags: ['chat'],
			description: 'Route a message to the most relevant agent',
			responses: {
				200: {
					description: 'Routing result with target agent and reason',
					content: {
						'application/json': {
							schema: resolver(z.union([ChatResponseSchema, ChatErrorResponseSchema])),
						},
					},
				},
			},
		}),
		zValidator('json', ChatRequestSchema),
		async (c) => {
			const root = c.get('companyRoot')
			const { message } = c.req.valid('json')

			try {
				const agentsList = await loadAgents(root)
				const result = await routeMessage(message, agentsList, root)
				return c.json(result)
			} catch (err) {
				return c.json({
					routed_to: null,
					reason: err instanceof Error ? err.message : 'routing failed',
				})
			}
		},
	)
	// ── POST /chat/:agentId — D11: Streaming chat endpoint ──────────────
	.post(
		'/:agentId',
		describeRoute({
			tags: ['chat'],
			description: 'Start a streaming chat session with an agent. Returns SSE stream of text_delta, tool_call, tool_result, and text events.',
			responses: {
				200: { description: 'SSE stream of chat events' },
				404: { description: 'Agent not found' },
			},
		}),
		zValidator('json', z.object({
			message: z.string().min(1, 'Message is required'),
		})),
		async (c) => {
			const root = c.get('companyRoot')
			const agentId = c.req.param('agentId')
			const { message } = c.req.valid('json')
			const actor = c.get('actor')
			const userId = actor?.id ?? 'anonymous'

			// 1. Load agent
			const agents = await loadAgents(root)
			const agent = agents.find((a) => a.id === agentId)
			if (!agent) {
				return c.json({ error: `Agent not found: ${agentId}` }, 404)
			}

			// 2. Get or create DM channel
			const { storage } = await container.resolveAsync([storageFactory])
			const channel = await storage.getOrCreateDirectChannel(userId, agentId)

			// 3. Save user message to channel
			await storage.sendMessage({
				id: `msg-${Date.now().toString(36)}-${userId}`,
				channel: channel.id,
				from: userId,
				content: message,
				at: new Date().toISOString(),
			})

			// 4. Spawn agent in chat mode
			const company = await loadCompany(root)
			const spawnPromise = spawnAgent({
				agent,
				company,
				allAgents: agents,
				storage,
				trigger: { type: 'chat' },
				message,
				mode: 'chat',
				channelId: channel.id,
			})

			// 5. Set up SSE stream piped from session stream
			const { readable, writable } = new TransformStream()
			const writer = writable.getWriter()
			const encoder = new TextEncoder()

			function send(event: string, data: string): void {
				writer.write(encoder.encode(`event: ${event}\ndata: ${data}\n\n`)).catch(() => {})
			}

			// We need the sessionId from the spawn — it's generated inside spawnAgent.
			// Subscribe to the stream manager to find it. The sessionId follows a pattern.
			const { streamManager } = container.resolve([streamManagerFactory])

			// Find active stream for this agent (just created by spawnAgent)
			// Small delay to let the stream be created
			const pollForSession = async () => {
				for (let i = 0; i < 20; i++) {
					const streams = streamManager.getActiveStreams()
					const match = streams.find((s) => s.agentId === agentId)
					if (match) return match.sessionId
					await new Promise((r) => setTimeout(r, 50))
				}
				return null
			}

			const sessionId = await pollForSession()

			if (sessionId) {
				send('session', JSON.stringify({ sessionId, channelId: channel.id }))

				const unsubscribe = streamManager.subscribe(sessionId, (chunk) => {
					send('chunk', JSON.stringify(chunk))
				})

				// Wait for spawn to complete, then close SSE
				spawnPromise
					.then((result) => {
						send('done', JSON.stringify({ sessionId: result.sessionId, toolCalls: result.toolCalls }))
					})
					.catch((err) => {
						send('error', JSON.stringify({ error: err instanceof Error ? err.message : String(err) }))
					})
					.finally(() => {
						unsubscribe()
						writer.close().catch(() => {})
					})
			} else {
				// Couldn't find the session stream — fall back to waiting for completion
				spawnPromise
					.then((result) => {
						send('done', JSON.stringify({ sessionId: result.sessionId, result: result.result, toolCalls: result.toolCalls }))
					})
					.catch((err) => {
						send('error', JSON.stringify({ error: err instanceof Error ? err.message : String(err) }))
					})
					.finally(() => {
						writer.close().catch(() => {})
					})
			}

			// Clean up on client disconnect
			c.req.raw.signal.addEventListener('abort', () => {
				writer.close().catch(() => {})
			})

			return new Response(readable, {
				headers: {
					'Content-Type': 'text/event-stream',
					'Cache-Control': 'no-cache',
					'Connection': 'keep-alive',
				},
			})
		},
	)

export { chat }
