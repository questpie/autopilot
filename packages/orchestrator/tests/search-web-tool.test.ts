/**
 * Web search tool tests — createSearchWebTool with mocked fetch.
 *
 * Tests error handling, API key requirement, response parsing,
 * and URL citation formatting.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import type { ToolContext } from '../src/agent/tools'
import { createSearchWebTool } from '../src/agent/tools/search-web'
import { OpenRouterAIProvider } from '../src/ai/openrouter-provider'

const originalFetch = globalThis.fetch

function makeCtx(): ToolContext {
	return { companyRoot: '/tmp', agentId: 'test', storage: {} as any, eventBus: {} as any }
}

function makeProvider(apiKey: string) {
	return new OpenRouterAIProvider({ apiKey })
}

beforeEach(() => {})

afterEach(() => {
	globalThis.fetch = originalFetch
})

describe('search_web tool', () => {
	test('returns error when OPENROUTER_API_KEY is not set', async () => {
		const tool = createSearchWebTool(makeProvider(''))
		const result = await tool.execute({ query: 'test' }, makeCtx())
		expect(result.isError).toBe(true)
		expect(result.content[0]?.text).toContain('API key')
	})

	test('makes request to OpenRouter with correct headers', async () => {
		let capturedHeaders: Record<string, string> = {}
		globalThis.fetch = (async (_url: unknown, opts: unknown) => {
			const h = (opts as RequestInit).headers as Record<string, string>
			capturedHeaders = h
			return new Response(JSON.stringify({ choices: [{ message: { content: 'Results' } }] }), {
				status: 200,
			})
		}) as typeof fetch

		const tool = createSearchWebTool(makeProvider('sk-test-key'))
		await tool.execute({ query: 'test query' }, makeCtx())

		expect(capturedHeaders['Authorization']).toBe('Bearer sk-test-key')
		expect(capturedHeaders['X-Title']).toBe('QUESTPIE Autopilot')
	})

	test('sends correct model and query in request body', async () => {
		let capturedBody: Record<string, unknown> = {}
		globalThis.fetch = (async (_url: unknown, opts: unknown) => {
			capturedBody = JSON.parse((opts as RequestInit).body as string)
			return new Response(JSON.stringify({ choices: [{ message: { content: 'OK' } }] }), {
				status: 200,
			})
		}) as typeof fetch

		const tool = createSearchWebTool(makeProvider('sk-test-key'))
		await tool.execute({ query: 'TypeScript best practices' }, makeCtx())

		expect(capturedBody.model).toBe('openai/gpt-4o-mini:online')
		expect((capturedBody.messages as any[])[0].content).toContain('TypeScript best practices')
	})

	test('returns raw content when no annotations', async () => {
		globalThis.fetch = (async () =>
			new Response(
				JSON.stringify({
					choices: [{ message: { content: 'Here are the search results about TypeScript.' } }],
				}),
				{ status: 200 },
			)) as typeof fetch

		const tool = createSearchWebTool(makeProvider('sk-test-key'))
		const result = await tool.execute({ query: 'TypeScript' }, makeCtx())

		expect(result.isError).toBeFalsy()
		expect(result.content[0]?.text).toContain('TypeScript')
	})

	test('formats URL citations when present', async () => {
		globalThis.fetch = (async () =>
			new Response(
				JSON.stringify({
					choices: [
						{
							message: {
								content: 'Search results',
								annotations: [
									{
										type: 'url_citation',
										url_citation: {
											url: 'https://example.com/article',
											title: 'TypeScript Guide',
											content: 'A comprehensive guide to TypeScript.',
										},
									},
									{
										type: 'url_citation',
										url_citation: {
											url: 'https://docs.example.com',
											title: 'Official Docs',
											content: 'Documentation for TypeScript features.',
										},
									},
								],
							},
						},
					],
				}),
				{ status: 200 },
			)) as typeof fetch

		const tool = createSearchWebTool(makeProvider('sk-test-key'))
		const result = await tool.execute({ query: 'TypeScript' }, makeCtx())

		expect(result.isError).toBeFalsy()
		const text = result.content[0]?.text!
		expect(text).toContain('TypeScript Guide')
		expect(text).toContain('https://example.com/article')
		expect(text).toContain('Official Docs')
	})

	test('respects max_results parameter', async () => {
		let capturedBody: Record<string, unknown> = {}
		globalThis.fetch = (async (_url: unknown, opts: unknown) => {
			capturedBody = JSON.parse((opts as RequestInit).body as string)
			return new Response(JSON.stringify({ choices: [{ message: { content: 'OK' } }] }), {
				status: 200,
			})
		}) as typeof fetch

		const tool = createSearchWebTool(makeProvider('sk-test-key'))
		await tool.execute({ query: 'test', max_results: 10 }, makeCtx())

		expect((capturedBody.messages as any[])[0].content).toContain('10')
	})

	test('handles HTTP error response', async () => {
		globalThis.fetch = (async () =>
			new Response('Rate limit exceeded', { status: 429 })) as typeof fetch

		const tool = createSearchWebTool(makeProvider('sk-test-key'))
		const result = await tool.execute({ query: 'test' }, makeCtx())

		expect(result.isError).toBe(true)
		expect(result.content[0]?.text).toContain('429')
	})

	test('handles fetch error (network failure)', async () => {
		globalThis.fetch = (async () => {
			throw new Error('ECONNREFUSED')
		}) as typeof fetch

		const tool = createSearchWebTool(makeProvider('sk-test-key'))
		const result = await tool.execute({ query: 'test' }, makeCtx())

		expect(result.isError).toBe(true)
		expect(result.content[0]?.text).toContain('ECONNREFUSED')
	})

	test('returns fallback text when response has no content', async () => {
		globalThis.fetch = (async () =>
			new Response(JSON.stringify({ choices: [{ message: {} }] }), { status: 200 })) as typeof fetch

		const tool = createSearchWebTool(makeProvider('sk-test-key'))
		const result = await tool.execute({ query: 'test' }, makeCtx())

		expect(result.isError).toBeFalsy()
		expect(result.content[0]?.text).toBe('No search results found.')
	})

	test('handles empty choices array', async () => {
		globalThis.fetch = (async () =>
			new Response(JSON.stringify({ choices: [] }), { status: 200 })) as typeof fetch

		const tool = createSearchWebTool(makeProvider('sk-test-key'))
		const result = await tool.execute({ query: 'test' }, makeCtx())

		expect(result.isError).toBeFalsy()
		expect(result.content[0]?.text).toBe('No search results found.')
	})

	test('tool name is search_web', () => {
		const tool = createSearchWebTool('/tmp')
		expect(tool.name).toBe('web_search')
	})

	test('tool schema validates correct input', () => {
		const tool = createSearchWebTool('/tmp')
		const parsed = tool.schema.safeParse({ query: 'test query' })
		expect(parsed.success).toBe(true)
	})

	test('tool schema validates with optional max_results', () => {
		const tool = createSearchWebTool('/tmp')
		const parsed = tool.schema.safeParse({ query: 'test', max_results: 3 })
		expect(parsed.success).toBe(true)
	})

	test('tool schema rejects missing query', () => {
		const tool = createSearchWebTool('/tmp')
		const parsed = tool.schema.safeParse({})
		expect(parsed.success).toBe(false)
	})
})
