import { query, tool as sdkTool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk'
import { relative, resolve } from 'node:path'
import { z } from 'zod'
import type { AgentProvider, AgentSpawnOptions, AgentSessionResult, AgentEvent } from '../provider'
import { isDeniedPath } from '../../auth/deny-patterns'
import { checkScope } from '../../auth/permissions'
import type { Actor } from '../../auth/types'

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

		// Resolve per-agent tools from agent.tools config
		// `tools` = base set available to the model
		// `allowedTools` = auto-approved (no permission prompt)
		const agentToolGroups: string[] = options.agentTools ?? ['fs', 'terminal']
		const resolvedTools = resolveAllowedTools(agentToolGroups)

		// Build agent actor for scope checking
		const agentActor: Actor = {
			id: toolContext.agentId,
			type: 'agent',
			name: toolContext.agentId,
			role: 'agent',
			permissions: {},
			scope: options.agentScope,
			source: 'internal',
		}

		let toolCalls = 0
		let result: string | undefined
		let error: string | undefined

		try {
			for await (const message of query({
				prompt,
				options: {
					systemPrompt,
					cwd: toolContext.companyRoot,
					tools: resolvedTools,
					allowedTools: resolvedTools,
					mcpServers: { autopilot: autopilotMcp },
					permissionMode: 'bypassPermissions',
					allowDangerouslySkipPermissions: true,
					maxTurns,
					model,
					hooks: {
						PreToolUse: [{
							matcher: 'Write|Edit',
							hooks: [async (input: unknown) => {
								const data = input as { tool_input?: Record<string, unknown> }
								const filePath = (data.tool_input?.file_path ?? data.tool_input?.path) as string | undefined
								if (filePath) {
									const rel = relative(resolve(toolContext.companyRoot), resolve(filePath))
									if (rel.startsWith('..')) return { decision: 'block', reason: 'Path outside company root' }
									if (isDeniedPath(rel)) return { decision: 'block', reason: `Access denied: ${rel}` }
									if (!checkScope(agentActor, 'fs_write', rel)) {
										return { decision: 'block', reason: `Write not allowed by agent scope: ${rel}` }
									}
								}
								return {}
							}],
						}, {
							matcher: 'Read',
							hooks: [async (input: unknown) => {
								const data = input as { tool_input?: Record<string, unknown> }
								const filePath = data.tool_input?.file_path as string | undefined
								if (filePath) {
									const rel = relative(resolve(toolContext.companyRoot), resolve(filePath))
									if (!rel.startsWith('..') && isDeniedPath(rel)) {
										return { decision: 'block', reason: `Access denied: ${rel}` }
									}
								}
								return {}
							}],
						}],
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
 * Map agent tool groups from agents.yaml to Claude SDK allowed tools.
 *
 * Agent tool groups:
 *   'fs'       → Read, Glob, Grep (read-only filesystem)
 *   'fs_write' → Read, Write, Edit, Glob, Grep (read/write filesystem)
 *   'terminal' → Bash
 *
 * Default: ['fs', 'terminal'] gives Read, Glob, Grep, Bash.
 * Developer agent with ['fs_write', 'terminal'] gets full access.
 */
function resolveAllowedTools(agentToolGroups: string[]): string[] {
	const tools = new Set<string>()

	for (const group of agentToolGroups) {
		switch (group) {
			case 'fs':
				tools.add('Read')
				tools.add('Glob')
				tools.add('Grep')
				break
			case 'fs_write':
				tools.add('Read')
				tools.add('Write')
				tools.add('Edit')
				tools.add('Glob')
				tools.add('Grep')
				break
			case 'terminal':
				tools.add('Bash')
				break
		}
	}

	return [...tools]
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
