import type {
	EmbeddingProvider,
	EmbeddingInput,
	EmbeddingModality,
	EmbeddingTaskType,
} from './provider'

/**
 * No-op embedding provider for self-hosted deployments that don't need
 * vector search. All operations gracefully return null.
 */
export class NoneEmbeddingProvider implements EmbeddingProvider {
	readonly name = 'none'
	readonly dimensions = 0

	supports(_modality: EmbeddingModality): boolean {
		return false
	}

	async embed(_input: EmbeddingInput, _taskType?: EmbeddingTaskType): Promise<Float32Array | null> {
		return null
	}

	async embedBatch(inputs: EmbeddingInput[], _taskType?: EmbeddingTaskType): Promise<(Float32Array | null)[]> {
		return inputs.map(() => null)
	}
}
