import type {
	EmbeddingProvider,
	EmbeddingInput,
	EmbeddingModality,
	EmbeddingTaskType,
} from './provider'
import { logger } from '../logger'

const MODEL_NAME = 'nomic-ai/nomic-embed-vision-v1.5'
const DIMENSIONS = 768

/**
 * Local vision embedding provider using Nomic's vision model via
 * Hugging Face Transformers.
 *
 * Supports image modality only. Visual features are language-agnostic so
 * the EN-bias of the text tower is irrelevant for image embeddings.
 *
 * Model is ~62MB, downloaded on first use and cached locally.
 */
export class NomicEmbeddingProvider implements EmbeddingProvider {
	readonly name = 'nomic'
	readonly dimensions = DIMENSIONS
	private processor: unknown = null
	private model: unknown = null
	private loading: Promise<void> | null = null

	supports(modality: EmbeddingModality): boolean {
		return modality === 'image'
	}

	async embed(input: EmbeddingInput, _taskType?: EmbeddingTaskType): Promise<Float32Array | null> {
		if (input.type !== 'image') return null

		try {
			await this.ensureLoaded()
			if (!this.processor || !this.model) return null

			const { RawImage } = await import('@huggingface/transformers')
			const image = await RawImage.fromBlob(new Blob([input.data], { type: input.mimeType }))

			const imageInputs = await (this.processor as any)(image)
			const output = await (this.model as any)(imageInputs)

			const embeddings = output?.image_embeds?.data
			if (!embeddings) return null

			// Normalize
			const vec = new Float32Array(embeddings)
			let magnitude = 0
			for (let i = 0; i < vec.length; i++) {
				magnitude += vec[i]! * vec[i]!
			}
			magnitude = Math.sqrt(magnitude)
			if (magnitude > 0) {
				for (let i = 0; i < vec.length; i++) {
					vec[i] = vec[i]! / magnitude
				}
			}

			return vec
		} catch (err) {
			logger.error('embeddings:nomic', 'embed failed', { error: err instanceof Error ? err.message : String(err) })
			return null
		}
	}

	async embedBatch(inputs: EmbeddingInput[], taskType?: EmbeddingTaskType): Promise<(Float32Array | null)[]> {
		const results: (Float32Array | null)[] = []
		for (const input of inputs) {
			results.push(await this.embed(input, taskType))
		}
		return results
	}

	private async ensureLoaded(): Promise<void> {
		if (this.processor && this.model) return

		if (this.loading) {
			await this.loading
			return
		}

		this.loading = this.loadModel()
		try {
			await this.loading
		} finally {
			this.loading = null
		}
	}

	private async loadModel(): Promise<void> {
		logger.info('embeddings:nomic', `loading model ${MODEL_NAME} (first run downloads ~62MB)...`)
		const { AutoProcessor, AutoModel } = await import('@huggingface/transformers')
		this.processor = await AutoProcessor.from_pretrained(MODEL_NAME)
		this.model = await AutoModel.from_pretrained(MODEL_NAME)
		logger.info('embeddings:nomic', 'model loaded')
	}
}
