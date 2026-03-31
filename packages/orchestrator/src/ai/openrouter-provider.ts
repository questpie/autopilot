import { chat, maxIterations } from '@tanstack/ai'
import { openRouterText } from '@tanstack/ai-openrouter'
import type { ChatMiddleware, AfterToolCallInfo, ChatMiddlewareContext } from '@tanstack/ai'
import type { Tool as TanStackTool, JSONSchema } from '@tanstack/ai'
import type {
	AIProvider,
	CompleteOptions,
	ClassifyOptions,
	WebSearchResult,
	AgentSpawnOptions,
	AgentSessionResult,
	AgentEvent,
} from './provider'
import type { EmbeddingInput, EmbeddingTaskType } from '../embeddings/provider'
import { executeTool } from '../agent/tools'
import { zodToJsonSchema } from '../agent/utils/zod-to-json'
import { logger } from '../logger'

export interface OpenRouterConfig {
	/** Base URL for chat completions. Default: undefined (= OpenRouter default). */
	chatBaseUrl?: string
	/** Base URL for embeddings. Default: 'https://openrouter.ai/api/v1'. */
	embeddingsBaseUrl?: string
	/** API key. Default: process.env.OPENROUTER_API_KEY. */
	apiKey?: string
	/** Default model for agent sessions. */
	defaultModel?: string
	/** Default model for utility calls (classify, complete). Cheap/fast. */
	utilityModel?: string
	/** Default model for web search. */
	searchModel?: string
	/** Default model for embeddings. */
	embeddingModel?: string
	/** Embedding dimensions. */
	embeddingDimensions?: number
}

/**
 * OpenRouter AI provider — consolidates ALL LLM operations.
 *
 * Uses @tanstack/ai for agent sessions and chat completions,
 * raw fetch for web search and embeddings.
 */
export class OpenRouterAIProvider implements AIProvider {
	readonly name = 'openrouter'
	readonly embeddingDimensions: number

	private config: Required<OpenRouterConfig>
	private warnedNoKey = false

	constructor(config?: OpenRouterConfig) {
		this.config = {
			chatBaseUrl: config?.chatBaseUrl ?? '',
			embeddingsBaseUrl: config?.embeddingsBaseUrl ?? 'https://openrouter.ai/api/v1',
			apiKey: config?.apiKey ?? process.env.OPENROUTER_API_KEY ?? '',
			defaultModel: config?.defaultModel ?? 'anthropic/claude-sonnet-4',
			utilityModel: config?.utilityModel ?? 'google/gemma-3-4b-it:free',
			searchModel: config?.searchModel ?? 'openai/gpt-4o-mini:online',
			embeddingModel: config?.embeddingModel ?? 'nvidia/llama-nemotron-embed-vl-1b-v2:free',
			embeddingDimensions: config?.embeddingDimensions ?? 768,
		}
		this.embeddingDimensions = this.config.embeddingDimensions
	}

	// ── spawn ───────────────────────────────────────────────────────────────

