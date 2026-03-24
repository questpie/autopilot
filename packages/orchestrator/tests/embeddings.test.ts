import { describe, test, expect, mock } from 'bun:test'
import type {
	EmbeddingProvider,
	EmbeddingInput,
	EmbeddingModality,
	EmbeddingTaskType,
} from '../src/embeddings/provider'
import { NoneEmbeddingProvider } from '../src/embeddings/none-provider'
import { EmbeddingService, createEmbeddingService } from '../src/embeddings'

// ─── Mock Provider ───────────────────────────────────────────────────────

class MockProvider implements EmbeddingProvider {
	name: string
	dimensions: number
	supportedModalities: Set<EmbeddingModality>
	shouldFail: boolean
	embedCallCount = 0

	constructor(opts: {
		name: string
		dimensions: number
		modalities: EmbeddingModality[]
		shouldFail?: boolean
	}) {
		this.name = opts.name
		this.dimensions = opts.dimensions
		this.supportedModalities = new Set(opts.modalities)
		this.shouldFail = opts.shouldFail ?? false
	}

	supports(modality: EmbeddingModality): boolean {
		return this.supportedModalities.has(modality)
	}

	async embed(input: EmbeddingInput, _taskType?: EmbeddingTaskType): Promise<Float32Array | null> {
		this.embedCallCount++
		if (this.shouldFail) return null
		return new Float32Array(this.dimensions).fill(0.5)
	}

	async embedBatch(inputs: EmbeddingInput[], taskType?: EmbeddingTaskType): Promise<(Float32Array | null)[]> {
		return Promise.all(inputs.map((i) => this.embed(i, taskType)))
	}
}

// ─── NoneProvider Tests ──────────────────────────────────────────────────

describe('NoneEmbeddingProvider', () => {
	test('embed returns null', async () => {
		const provider = new NoneEmbeddingProvider()
		const result = await provider.embed({ type: 'text', content: 'hello' })
		expect(result).toBeNull()
	})

	test('supports returns false for all modalities', () => {
		const provider = new NoneEmbeddingProvider()
		expect(provider.supports('text')).toBe(false)
		expect(provider.supports('image')).toBe(false)
		expect(provider.supports('pdf')).toBe(false)
		expect(provider.supports('video')).toBe(false)
		expect(provider.supports('audio')).toBe(false)
	})

	test('embedBatch returns array of nulls', async () => {
		const provider = new NoneEmbeddingProvider()
		const results = await provider.embedBatch([
			{ type: 'text', content: 'a' },
			{ type: 'text', content: 'b' },
		])
		expect(results).toEqual([null, null])
	})

	test('dimensions is 0', () => {
		const provider = new NoneEmbeddingProvider()
		expect(provider.dimensions).toBe(0)
	})
})

// ─── EmbeddingService Tests ──────────────────────────────────────────────

describe('EmbeddingService', () => {
	test('uses primary provider when it supports the modality', async () => {
		const primary = new MockProvider({ name: 'primary', dimensions: 768, modalities: ['text'] })
		const fallback = new MockProvider({ name: 'fallback', dimensions: 384, modalities: ['text'] })
		const service = new EmbeddingService(primary, fallback)

		const result = await service.embedText('hello')
		expect(result).not.toBeNull()
		expect(result!.length).toBe(768)
		expect(primary.embedCallCount).toBe(1)
		expect(fallback.embedCallCount).toBe(0)
	})

	test('falls back when primary fails', async () => {
		const primary = new MockProvider({ name: 'primary', dimensions: 768, modalities: ['text'], shouldFail: true })
		const fallback = new MockProvider({ name: 'fallback', dimensions: 384, modalities: ['text'] })
		const service = new EmbeddingService(primary, fallback)

		const result = await service.embedText('hello')
		expect(result).not.toBeNull()
		expect(result!.length).toBe(384)
		expect(primary.embedCallCount).toBe(1)
		expect(fallback.embedCallCount).toBe(1)
	})

	test('falls back when primary does not support modality', async () => {
		const primary = new MockProvider({ name: 'primary', dimensions: 768, modalities: ['image'] })
		const fallback = new MockProvider({ name: 'fallback', dimensions: 384, modalities: ['text'] })
		const service = new EmbeddingService(primary, fallback)

		const result = await service.embedText('hello')
		expect(result).not.toBeNull()
		expect(primary.embedCallCount).toBe(0)
		expect(fallback.embedCallCount).toBe(1)
	})

	test('returns null when both primary and fallback fail', async () => {
		const primary = new MockProvider({ name: 'primary', dimensions: 768, modalities: ['text'], shouldFail: true })
		const fallback = new MockProvider({ name: 'fallback', dimensions: 384, modalities: ['text'], shouldFail: true })
		const service = new EmbeddingService(primary, fallback)

		const result = await service.embedText('hello')
		expect(result).toBeNull()
	})

	test('returns null when no provider supports modality', async () => {
		const primary = new MockProvider({ name: 'primary', dimensions: 768, modalities: ['image'] })
		const service = new EmbeddingService(primary)

		const result = await service.embedText('hello')
		expect(result).toBeNull()
	})

	test('embedQuery uses retrieval_query task type', async () => {
		let capturedTaskType: EmbeddingTaskType | undefined
		const primary = new MockProvider({ name: 'primary', dimensions: 768, modalities: ['text'] })
		const originalEmbed = primary.embed.bind(primary)
		primary.embed = async (input, taskType) => {
			capturedTaskType = taskType
			return originalEmbed(input, taskType)
		}

		const service = new EmbeddingService(primary)
		await service.embedQuery('search query')
		expect(capturedTaskType).toBe('retrieval_query')
	})

	test('embedText defaults to retrieval_document', async () => {
		let capturedTaskType: EmbeddingTaskType | undefined
		const primary = new MockProvider({ name: 'primary', dimensions: 768, modalities: ['text'] })
		const originalEmbed = primary.embed.bind(primary)
		primary.embed = async (input, taskType) => {
			capturedTaskType = taskType
			return originalEmbed(input, taskType)
		}

		const service = new EmbeddingService(primary)
		await service.embedText('document content')
		expect(capturedTaskType).toBe('retrieval_document')
	})

	test('embedImage sends image input', async () => {
		const primary = new MockProvider({ name: 'primary', dimensions: 768, modalities: ['image'] })
		const service = new EmbeddingService(primary)

		const data = Buffer.from('fake-image-data')
		const result = await service.embedImage(data, 'image/png')
		expect(result).not.toBeNull()
		expect(primary.embedCallCount).toBe(1)
	})

	test('providerName and dimensions reflect primary', () => {
		const primary = new MockProvider({ name: 'test-provider', dimensions: 512, modalities: ['text'] })
		const service = new EmbeddingService(primary)
		expect(service.providerName).toBe('test-provider')
		expect(service.dimensions).toBe(512)
	})
})

// ─── createEmbeddingService Tests ────────────────────────────────────────

describe('createEmbeddingService', () => {
	test('returns none provider when no config', async () => {
		const service = await createEmbeddingService()
		expect(service.providerName).toBe('none')
		expect(service.dimensions).toBe(0)
	})

	test('returns none provider when provider is none', async () => {
		const service = await createEmbeddingService({ provider: 'none' })
		expect(service.providerName).toBe('none')
	})

	test('none service embed returns null', async () => {
		const service = await createEmbeddingService({ provider: 'none' })
		const result = await service.embedText('hello')
		expect(result).toBeNull()
	})
})
