import type { Agent, Task } from '@questpie/autopilot-spec'
import type { ToolDefinition, ToolContext } from './tools'

/**
 * Agent event emitted during a session.
 * Provider-agnostic — same interface for Claude, OpenAI, Gemini, etc.
 */
export interface AgentEvent {
	type: 'text' | 'tool_call' | 'tool_result' | 'error' | 'status'
	content?: string
	tool?: string
	toolCallId?: string
	params?: Record<string, unknown>
}

/**
 * Options for spawning an agent session.
 */
export interface AgentSpawnOptions {
	systemPrompt: string
	prompt: string
	model: string
	tools: ToolDefinition[]
	toolContext: ToolContext
	maxTurns?: number
}

/**
 * Result of a completed agent session.
 */
export interface AgentSessionResult {
	result?: string
	toolCalls: number
	error?: string
}

/**
 * Provider interface for AI agent backends.
 * Implement this to add support for new LLM providers.
 *
 * Current implementations:
 * - AnthropicProvider (uses @anthropic-ai/sdk)
 *
 * Future:
 * - OpenAIProvider (uses openai SDK)
 * - GoogleProvider (uses @google/generative-ai)
 * - ClaudeAgentSDKProvider (uses @anthropic-ai/claude-agent-sdk)
 */
export interface AgentProvider {
	readonly name: string

	spawn(
		options: AgentSpawnOptions,
		onEvent: (event: AgentEvent) => void,
	): Promise<AgentSessionResult>
}
