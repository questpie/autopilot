import { relative, resolve } from 'node:path'
import type { AgentProvider, AgentSpawnOptions, AgentSessionResult, AgentEvent } from '../provider'
import type { ToolDefinition } from '../tools'
import { executeTool } from '../tools'
import { isDeniedPath } from '../../auth/deny-patterns'
import { checkScope } from '../../auth/permissions'
import type { Actor } from '../../auth/types'

/**
 * Codex built-in tool names that perform file writes / edits.
 * These require fs_scope write enforcement.
 */
const CODEX_WRITE_TOOLS = new Set([
	'write_file',
	'apply_patch',
	'create_file',
	'delete_file',
	'rename_file',
])

/**
 * Codex built-in tool names that perform file reads.
 * These require deny-pattern enforcement only (no scope needed for reads by default).
 */
const CODEX_READ_TOOLS = new Set([
	'read_file',
	'list_files',
	'glob',
	'grep',
])

/**
 * Validate a Codex built-in tool call against security policies.
 * Returns a block reason string if the call should be denied, or null if allowed.
 */
function validateCodexToolCall(
	toolName: string,
	args: Record<string, unknown>,
	companyRoot: string,
	agentActor: Actor,
): string | null {
	// Extract file path from common Codex argument shapes
	const filePath = (args.path ?? args.file_path ?? args.filename ?? args.file) as string | undefined
	if (!filePath) return null

	const rel = relative(resolve(companyRoot), resolve(filePath))

	if (CODEX_WRITE_TOOLS.has(toolName)) {
		if (rel.startsWith('..')) return 'Path outside company root'
		if (isDeniedPath(rel)) return `Access denied: ${rel}`
		if (!checkScope(agentActor, 'fs_write', rel)) return `Write not allowed by agent scope: ${rel}`
	} else if (CODEX_READ_TOOLS.has(toolName)) {
		if (!rel.startsWith('..') && isDeniedPath(rel)) return `Access denied: ${rel}`
	}

	return null
}

/**
 * OpenAI Codex SDK provider — uses @openai/codex-sdk.
 * Wraps the Codex CLI via the TypeScript SDK for GPT models.
 * Requires `OPENAI_API_KEY` env var or agent-level config.
 *
 * Codex SDK provides built-in workspace tools (bash, file edits)
 * similar to Claude Agent SDK — our custom autopilot tools are
 * injected via the system prompt as function-call descriptions
 * and executed in the agentic loop.
 */
export class CodexSDKProvider implements AgentProvider {
	readonly name = 'codex-sdk'

	async spawn(
		options: AgentSpawnOptions,
		onEvent: (event: AgentEvent) => void,
	): Promise<AgentSessionResult> {
		const { systemPrompt, prompt, model, tools, toolContext, maxTurns = 50 } = options

		// Build agent actor for scope checking (mirrors claude-agent-sdk.ts)
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
			// Dynamic import to avoid hard dependency when Codex SDK is not installed
			const { Codex } = await import('@openai/codex-sdk')

			const codex = new Codex({
				config: {
					model,
					// Inject system instructions via config
					instructions: systemPrompt,
				},
			})

			const thread = codex.startThread({
				workingDirectory: toolContext.companyRoot,
				skipGitRepoCheck: true,
			})

			// Build tool descriptions for the system prompt so Codex knows about our tools
			const toolDescriptions = tools
				.map((t) => `- ${t.name}: ${t.description}`)
				.join('\n')

			const fullPrompt = tools.length > 0
				? `${prompt}\n\nAvailable autopilot tools:\n${toolDescriptions}`
				: prompt

			const { events } = await thread.runStreamed(fullPrompt)

			for await (const event of events) {
				switch (event.type) {
					case 'item.completed': {
						const item = event.item as Record<string, unknown> | undefined
						if (!item) break

						// Handle text responses
						if (item.type === 'message' || item.type === 'text') {
							const text = (item.content ?? item.text ?? '') as string
							if (text) {
								result = text
								onEvent({ type: 'text', content: text })
							}
						}

						// Handle tool calls from Codex
						if (item.type === 'tool_call' || item.type === 'function_call') {
							toolCalls++
							const toolName = (item.name ?? item.tool ?? 'unknown') as string
							onEvent({
								type: 'tool_call',
								tool: toolName,
								toolCallId: item.id as string | undefined,
								params: item.arguments as Record<string, unknown> | undefined,
							})

							// Security: validate built-in Codex file tool calls before execution
							const args = typeof item.arguments === 'string'
								? JSON.parse(item.arguments as string)
								: (item.arguments as Record<string, unknown> | undefined) ?? {}
							const blockReason = validateCodexToolCall(
								toolName,
								args,
								toolContext.companyRoot,
								agentActor,
							)
							if (blockReason) {
								onEvent({
									type: 'tool_result',
									tool: toolName,
									toolCallId: item.id as string | undefined,
									content: `BLOCKED: ${blockReason}`,
								})
								break
							}

							// Execute our custom tools if the call matches
							const matchedTool = tools.find((t) => t.name === toolName)
							if (matchedTool) {
								try {
									const toolResult = await executeTool(tools, toolName, args, toolContext)
									onEvent({
										type: 'tool_result',
										tool: toolName,
										toolCallId: item.id as string | undefined,
										content: toolResult.content[0]?.text,
									})
								} catch (toolErr) {
									const msg = toolErr instanceof Error ? toolErr.message : String(toolErr)
									onEvent({ type: 'error', content: `Tool error (${toolName}): ${msg}` })
								}
							}
						}
						break
					}

					case 'turn.completed': {
						onEvent({ type: 'status', content: 'turn_completed' })
						break
					}

					case 'turn.failed': {
						const failEvent = event as Record<string, unknown>
						const failMsg = (failEvent.error ?? 'Turn failed') as string
						error = typeof failMsg === 'string' ? failMsg : JSON.stringify(failMsg)
						onEvent({ type: 'error', content: error })
						break
					}
				}

				// Safety: respect maxTurns
				if (toolCalls >= maxTurns) break
			}
		} catch (err) {
			// Handle missing SDK gracefully
			if (
				err instanceof Error &&
				(err.message.includes('Cannot find module') || err.message.includes('MODULE_NOT_FOUND'))
			) {
				error = 'Codex SDK (@openai/codex-sdk) is not installed. Run: bun add @openai/codex-sdk'
				onEvent({ type: 'error', content: error })
			} else {
				error = err instanceof Error ? err.message : String(err)
				onEvent({ type: 'error', content: error })
			}
		}

		return { result, toolCalls, error }
	}
}
