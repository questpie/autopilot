import { query, tool as sdkTool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import type { AgentProvider, AgentSpawnOptions, AgentSessionResult, AgentEvent } from '../provider'
import type { ToolDefinition } from '../tools'

/**
 * Claude Agent SDK provider — uses @anthropic-ai/claude-agent-sdk.
 * Works with Claude Max subscription (no API key needed).
 * Provides built-in file tools (Read, Write, Edit, Glob, Grep, Bash).
 */
export class ClaudeAgentSDKProvider implements AgentProvider {
	readonly name = 'claude-agent-sdk'

	async spawn(
		options: AgentSpawnOptions,
		onEvent: (event: AgentEvent) => void,
	): Promise<AgentSessionResult> {
		const { systemPrompt, prompt, model, tools, toolContext, maxTurns = 50 } = options

		// Convert our tool definitions to Agent SDK MCP tools
		const mcpTools = tools.map((t) =>
			sdkTool(
				t.name,
				t.description,
				convertZodSchema(t.schema),
				async (args: Record<string, unknown>) => {
					const result = await t.execute(t.schema.parse(args), toolContext)
					return {
						content: result.content.map((c) => ({
							type: 'text' as const,
							text: c.text,
						})),
					}
				},
			),
		)

		const autopilotMcp = createSdkMcpServer({
			name: 'autopilot',
			tools: mcpTools,
		})

		let toolCalls = 0
		let result: string | undefined
		let error: string | undefined

		try {
			for await (const message of query({
				prompt,
				options: {
					systemPrompt,
					cwd: toolContext.companyRoot,
					allowedTools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash'],
					mcpServers: { autopilot: autopilotMcp },
					permissionMode: 'bypassPermissions',
					allowDangerouslySkipPermissions: true,
					maxTurns,
					model,
					hooks: {
						PostToolUse: [{
							matcher: '.*',
							hooks: [async (input: unknown) => {
								toolCalls++
								const toolName = (input as Record<string, unknown>)?.tool_name as string ?? 'unknown'
								onEvent({ type: 'tool_call', tool: toolName })
								return {}
							}],
						}],
					},
				},
			})) {
				if ('result' in message) {
					result = (message as { result: string }).result
					onEvent({ type: 'text', content: result })
				}
			}
		} catch (err) {
			error = err instanceof Error ? err.message : String(err)
			onEvent({ type: 'error', content: error })
		}

		return { result, toolCalls, error }
	}
}

/**
 * Convert Zod schema to the format expected by Agent SDK's tool() function.
 * Agent SDK expects a plain object of Zod fields, not a ZodObject.
 */
function convertZodSchema(schema: z.ZodType): Record<string, z.ZodType> {
	if (schema instanceof z.ZodObject) {
		return schema.shape as Record<string, z.ZodType>
	}
	// Fallback — wrap in a single 'input' field
	return { input: schema }
}
