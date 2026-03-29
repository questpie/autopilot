import type {
	EmbeddingProvider,
	EmbeddingInput,
	EmbeddingConfig,
	EmbeddingProviderName,
	EmbeddingTaskType,
} from './provider'

export type { EmbeddingProvider, EmbeddingInput, EmbeddingConfig, EmbeddingProviderName, EmbeddingTaskType }
export { type EmbeddingModality } from './provider'
import { logger } from '../logger'

/**
 * Embedding service — always uses OpenRouter.
 *
 * Default model: nvidia/llama-nemotron-embed-vl-1b-v2:free (multimodal, FREE).
 * Uses the same OPENROUTER_API_KEY as agents and web search.
 * Never throws — failures degrade to null (FTS-only fallback).
 */
export class EmbeddingService {
	private provider: EmbeddingProvider

	constructor(provider: EmbeddingProvider) {
		this.provider = provider
	}

	get providerName(): string {
		return this.provider.name
	}

	get dimensions(): number {
		return this.provider.dimensions
	}

	async embed(input: EmbeddingInput, taskType?: EmbeddingTaskType): Promise<Float32Array | null> {
		const modality = input.type === 'file' ? 'text' : input.type
		if (!this.provider.supports(modality)) return null
		return this.provider.embed(input, taskType)
	}

	async embedBatch(inputs: EmbeddingInput[], taskType?: EmbeddingTaskType): Promise<(Float32Array | null)[]> {
		return this.provider.embedBatch(inputs, taskType)
	}

	async embedText(text: string, taskType: EmbeddingTaskType = 'retrieval_document'): Promise<Float32Array | null> {
		return this.embed({ type: 'text', content: text }, taskType)
	}

	async embedQuery(text: string): Promise<Float32Array | null> {
		return this.embed({ type: 'text', content: text }, 'retrieval_query')
	}

	async embedImage(data: Buffer, mimeType: string): Promise<Float32Array | null> {
		return this.embed({ type: 'image', data, mimeType })
	}

	async embedFile(path: string): Promise<Float32Array | null> {
		return this.embed({ type: 'file', path })
	}
}

/**
 * Create the embedding service — always OpenRouter.
 * Config is optional and only used for custom dimensions/model.
 */
export async function createEmbeddingService(config?: EmbeddingConfig): Promise<EmbeddingService> {
	try {
		const { OpenRouterEmbeddingProvider } = await import('./openrouter-provider')
		const provider = new OpenRouterEmbeddingProvider({
			dimensions: config?.dimensions,
		})
		logger.info('embeddings', `provider: ${provider.name} (${provider.dimensions}d)`)
		return new EmbeddingService(provider)
	} catch (err) {
		logger.error('embeddings', 'failed to create OpenRouter embedding provider', {
			error: err instanceof Error ? err.message : String(err),
		})
		// Return a stub that always returns null — FTS still works
		const { OpenRouterEmbeddingProvider } = await import('./openrouter-provider')
		return new EmbeddingService(new OpenRouterEmbeddingProvider())
	}
}

import { container, companyRootFactory } from '../container'
import { loadCompany } from '../fs'

export const embeddingServiceFactory = container.registerAsync('embeddingService', async (c) => {
	const { companyRoot } = c.resolve([companyRootFactory])
	try {
		const company = await loadCompany(companyRoot)
		const settings = company.settings as Record<string, unknown>
		const embeddingsConfig = settings?.embeddings as EmbeddingConfig | undefined
		return createEmbeddingService(embeddingsConfig)
	} catch {
		return createEmbeddingService()
	}
})
