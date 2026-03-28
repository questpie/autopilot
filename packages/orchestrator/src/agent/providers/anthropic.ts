import Anthropic from '@anthropic-ai/sdk'
import type { AgentProvider, AgentSpawnOptions, AgentSessionResult, AgentEvent } from '../provider'
import { executeTool } from '../tools'
import { zodToJsonSchema } from '../utils/zod-to-json'

/**
 * Anthropic provider — uses @anthropic-ai/sdk for Claude models.
 * Implements the agentic loop with tool use.
 */
export class AnthropicProvider implements AgentProvider {
	readonly name = 'anthropic'
	private client: Anthropic

	constructor() {
		this.client = new Anthropic()
	}

	async spawn(
		options: AgentSpawnOptions,
		onEvent: (event: AgentEvent) => void,
	): Promise<AgentSessionResult> {
		const { systemPrompt, prompt, model, tools, toolContext, maxTurns = 50 } = options

		// Convert our tool definitions to Anthropic format
		const anthropicTools = tools.map((t) => ({
			name: t.name,
			description: t.description,
			input_schema: zodToJsonSchema(t.schema),
		}))

		const messages: Anthropic.MessageParam[] = [
			{ role: 'user', content: prompt },
		]

		let toolCalls = 0
		let result: string | undefined
		let error: string | undefined

		try {
			for (let turn = 0; turn < maxTurns; turn++) {
				const response = await this.client.messages.create({
					model,
					max_tokens: 16000,
					system: systemPrompt,
					tools: anthropicTools as Anthropic.Tool[],
					messages,
				})

				const assistantContent: Anthropic.ContentBlock[] = []
				let hasToolUse = false

				for (const block of response.content) {
					assistantContent.push(block)

					if (block.type === 'text') {
						result = block.text
						onEvent({ type: 'text', content: block.text })
					} else if (block.type === 'tool_use') {
						hasToolUse = true
						toolCalls++
						onEvent({
							type: 'tool_call',
							tool: block.name,
							toolCallId: block.id,
							params: block.input as Record<string, unknown>,
						})
					}
				}

				messages.push({ role: 'assistant', content: assistantContent })

				if (!hasToolUse || response.stop_reason === 'end_turn') break

				// Execute tool calls
				const toolResults: Anthropic.ToolResultBlockParam[] = []

				for (const block of response.content) {
					if (block.type !== 'tool_use') continue

					const toolResult = await executeTool(
						tools,
						block.name,
						block.input,
						toolContext,
					)

					onEvent({
						type: 'tool_result',
						tool: block.name,
						toolCallId: block.id,
						content: toolResult.content[0]?.text,
					})

					toolResults.push({
						type: 'tool_result',
						tool_use_id: block.id,
						content: toolResult.content.map((c) => ({
							type: 'text' as const,
							text: c.text,
						})),
						is_error: toolResult.isError,
					})
				}

				messages.push({ role: 'user', content: toolResults })
			}
		} catch (err) {
			error = err instanceof Error ? err.message : String(err)
			onEvent({ type: 'error', content: error })
		}

		return { result, toolCalls, error }
	}
}

