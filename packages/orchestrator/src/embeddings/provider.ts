/**
 * Swappable embedding provider interface.
 *
 * Each provider implements this interface and declares which modalities it
 * supports. The {@link EmbeddingService} orchestrates primary/fallback chains.
 */

export type EmbeddingModality = 'text' | 'image' | 'pdf' | 'video' | 'audio'

export type EmbeddingInput =
	| { type: 'text'; content: string }
	| { type: 'image'; data: Buffer; mimeType: string }
	| { type: 'pdf'; data: Buffer }
	| { type: 'file'; path: string }

export type EmbeddingTaskType = 'retrieval_document' | 'retrieval_query'

export interface EmbeddingProvider {
	/** Human-readable provider name (e.g. 'gemini', 'multilingual-e5'). */
	name: string
	/** Output embedding dimensionality. */
	dimensions: number
	/** Generate a single embedding. Returns null on failure. */
	embed(input: EmbeddingInput, taskType?: EmbeddingTaskType): Promise<Float32Array | null>
	/** Generate embeddings for a batch of inputs. Returns null per failed item. */
	embedBatch(inputs: EmbeddingInput[], taskType?: EmbeddingTaskType): Promise<(Float32Array | null)[]>
	/** Whether this provider supports the given modality. */
	supports(modality: EmbeddingModality): boolean
}

export type EmbeddingProviderName = 'openrouter'

export interface EmbeddingConfig {
	provider: EmbeddingProviderName
	fallback?: EmbeddingProviderName
	dimensions?: number
}
