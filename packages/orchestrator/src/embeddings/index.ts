import { aiProviderFactory, createAIProvider } from '../ai'
import type { AIProvider } from '../ai/provider'
import { container } from '../container'
import { logger } from '../logger'
import type { EmbeddingInput, EmbeddingModality, EmbeddingTaskType } from './provider'

export type {
	EmbeddingInput,
	EmbeddingConfig,
	EmbeddingProviderName,
	EmbeddingTaskType,
	EmbeddingModality,
} from './provider'

type EmbeddingBackend = Pick<AIProvider, 'name' | 'embed' | 'embedBatch'> & {
	embeddingDimensions?: number
	dimensions?: number
	supports?: (modality: EmbeddingModality) => boolean
}

/**
 * Embedding service — wraps AIProvider for embedding operations.
 *
 * Never throws — failures degrade to null (FTS-only fallback).
 */
export class EmbeddingService {
	constructor(private backend: EmbeddingBackend) {}

	get providerName(): string {
		return this.backend.name
	}

	get dimensions(): number {
		return this.backend.embeddingDimensions ?? this.backend.dimensions ?? 0
	}

	async embed(input: EmbeddingInput, taskType?: EmbeddingTaskType): Promise<Float32Array | null> {
		const modality = input.type === 'file' ? null : input.type
		if (modality && this.backend.supports && !this.backend.supports(modality)) return null
		return this.backend.embed(input, taskType)
	}

	async embedBatch(
		inputs: EmbeddingInput[],
		taskType?: EmbeddingTaskType,
	): Promise<(Float32Array | null)[]> {
		if (!this.backend.supports) return this.backend.embedBatch(inputs, taskType)
		const supportedInputs = inputs.filter((input) => {
			const modality = input.type === 'file' ? null : input.type
			if (!modality) return true
			return this.backend.supports?.(modality)
		})
		if (supportedInputs.length === inputs.length) {
			return this.backend.embedBatch(inputs, taskType)
		}

		const embedded = await this.backend.embedBatch(supportedInputs, taskType)
		const byInput = new Map<EmbeddingInput, Float32Array | null>()
		for (let i = 0; i < supportedInputs.length; i++) {
			const supportedInput = supportedInputs[i]
			if (!supportedInput) continue
			byInput.set(supportedInput, embedded[i] ?? null)
		}

		return inputs.map((input) => byInput.get(input) ?? null)
	}

	async embedText(
		text: string,
		taskType: EmbeddingTaskType = 'retrieval_document',
	): Promise<Float32Array | null> {
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

export async function createEmbeddingService(
	companySettings?: Record<string, unknown>,
): Promise<EmbeddingService> {
	const aiProvider = createAIProvider(companySettings)
	return new EmbeddingService(aiProvider)
}

export const embeddingServiceFactory = container.registerAsync('embeddingService', async (c) => {
	const { aiProvider } = await c.resolveAsync([aiProviderFactory])
	logger.info('embeddings', `provider: ${aiProvider.name} (${aiProvider.embeddingDimensions}d)`)
	return new EmbeddingService(aiProvider)
})
