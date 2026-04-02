import type { ToolContext, ToolDefinition } from './tools'

/**
 * Agent event emitted during a session.
 * Provider-agnostic — same interface for Claude, OpenAI, Gemini, etc.
 */
export interface AgentEvent {
	type: 'text' | 'text_delta' | 'thinking' | 'tool_call' | 'tool_result' | 'error' | 'status'
	content?: string
	tool?: string
	toolCallId?: string
	params?: Record<string, unknown>
	errorCode?: 'rate_limit' | 'auth' | 'network' | 'provider' | 'budget' | 'unknown'
}

export interface AgentChatMessage {
	role: 'user' | 'assistant'
	content: string
}

/**
 * Options for spawning an agent session.
 */
export interface AgentSpawnOptions {
	systemPrompt: string
	prompt?: string
	messages?: AgentChatMessage[]
	model: string
	tools: ToolDefinition[]
	toolContext: ToolContext
	maxTurns?: number
	/** Agent tool groups from team/agents/*.yaml (e.g. ['fs', 'terminal']) */
	agentTools?: string[]
	/** Agent filesystem scope for PreToolUse enforcement */
	agentScope?: { fsRead?: string[]; fsWrite?: string[]; secrets?: string[] }
	/** Enable OpenRouter :online web search for this agent */
	webSearch?: boolean
	/** Session ID for provider-side tracking (e.g. OpenRouter activity dashboard). */
	sessionId?: string
	/** Agent ID for trace metadata. */
	agentId?: string
	/** Per-session token budget. Provider aborts when cumulative usage exceeds this. Default: 200 000 */
	maxSessionTokens?: number
}

/**
 * Result of a completed agent session.
 */
export interface AgentSessionResult {
	result?: string
	toolCalls: number
	error?: string
	/** Cumulative token usage across all iterations */
	usage?: {
		promptTokens: number
		completionTokens: number
		totalTokens: number
	}
}

/**
 * Provider interface for AI agent backends.
 *
 * Implement this to add support for new LLM providers.
 *
 * Built-in implementations:
 * - {@link OpenRouterAIProvider} (default, uses `@tanstack/ai` + OpenRouter)
 */
export interface AgentProvider {
	readonly name: string

	spawn(
		options: AgentSpawnOptions,
		onEvent: (event: AgentEvent) => void,
	): Promise<AgentSessionResult>
}
