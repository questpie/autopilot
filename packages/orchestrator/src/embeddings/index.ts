import type {
	EmbeddingProvider,
	EmbeddingInput,
	EmbeddingConfig,
	EmbeddingProviderName,
	EmbeddingTaskType,
} from './provider'

export type { EmbeddingProvider, EmbeddingInput, EmbeddingConfig, EmbeddingProviderName, EmbeddingTaskType }
export { type EmbeddingModality } from './provider'

/**
 * Orchestrates embedding generation with primary → fallback → null chain.
 *
 * Never throws — all failures result in null (FTS-only degradation).
 */
export class EmbeddingService {
	private primary: EmbeddingProvider
	private fallback: EmbeddingProvider | null

	constructor(primary: EmbeddingProvider, fallback?: EmbeddingProvider | null) {
		this.primary = primary
		this.fallback = fallback ?? null
	}

	/** Provider name for logging. */
	get providerName(): string {
		return this.primary.name
	}

	/** Output dimensions of the primary provider. */
	get dimensions(): number {
		return this.primary.dimensions
	}

	/**
	 * Embed a single input. Tries primary, then fallback, then returns null.
	 */
	async embed(input: EmbeddingInput, taskType?: EmbeddingTaskType): Promise<Float32Array | null> {
		// Determine modality
		const modality = input.type === 'file' ? 'text' : input.type

		// Try primary
		if (this.primary.supports(modality)) {
			const result = await this.primary.embed(input, taskType)
			if (result) return result
		}

		// Try fallback
		if (this.fallback?.supports(modality)) {
			const result = await this.fallback.embed(input, taskType)
			if (result) return result
		}

		return null
	}

	/**
	 * Embed a batch of inputs.
	 */
	async embedBatch(inputs: EmbeddingInput[], taskType?: EmbeddingTaskType): Promise<(Float32Array | null)[]> {
		const results: (Float32Array | null)[] = []
		for (const input of inputs) {
			results.push(await this.embed(input, taskType))
		}
		return results
	}

	/**
	 * Convenience: embed a text string for document indexing.
	 */
	async embedText(text: string, taskType: EmbeddingTaskType = 'retrieval_document'): Promise<Float32Array | null> {
		return this.embed({ type: 'text', content: text }, taskType)
	}

	/**
	 * Convenience: embed a text string for search queries.
	 */
	async embedQuery(text: string): Promise<Float32Array | null> {
		return this.embed({ type: 'text', content: text }, 'retrieval_query')
	}

	/**
	 * Convenience: embed an image buffer.
	 */
	async embedImage(data: Buffer, mimeType: string): Promise<Float32Array | null> {
		return this.embed({ type: 'image', data, mimeType })
	}

	/**
	 * Convenience: embed a file by path (reads file and infers type).
	 */
	async embedFile(path: string): Promise<Float32Array | null> {
		return this.embed({ type: 'file', path })
	}
}

/**
 * Lazily create a provider by name. Uses dynamic imports so unused providers
 * are never loaded.
 */
async function createProvider(
	name: EmbeddingProviderName,
	opts?: { dimensions?: number; apiKey?: string },
): Promise<EmbeddingProvider> {
	switch (name) {
		case 'gemini': {
			const { GeminiEmbeddingProvider } = await import('./gemini-provider')
			return new GeminiEmbeddingProvider(opts)
		}
		case 'multilingual-e5': {
			const { E5EmbeddingProvider } = await import('./e5-provider')
			return new E5EmbeddingProvider()
		}
		case 'nomic': {
			const { NomicEmbeddingProvider } = await import('./nomic-provider')
			return new NomicEmbeddingProvider()
		}
		case 'none': {
			const { NoneEmbeddingProvider } = await import('./none-provider')
			return new NoneEmbeddingProvider()
		}
		default: {
			console.warn(`[embeddings] unknown provider "${name}", falling back to none`)
			const { NoneEmbeddingProvider } = await import('./none-provider')
			return new NoneEmbeddingProvider()
		}
	}
}

/**
 * Create an {@link EmbeddingService} from a config object (typically read from
 * `company.yaml` `settings.embeddings`).
 *
 * If no config is provided, defaults to the none provider (FTS-only).
 */
export async function createEmbeddingService(config?: EmbeddingConfig): Promise<EmbeddingService> {
	if (!config || config.provider === 'none') {
		const { NoneEmbeddingProvider } = await import('./none-provider')
		return new EmbeddingService(new NoneEmbeddingProvider())
	}

	const primaryOpts = {
		dimensions: config.dimensions,
	}

	let primary: EmbeddingProvider
	try {
		primary = await createProvider(config.provider, primaryOpts)
		console.log(`[embeddings] primary provider: ${primary.name} (${primary.dimensions}d)`)
	} catch (err) {
		console.error(`[embeddings] failed to create primary provider "${config.provider}":`, err instanceof Error ? err.message : err)
		const { NoneEmbeddingProvider } = await import('./none-provider')
		return new EmbeddingService(new NoneEmbeddingProvider())
	}

	let fallback: EmbeddingProvider | null = null
	if (config.fallback && config.fallback !== 'none') {
		try {
			fallback = await createProvider(config.fallback)
			console.log(`[embeddings] fallback provider: ${fallback.name} (${fallback.dimensions}d)`)
		} catch (err) {
			console.error(`[embeddings] failed to create fallback provider "${config.fallback}":`, err instanceof Error ? err.message : err)
		}
	}

	return new EmbeddingService(primary, fallback)
}

import { container, companyRootFactory } from '../container'
import { loadCompany } from '../fs'

export const embeddingServiceFactory = container.registerAsync('embeddingService', async (c) => {
	const { companyRoot } = c.resolve([companyRootFactory])
	try {
		const company = await loadCompany(companyRoot)
		const settings = company.settings as Record<string, unknown>
		const embeddingsConfig = settings?.embeddings as Parameters<typeof createEmbeddingService>[0]
		return createEmbeddingService(embeddingsConfig)
	} catch {
		return createEmbeddingService()
	}
})
