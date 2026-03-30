import type { EmbeddingInput, EmbeddingTaskType } from './provider'
import type { AIProvider } from '../ai/provider'
import { container } from '../container'
import { aiProviderFactory } from '../ai'
import { logger } from '../logger'

export type { EmbeddingInput, EmbeddingConfig, EmbeddingProviderName, EmbeddingTaskType, EmbeddingModality } from './provider'

/**
 * Embedding service — wraps AIProvider for embedding operations.
 *
 * Never throws — failures degrade to null (FTS-only fallback).
 */
export class EmbeddingService {
	constructor(private aiProvider: AIProvider) {}

	get providerName(): string {
		return this.aiProvider.name
	}

	get dimensions(): number {
		return this.aiProvider.embeddingDimensions
	}

	async embed(input: EmbeddingInput, taskType?: EmbeddingTaskType): Promise<Float32Array | null> {
		return this.aiProvider.embed(input, taskType)
	}

	async embedBatch(inputs: EmbeddingInput[], taskType?: EmbeddingTaskType): Promise<(Float32Array | null)[]> {
		return this.aiProvider.embedBatch(inputs, taskType)
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

export const embeddingServiceFactory = container.registerAsync('embeddingService', async (c) => {
	const { aiProvider } = await c.resolveAsync([aiProviderFactory])
	logger.info('embeddings', `provider: ${aiProvider.name} (${aiProvider.embeddingDimensions}d)`)
	return new EmbeddingService(aiProvider)
})
