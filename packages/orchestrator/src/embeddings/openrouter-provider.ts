import type { EmbeddingProvider, EmbeddingInput, EmbeddingModality, EmbeddingTaskType } from './provider'
import { logger } from '../logger'

const DEFAULT_MODEL = 'nvidia/llama-nemotron-embed-vl-1b-v2:free'
const DEFAULT_DIMENSIONS = 768

/**
 * OpenRouter embedding provider.
 *
 * Uses OpenRouter's OpenAI-compatible embeddings API with the same
 * OPENROUTER_API_KEY used for chat. Default model is nvidia/llama-nemotron
 * which is free and supports multimodal (text + vision).
 *
 * Zero extra configuration — works out of the box with any OpenRouter key.
 */
export class OpenRouterEmbeddingProvider implements EmbeddingProvider {
	readonly name = 'openrouter'
	readonly dimensions: number
	private model: string

	constructor(opts?: { dimensions?: number; model?: string }) {
		this.dimensions = opts?.dimensions ?? DEFAULT_DIMENSIONS
		this.model = opts?.model ?? DEFAULT_MODEL
	}

	supports(modality: EmbeddingModality): boolean {
		// nvidia/llama-nemotron supports text + images
		// text-only models only support text
		if (this.model.includes('nemotron-embed-vl')) {
			return modality === 'text' || modality === 'image'
		}
		return modality === 'text'
	}

	async embed(input: EmbeddingInput, _taskType?: EmbeddingTaskType): Promise<Float32Array | null> {
		const apiKey = process.env.OPENROUTER_API_KEY
		if (!apiKey) {
			logger.warn('embeddings', 'OPENROUTER_API_KEY not set')
			return null
		}

		try {
			const body = this.buildRequest(input)
			if (!body) return null

			const resp = await fetch('https://openrouter.ai/api/v1/embeddings', {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${apiKey}`,
					'Content-Type': 'application/json',
					'HTTP-Referer': 'https://questpie.com',
					'X-Title': 'QuestPie Autopilot',
				},
				body: JSON.stringify(body),
				signal: AbortSignal.timeout(30_000),
			})

			if (!resp.ok) {
				logger.warn('embeddings', `OpenRouter API error: ${resp.status}`)
				return null
			}

			const data = (await resp.json()) as {
				data?: Array<{ embedding: number[] }>
			}

			const embedding = data.data?.[0]?.embedding
			if (!embedding) return null

			return new Float32Array(embedding)
		} catch (err) {
			logger.warn('embeddings', 'OpenRouter embedding failed', {
				error: err instanceof Error ? err.message : String(err),
			})
			return null
		}
	}

	async embedBatch(inputs: EmbeddingInput[], taskType?: EmbeddingTaskType): Promise<(Float32Array | null)[]> {
		// OpenRouter supports batch text input
		const textInputs = inputs.filter((i) => i.type === 'text')
		if (textInputs.length === inputs.length && textInputs.length > 0) {
			return this.embedBatchText(textInputs as Array<{ type: 'text'; content: string }>, taskType)
		}
		// Fallback: embed one by one for mixed inputs
		return Promise.all(inputs.map((i) => this.embed(i, taskType)))
	}

	private async embedBatchText(
		inputs: Array<{ type: 'text'; content: string }>,
		_taskType?: EmbeddingTaskType,
	): Promise<(Float32Array | null)[]> {
		const apiKey = process.env.OPENROUTER_API_KEY
		if (!apiKey) return inputs.map(() => null)

		try {
			const resp = await fetch('https://openrouter.ai/api/v1/embeddings', {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${apiKey}`,
					'Content-Type': 'application/json',
					'HTTP-Referer': 'https://questpie.com',
					'X-Title': 'QuestPie Autopilot',
				},
				body: JSON.stringify({
					model: this.model,
					input: inputs.map((i) => i.content),
				}),
				signal: AbortSignal.timeout(60_000),
			})

			if (!resp.ok) return inputs.map(() => null)

			const data = (await resp.json()) as {
				data?: Array<{ embedding: number[]; index: number }>
			}

			const results: (Float32Array | null)[] = new Array(inputs.length).fill(null)
			for (const item of data.data ?? []) {
				if (item.index < results.length) {
					results[item.index] = new Float32Array(item.embedding)
				}
			}
			return results
		} catch {
			return inputs.map(() => null)
		}
	}

	private buildRequest(input: EmbeddingInput): Record<string, unknown> | null {
		switch (input.type) {
			case 'text':
				return { model: this.model, input: input.content }
			case 'image':
				// Multimodal: send as base64 image
				return {
					model: this.model,
					input: [{
						type: 'image_url',
						image_url: {
							url: `data:${input.mimeType};base64,${input.data.toString('base64')}`,
						},
					}],
				}
			default:
				// PDF/file not directly supported, return null
				return null
		}
	}
}
