import type { z } from 'zod'
import type { AgentSpawnOptions, AgentSessionResult, AgentEvent } from '../agent/provider'
import type { EmbeddingInput, EmbeddingTaskType } from '../embeddings/provider'

export type { AgentSpawnOptions, AgentSessionResult, AgentEvent }
export type { EmbeddingInput, EmbeddingTaskType }

/**
 * Unified AI provider interface.
 *
 * ALL LLM operations in Autopilot go through this abstraction.
 * Implementations decide about URL, keys, and models.
 */
export interface AIProvider {
	readonly name: string

	/**
	 * Agent session — full tool-use loop.
	 * Used in spawner.ts for agent sessions.
	 */
	spawn(options: AgentSpawnOptions, onEvent: (event: AgentEvent) => void): Promise<AgentSessionResult>

	/**
	 * One-shot chat completion — no tools, no loop.
	 * Used for: memory extraction, generic LLM calls.
	 */
	complete(options: CompleteOptions): Promise<string | null>

	/**
	 * Classification — structured output with Zod schema.
	 * Used for: message routing, notification classification, escalation detection.
	 */
	classify<T>(options: ClassifyOptions<T>): Promise<T | null>

	/**
	 * Web search — LLM with online access.
	 * Used in search_web tool.
	 */
	webSearch(query: string, maxResults?: number): Promise<WebSearchResult>

	/**
	 * Embeddings — vector representations of text.
	 * Used when indexing knowledge, tasks, messages.
	 */
	embed(input: EmbeddingInput, taskType?: EmbeddingTaskType): Promise<Float32Array | null>
	embedBatch(inputs: EmbeddingInput[], taskType?: EmbeddingTaskType): Promise<(Float32Array | null)[]>

	/** Embedding dimensionality (for DB schema). */
	readonly embeddingDimensions: number
}

export interface CompleteOptions {
	prompt: string
	systemPrompt?: string
	model?: string
	maxTokens?: number
}

export interface ClassifyOptions<T> {
	id: string
	input: string
	systemPrompt: string
	schema: z.ZodType<T>
	model?: string
	maxTokens?: number
}

export interface WebSearchResult {
	content: string
	citations: Array<{ title: string; url: string; snippet?: string }>
	error?: string
}
