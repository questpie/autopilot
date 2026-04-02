/**
 * Tiny Vercel AI SDK-backed inference service over Vercel AI Gateway.
 *
 * Uses `generateText` for completions/classification and
 * `embed`/`embedMany` for embeddings.
 *
 * One secret: AI_GATEWAY_API_KEY (set via environment, picked up by AI SDK automatically)
 * Model strings: 'google/gemini-2.5-flash', 'google/gemini-embedding-2', etc.
 */
import { generateText, embed, embedMany } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'

export interface InferenceConfig {
	apiKey: string
	gatewayBaseUrl?: string
	textModel: string
	embeddingModel: string
}

export class InferenceService {
	private provider: ReturnType<typeof createOpenAI>
	private textModel: string
	private embeddingModel: string

	constructor(config: InferenceConfig) {
		this.provider = createOpenAI({
			apiKey: config.apiKey,
			baseURL: config.gatewayBaseUrl ?? 'https://ai-gateway.vercel.sh/v1',
		})
		this.textModel = config.textModel
		this.embeddingModel = config.embeddingModel
	}

	/** Simple text completion. */
	async complete(prompt: string, opts?: { model?: string; maxTokens?: number }): Promise<string> {
		const { text } = await generateText({
			model: this.provider(opts?.model ?? this.textModel),
			prompt,
			maxTokens: opts?.maxTokens ?? 1024,
		})
		return text
	}

	/** Multi-turn chat completion. */
	async chat(
		messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
		opts?: { model?: string; maxTokens?: number },
	): Promise<string> {
		const { text } = await generateText({
			model: this.provider(opts?.model ?? this.textModel),
			messages,
			maxTokens: opts?.maxTokens ?? 1024,
		})
		return text
	}

	/** Classify input into one of the given categories. */
	async classify(input: string, categories: string[]): Promise<string> {
		const prompt = `Classify the following into exactly one of these categories: ${categories.join(', ')}\n\nInput: ${input}\n\nRespond with only the category name, nothing else.`
		const result = await this.complete(prompt)
		const lower = result.toLowerCase().trim()
		return categories.find((c) => lower.includes(c.toLowerCase())) ?? categories[0]!
	}

	/** Generate embedding for a single text. */
	async embedOne(input: string): Promise<number[]> {
		const { embedding } = await embed({
			model: this.provider.textEmbeddingModel(this.embeddingModel),
			value: input,
		})
		return embedding
	}

	/** Generate embeddings for multiple texts. */
	async embedBatch(inputs: string[]): Promise<number[][]> {
		const { embeddings } = await embedMany({
			model: this.provider.textEmbeddingModel(this.embeddingModel),
			values: inputs,
		})
		return embeddings
	}
}
