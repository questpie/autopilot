import { chat, maxIterations } from '@tanstack/ai'
import { openRouterText } from '@tanstack/ai-openrouter'
import type { ChatMiddleware, AfterToolCallInfo, ChatMiddlewareContext } from '@tanstack/ai'
import type { Tool as TanStackTool, JSONSchema } from '@tanstack/ai'
import type { AgentProvider, AgentSpawnOptions, AgentSessionResult, AgentEvent } from '../provider'
import { executeTool } from '../tools'
import { zodToJsonSchema } from '../utils/zod-to-json'

/**
 * TanStack AI provider — uses @tanstack/ai with OpenRouter as the backend.
 *
 * Supports any model available on OpenRouter (Anthropic, OpenAI, Google, etc.)
 * using the `provider/model` naming convention (e.g. `anthropic/claude-sonnet-4-20250514`).
 *
 * Requires `OPENROUTER_API_KEY` env var.
 */
export class TanStackAIProvider implements AgentProvider {
	readonly name = 'tanstack-ai'

	async spawn(
		options: AgentSpawnOptions,
		onEvent: (event: AgentEvent) => void,
	): Promise<AgentSessionResult> {
		const { systemPrompt, prompt, tools, toolContext, maxTurns = 50 } = options
		// Append :online suffix for web search enabled agents
		const model = options.webSearch && !options.model.includes(':online')
			? `${options.model}:online`
			: options.model

		let toolCalls = 0
		let error: string | undefined

		// Convert our ToolDefinition[] to TanStack AI Tool[] format
		const tanstackTools: TanStackTool[] = tools.map((t) => ({
			name: t.name,
			description: t.description,
			inputSchema: zodToJsonSchema(t.schema) as JSONSchema,
			execute: async (args: unknown) => {
				const result = await executeTool(tools, t.name, args, toolContext)
				return result.content.map((c) => c.text).join('\n')
			},
		}))

		// Middleware to bridge TanStack AI events to our AgentEvent interface
		const bridgeMiddleware: ChatMiddleware = {
			name: 'autopilot-bridge',

			onChunk(ctx, chunk) {
				if (chunk.type === 'TEXT_MESSAGE_CONTENT' && 'delta' in chunk) {
					onEvent({
						type: 'text',
						content: (chunk as { delta: string }).delta,
					})
				}
			},

			onBeforeToolCall(_ctx: ChatMiddlewareContext, hookCtx) {
				onEvent({
					type: 'tool_call',
					tool: hookCtx.toolName,
					toolCallId: hookCtx.toolCallId,
					params: hookCtx.args as Record<string, unknown>,
				})
			},

			onAfterToolCall(_ctx: ChatMiddlewareContext, info: AfterToolCallInfo) {
				toolCalls++
				onEvent({
					type: 'tool_result',
					tool: info.toolName,
					toolCallId: info.toolCallId,
					content: info.ok
						? typeof info.result === 'string'
							? info.result
							: JSON.stringify(info.result)
						: String(info.error),
				})
			},

			onError(_ctx: ChatMiddlewareContext, errorInfo) {
				onEvent({
					type: 'error',
					content: errorInfo.error instanceof Error
						? errorInfo.error.message
						: String(errorInfo.error),
				})
			},
		}

		try {
			const adapter = openRouterText(model as Parameters<typeof openRouterText>[0], {
				httpReferer: 'https://questpie.com',
				xTitle: 'QuestPie Autopilot',
			})

			const result = await (chat({
				adapter,
				systemPrompts: [systemPrompt],
				messages: [{ role: 'user', content: prompt }],
				tools: tanstackTools,
				agentLoopStrategy: maxIterations(maxTurns),
				stream: false,
				middleware: [bridgeMiddleware],
			}) as Promise<string>)

			return { result, toolCalls, error }
		} catch (err) {
			error = err instanceof Error ? err.message : String(err)
			onEvent({ type: 'error', content: error })
			return { result: undefined, toolCalls, error }
		}
	}
}