	async spawn(
		options: AgentSpawnOptions,
		onEvent: (event: AgentEvent) => void,
	): Promise<AgentSessionResult> {
		const { systemPrompt, prompt, tools, toolContext, maxTurns = 50 } = options
		const model = options.webSearch && !options.model.includes(':online')
			? `${options.model}:online`
			: options.model

		let toolCalls = 0
		let error: string | undefined

		const tanstackTools: TanStackTool[] = tools.map((t) => ({
			name: t.name,
			description: t.description,
			inputSchema: zodToJsonSchema(t.schema) as JSONSchema,
			execute: async (args: unknown) => {
				const result = await executeTool(tools, t.name, args, toolContext)
				return result.content.map((c) => c.text).join('\n')
			},
		}))

		const bridgeMiddleware: ChatMiddleware = {
			name: 'autopilot-bridge',

			onChunk(_ctx, chunk) {
				if (chunk.type === 'TEXT_MESSAGE_CONTENT' && 'delta' in chunk) {
					onEvent({
						type: 'text_delta',
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
				let content: string
				if (!info.ok) {
					content = String(info.error)
				} else if (typeof info.result === 'string') {
					content = info.result
				} else {
					content = JSON.stringify(info.result)
				}
				onEvent({ type: 'tool_result', tool: info.toolName, toolCallId: info.toolCallId, content })
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
			const adapter = this.createAdapter(model)

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

	// ── complete ─────────────────────────────────────────────────────────────

	async complete(options: CompleteOptions): Promise<string | null> {
		if (!this.getApiKey()) return null

		try {
			const model = options.model ?? this.config.utilityModel
			const messages: Array<{ role: string; content: string }> = []

			if (options.systemPrompt) {
				messages.push({ role: 'system', content: options.systemPrompt })
			}
			messages.push({ role: 'user', content: options.prompt })

			const result = await chat({
				adapter: this.createAdapter(model),
				messages: messages as Array<{ role: 'user'; content: string }>,
				stream: false,
			}) as string

			return result || null
		} catch (err) {
			logger.error('ai', 'complete() failed', {
				error: err instanceof Error ? err.message : String(err),
			})
			return null
		}
	}

	// ── classify ─────────────────────────────────────────────────────────────

	async classify<T>(options: ClassifyOptions<T>): Promise<T | null> {
		if (!this.getApiKey()) return null

		try {
			const model = options.model ?? this.config.utilityModel
			const result = await chat({
				adapter: this.createAdapter(model),
				messages: [{
					role: 'user',
					content: `${options.systemPrompt}\n\nInput:\n${options.input}\n\nRespond with ONLY valid JSON, no markdown fences.`,
				}],
				stream: false,
			}) as string

			if (!result) return null

			// Parse JSON + validate with Zod
			const cleaned = result.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
			const parsed = JSON.parse(cleaned)
			const validated = options.schema.safeParse(parsed)
			if (!validated.success) {
				logger.warn('ai', `classify ${options.id} schema validation failed`, {
					errors: validated.error.issues.map((i) => i.message),
				})
				return null
			}
			return validated.data
		} catch (err) {
			logger.error('ai', `classify ${options.id} failed`, {
				error: err instanceof Error ? err.message : String(err),
			})
			return null
		}
	}

	// ── webSearch ────────────────────────────────────────────────────────────

	async webSearch(query: string, maxResults = 5): Promise<WebSearchResult> {
		const apiKey = this.getApiKey()
		if (!apiKey) {
			return { content: '', citations: [], error: 'API key not configured' }
		}

		try {
			const resp = await fetch(this.chatCompletionsUrl(), {
				method: 'POST',
				headers: this.authHeaders(),
				body: JSON.stringify({
					model: this.config.searchModel,
					messages: [{
						role: 'user',
						content: `Search the web for: ${query}\n\nReturn the top ${maxResults} most relevant results. For each result include the title, URL, and a brief content snippet.`,
					}],
					max_tokens: 1500,
				}),
				signal: AbortSignal.timeout(30_000),
			})

			if (!resp.ok) {
				const body = await resp.text().catch(() => '')
				return { content: '', citations: [], error: `HTTP ${resp.status} ${body.slice(0, 200)}` }
			}

			const data = (await resp.json()) as {
				choices?: Array<{
					message?: {
						content?: string
						annotations?: Array<{
							type: string
							url_citation?: { url: string; title: string; content?: string }
						}>
					}
				}>
			}

			const choice = data.choices?.[0]?.message
			const content = choice?.content ?? ''
			const annotations = choice?.annotations ?? []

			const citations = annotations
				.filter((a) => a.type === 'url_citation' && a.url_citation)
				.slice(0, maxResults)
				.map((a) => ({
					title: a.url_citation!.title,
					url: a.url_citation!.url,
					snippet: a.url_citation!.content?.slice(0, 200),
				}))

			return { content, citations }
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err)
			return { content: '', citations: [], error: msg }
		}
	}

	// ── embed ────────────────────────────────────────────────────────────────

	async embed(input: EmbeddingInput, _taskType?: EmbeddingTaskType): Promise<Float32Array | null> {
		const apiKey = this.getApiKey()
		if (!apiKey) {
			if (!this.warnedNoKey) {
				logger.warn('ai', 'API key not set — embeddings disabled')
				this.warnedNoKey = true
			}
			return null
		}

		try {
			const body = this.buildEmbeddingRequest(input)
			if (!body) return null

			const resp = await fetch(this.embeddingsUrl(), {
				method: 'POST',
				headers: this.authHeaders(),
				body: JSON.stringify(body),
				signal: AbortSignal.timeout(30_000),
			})

			if (!resp.ok) {
				logger.warn('ai', `embedding API error: ${resp.status}`)
				return null
			}

			const data = (await resp.json()) as {
				data?: Array<{ embedding: number[] }>
			}

			const embedding = data.data?.[0]?.embedding
			if (!embedding) return null

			return new Float32Array(embedding)
		} catch (err) {
			logger.warn('ai', 'embedding failed', {
				error: err instanceof Error ? err.message : String(err),
			})
			return null
		}
	}

	async embedBatch(inputs: EmbeddingInput[], taskType?: EmbeddingTaskType): Promise<(Float32Array | null)[]> {
		const textInputs = inputs.filter((i) => i.type === 'text')
		if (textInputs.length === inputs.length && textInputs.length > 0) {
			return this.embedBatchText(textInputs as Array<{ type: 'text'; content: string }>)
		}
		return Promise.all(inputs.map((i) => this.embed(i, taskType)))
	}

	// ── Internal helpers ────────────────────────────────────────────────────

	private createAdapter(model: string) {
		const config: NonNullable<Parameters<typeof openRouterText>[1]> = {
			httpReferer: 'https://questpie.com',
			xTitle: 'QUESTPIE Autopilot',
		}
		if (this.config.chatBaseUrl) {
			config.serverURL = this.config.chatBaseUrl
		}
		return openRouterText(model as Parameters<typeof openRouterText>[0], config)
	}

	private getApiKey(): string {
		return this.config.apiKey || process.env.OPENROUTER_API_KEY || ''
	}

	private chatCompletionsUrl(): string {
		return this.config.chatBaseUrl
			? `${this.config.chatBaseUrl}/chat/completions`
			: 'https://openrouter.ai/api/v1/chat/completions'
	}

	private embeddingsUrl(): string {
		return `${this.config.embeddingsBaseUrl}/embeddings`
	}

	private authHeaders(): Record<string, string> {
		return {
			'Authorization': `Bearer ${this.getApiKey()}`,
			'Content-Type': 'application/json',
			'HTTP-Referer': 'https://questpie.com',
			'X-Title': 'QUESTPIE Autopilot',
		}
	}

	private buildEmbeddingRequest(input: EmbeddingInput): Record<string, unknown> | null {
		switch (input.type) {
			case 'text':
				return { model: this.config.embeddingModel, input: input.content }
			case 'image':
				return {
					model: this.config.embeddingModel,
					input: [{
						type: 'image_url',
						image_url: {
							url: `data:${input.mimeType};base64,${input.data.toString('base64')}`,
						},
					}],
				}
			default:
				return null
		}
	}

	private async embedBatchText(
		inputs: Array<{ type: 'text'; content: string }>,
	): Promise<(Float32Array | null)[]> {
		const apiKey = this.getApiKey()
		if (!apiKey) return inputs.map(() => null)

		try {
			const resp = await fetch(this.embeddingsUrl(), {
				method: 'POST',
				headers: this.authHeaders(),
				body: JSON.stringify({
					model: this.config.embeddingModel,
					input: inputs.map((i) => i.content),
				}),
				signal: AbortSignal.timeout(60_000),
			})

			if (!resp.ok) return inputs.map(() => null)

			const data = (await resp.json()) as {
				data?: Array<{ embedding: number[]; index: number }>
			}

			const results: (Float32Array | null)[] = new Array(inputs.length).fill(null)
			for (const item of data.data ?? []) {
				if (item.index < results.length) {
					results[item.index] = new Float32Array(item.embedding)
				}
			}
			return results
		} catch {
			return inputs.map(() => null)
		}
	}
}
