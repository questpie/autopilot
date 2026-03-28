import type {
	EmbeddingProvider,
	EmbeddingInput,
	EmbeddingModality,
	EmbeddingTaskType,
} from './provider'
import { logger } from '../logger'

const MODEL_NAME = 'Xenova/multilingual-e5-small'
const DIMENSIONS = 384

/**
 * Local multilingual text embedding provider using Hugging Face Transformers.
 *
 * Uses `Xenova/multilingual-e5-small` (118M params, 384 dims, 100+ languages
 * including SK/CS/DE). Model is downloaded on first use and cached locally.
 *
 * E5 convention: prefix inputs with `query: ` for search queries and
 * `passage: ` for documents being indexed.
 */
export class E5EmbeddingProvider implements EmbeddingProvider {
	readonly name = 'multilingual-e5'
	readonly dimensions = DIMENSIONS
	private pipeline: unknown = null
	private loading: Promise<unknown> | null = null

	supports(modality: EmbeddingModality): boolean {
		return modality === 'text'
	}

	async embed(input: EmbeddingInput, taskType?: EmbeddingTaskType): Promise<Float32Array | null> {
		if (input.type !== 'text') return null

		try {
			const pipe = await this.getPipeline()
			if (!pipe) return null

			const prefix = taskType === 'retrieval_query' ? 'query: ' : 'passage: '
			const text = prefix + input.content

			const result = await (pipe as any)(text, { pooling: 'mean', normalize: true })
			const data = result?.data
			if (!data) return null

			return new Float32Array(data)
		} catch (err) {
			logger.error('embeddings:e5', 'embed failed', { error: err instanceof Error ? err.message : String(err) })
			return null
		}
	}

	async embedBatch(inputs: EmbeddingInput[], taskType?: EmbeddingTaskType): Promise<(Float32Array | null)[]> {
		// Process sequentially to avoid OOM with local model
		const results: (Float32Array | null)[] = []
		for (const input of inputs) {
			results.push(await this.embed(input, taskType))
		}
		return results
	}

	private async getPipeline(): Promise<unknown> {
		if (this.pipeline) return this.pipeline

		// Deduplicate concurrent loading requests
		if (this.loading) return this.loading

		this.loading = this.loadPipeline()
		try {
			this.pipeline = await this.loading
			return this.pipeline
		} catch (err) {
			logger.error('embeddings:e5', 'failed to load model', { error: err instanceof Error ? err.message : String(err) })
			return null
		} finally {
			this.loading = null
		}
	}

	private async loadPipeline(): Promise<unknown> {
		logger.info('embeddings:e5', `loading model ${MODEL_NAME} (first run downloads ~120MB)...`)
		const { pipeline } = await import('@huggingface/transformers')
		const pipe = await pipeline('feature-extraction', MODEL_NAME)
		logger.info('embeddings:e5', 'model loaded')
		return pipe
	}
}
