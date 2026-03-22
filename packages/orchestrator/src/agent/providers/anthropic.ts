import Anthropic from '@anthropic-ai/sdk'
import type { AgentProvider, AgentSpawnOptions, AgentSessionResult, AgentEvent } from '../provider'
import { executeTool } from '../tools'

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

// Minimal Zod → JSON Schema converter (same as tools.ts but imported here)
import { z } from 'zod'

function zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
	return zodTypeToJson(schema)
}

function zodTypeToJson(schema: z.ZodType): Record<string, unknown> {
	if (schema instanceof z.ZodOptional) return zodTypeToJson(schema.unwrap())
	if (schema instanceof z.ZodDefault) return zodTypeToJson(schema._def.innerType)
	if (schema instanceof z.ZodString) {
		const r: Record<string, unknown> = { type: 'string' }
		if (schema.description) r.description = schema.description
		return r
	}
	if (schema instanceof z.ZodNumber) {
		const r: Record<string, unknown> = { type: 'number' }
		if (schema.description) r.description = schema.description
		return r
	}
	if (schema instanceof z.ZodEnum) return { type: 'string', enum: schema.options }
	if (schema instanceof z.ZodArray) return { type: 'array', items: zodTypeToJson(schema.element) }
	if (schema instanceof z.ZodObject) {
		const shape = schema.shape as Record<string, z.ZodType>
		const properties: Record<string, unknown> = {}
		const required: string[] = []
		for (const [key, value] of Object.entries(shape)) {
			properties[key] = zodTypeToJson(value)
			if (!(value instanceof z.ZodOptional) && !(value instanceof z.ZodDefault)) required.push(key)
		}
		const r: Record<string, unknown> = { type: 'object', properties }
		if (required.length > 0) r.required = required
		return r
	}
	if (schema instanceof z.ZodRecord) return { type: 'object', additionalProperties: zodTypeToJson(schema.valueSchema) }
	return { type: 'object' }
}
