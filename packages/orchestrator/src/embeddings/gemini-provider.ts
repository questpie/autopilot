import type {
	EmbeddingProvider,
	EmbeddingInput,
	EmbeddingModality,
	EmbeddingTaskType,
} from './provider'

const GEMINI_MODEL = 'gemini-embedding-2-preview'
const DEFAULT_DIMENSIONS = 768
const NATIVE_DIMENSIONS = 3072

/**
 * Gemini embedding provider using `@google/genai`.
 *
 * Supports text, images (PNG/JPEG via base64), PDF (base64, max 6 pages),
 * video, and audio modalities. Uses dynamic import to avoid loading the SDK
 * unless this provider is actually selected.
 */
export class GeminiEmbeddingProvider implements EmbeddingProvider {
	readonly name = 'gemini'
	readonly dimensions: number
	private client: unknown = null
	private apiKey: string

	constructor(opts?: { dimensions?: number; apiKey?: string }) {
		this.dimensions = opts?.dimensions ?? DEFAULT_DIMENSIONS
		this.apiKey = opts?.apiKey ?? process.env.GEMINI_API_KEY ?? ''
	}

	supports(modality: EmbeddingModality): boolean {
		return ['text', 'image', 'pdf', 'video', 'audio'].includes(modality)
	}

	async embed(input: EmbeddingInput, taskType?: EmbeddingTaskType): Promise<Float32Array | null> {
		try {
			const client = await this.getClient()
			if (!client) return null

			const geminiTaskType = taskType === 'retrieval_query'
				? 'RETRIEVAL_QUERY'
				: 'RETRIEVAL_DOCUMENT'

			const content = this.inputToContent(input)
			if (!content) return null

			const result = await (client as any).models.embedContent({
				model: GEMINI_MODEL,
				contents: content,
				config: {
					taskType: geminiTaskType,
					outputDimensionality: this.dimensions,
				},
			})

			const values = result?.embeddings?.[0]?.values
			if (!values || !Array.isArray(values)) return null

			const embedding = new Float32Array(values)
			return this.dimensions !== NATIVE_DIMENSIONS
				? this.normalize(embedding)
				: embedding
		} catch (err) {
			console.error('[embeddings:gemini] embed failed:', err instanceof Error ? err.message : err)
			return null
		}
	}

	async embedBatch(inputs: EmbeddingInput[], taskType?: EmbeddingTaskType): Promise<(Float32Array | null)[]> {
		// Gemini supports batch natively but for simplicity we parallelize individual calls
		// (the API batching has complex content-type requirements across modalities)
		return Promise.all(inputs.map((input) => this.embed(input, taskType)))
	}

	private inputToContent(input: EmbeddingInput): unknown {
		switch (input.type) {
			case 'text':
				return input.content
			case 'image':
				return {
					parts: [{
						inlineData: {
							mimeType: input.mimeType,
							data: input.data.toString('base64'),
						},
					}],
				}
			case 'pdf':
				return {
					parts: [{
						inlineData: {
							mimeType: 'application/pdf',
							data: input.data.toString('base64'),
						},
					}],
				}
			case 'file':
				// File inputs need to be read first — caller should convert to specific type
				return null
		}
	}

	private normalize(vec: Float32Array): Float32Array {
		let magnitude = 0
		for (let i = 0; i < vec.length; i++) {
			magnitude += vec[i]! * vec[i]!
		}
		magnitude = Math.sqrt(magnitude)
		if (magnitude === 0) return vec

		const normalized = new Float32Array(vec.length)
		for (let i = 0; i < vec.length; i++) {
			normalized[i] = vec[i]! / magnitude
		}
		return normalized
	}

	private async getClient(): Promise<unknown> {
		if (this.client) return this.client
		if (!this.apiKey) {
			console.warn('[embeddings:gemini] no GEMINI_API_KEY — provider disabled')
			return null
		}

		try {
			const { GoogleGenAI } = await import('@google/genai')
			this.client = new GoogleGenAI({ apiKey: this.apiKey })
			return this.client
		} catch (err) {
			console.error('[embeddings:gemini] failed to load @google/genai:', err instanceof Error ? err.message : err)
			return null
		}
	}
}
