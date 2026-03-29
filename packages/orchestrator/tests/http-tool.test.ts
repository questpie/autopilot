/**
 * D7: Functional tests for the HTTP fetch tool.
 *
 * Tests Zod secret schema validation, allowlist enforcement, SSRF protection,
 * and HTTP request execution with mocked fetch.
 */
import { describe, test, expect, afterEach, beforeAll, afterAll } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { stringify as stringifyYaml } from 'yaml'
import { createHttpTool } from '../src/agent/tools/http'
import type { ToolContext } from '../src/agent/tools'

let companyRoot: string
const originalFetch = globalThis.fetch

beforeAll(async () => {
	companyRoot = await mkdtemp(join(tmpdir(), 'http-tool-test-'))
	await mkdir(join(companyRoot, 'secrets'), { recursive: true })
})

afterAll(async () => {
	globalThis.fetch = originalFetch
	await rm(companyRoot, { recursive: true, force: true })
})

afterEach(() => {
	globalThis.fetch = originalFetch
})

function makeCtx(agentId = 'developer'): ToolContext {
	return { companyRoot, agentId, storage: {} as any, eventBus: {} as any }
}

// ─── D7: Secret schema validation ──────────────────────────────────────────

describe('D7: Zod secret validation', () => {
	test('loads valid secret and injects Authorization header', async () => {
		await writeFile(
			join(companyRoot, 'secrets', 'github.yaml'),
			stringifyYaml({ api_key: 'ghp_test123', allowed_agents: ['developer'] }),
		)

		// Mock fetch to capture headers
		let capturedHeaders: Record<string, string> = {}
		globalThis.fetch = (async (_url: unknown, opts: unknown) => {
			const h = (opts as RequestInit).headers as Record<string, string>
			capturedHeaders = h
			return new Response('OK', { status: 200 })
		}) as typeof fetch

		const tool = createHttpTool(companyRoot)
		const result = await tool.execute(
			{ method: 'GET', url: 'https://api.github.com/user', secret_ref: 'github' },
			makeCtx('developer'),
		)

		expect(result.isError).toBeFalsy()
		expect(capturedHeaders['Authorization']).toBe('Bearer ghp_test123')
	})

	test('blocks agent not in allowed_agents list', async () => {
		await writeFile(
			join(companyRoot, 'secrets', 'restricted.yaml'),
			stringifyYaml({ api_key: 'sk-secret', allowed_agents: ['devops'] }),
		)

		const tool = createHttpTool(companyRoot)
		const result = await tool.execute(
			{ method: 'GET', url: 'https://example.com', secret_ref: 'restricted' },
			makeCtx('developer'), // developer is NOT in allowed_agents
		)

		expect(result.isError).toBe(true)
		expect(result.content[0]?.text).toContain('not allowed to use secret')
	})

	test('allows agent when allowed_agents is not set', async () => {
		await writeFile(
			join(companyRoot, 'secrets', 'open.yaml'),
			stringifyYaml({ api_key: 'sk-open' }),
		)

		let called = false
		globalThis.fetch = (async () => {
			called = true
			return new Response('OK', { status: 200 })
		}) as typeof fetch

		const tool = createHttpTool(companyRoot)
		const result = await tool.execute(
			{ method: 'GET', url: 'https://example.com', secret_ref: 'open' },
			makeCtx('any-agent'),
		)

		expect(result.isError).toBeFalsy()
		expect(called).toBe(true)
	})

	test('returns error for missing secret file', async () => {
		const tool = createHttpTool(companyRoot)
		const result = await tool.execute(
			{ method: 'GET', url: 'https://example.com', secret_ref: 'nonexistent' },
			makeCtx(),
		)

		expect(result.isError).toBe(true)
		expect(result.content[0]?.text).toContain('Failed to load secret')
	})

	test('returns error for malformed secret YAML (missing required shape)', async () => {
		// Write invalid YAML content that won't parse
		await writeFile(join(companyRoot, 'secrets', 'bad.yaml'), 'not: valid: yaml: : :')

		const tool = createHttpTool(companyRoot)
		const result = await tool.execute(
			{ method: 'GET', url: 'https://example.com', secret_ref: 'bad' },
			makeCtx(),
		)

		expect(result.isError).toBe(true)
		expect(result.content[0]?.text).toContain('Failed to load secret')
	})

	test('passthrough allows extra fields in secret', async () => {
		await writeFile(
			join(companyRoot, 'secrets', 'extra.yaml'),
			stringifyYaml({ api_key: 'sk-extra', custom_header: 'X-Custom', webhook_url: 'https://hooks.example.com' }),
		)

		globalThis.fetch = (async () => new Response('OK', { status: 200 })) as typeof fetch

		const tool = createHttpTool(companyRoot)
		const result = await tool.execute(
			{ method: 'GET', url: 'https://example.com', secret_ref: 'extra' },
			makeCtx(),
		)

		// Should not error — passthrough accepts extra fields
		expect(result.isError).toBeFalsy()
	})
})

// ─── Allowlist enforcement ─────────────────────────────────────────────────

describe('HTTP allowlist', () => {
	test('blocks hostname not in allowlist', async () => {
		const tool = createHttpTool(companyRoot, { httpAllowlist: ['api.github.com'] })
		const result = await tool.execute(
			{ method: 'GET', url: 'https://evil.com/data' },
			makeCtx(),
		)

		expect(result.isError).toBe(true)
		expect(result.content[0]?.text).toContain('not in the allowed list')
	})

	test('allows hostname in allowlist', async () => {
		globalThis.fetch = (async () => new Response('OK', { status: 200 })) as typeof fetch

		const tool = createHttpTool(companyRoot, { httpAllowlist: ['api.github.com'] })
		const result = await tool.execute(
			{ method: 'GET', url: 'https://api.github.com/repos' },
			makeCtx(),
		)

		expect(result.isError).toBeFalsy()
	})

	test('returns error for invalid URL', async () => {
		const tool = createHttpTool(companyRoot, { httpAllowlist: ['example.com'] })
		const result = await tool.execute(
			{ method: 'GET', url: 'not-a-url' },
			makeCtx(),
		)

		expect(result.isError).toBe(true)
		expect(result.content[0]?.text).toContain('invalid URL')
	})

	test('skips allowlist check when empty', async () => {
		globalThis.fetch = (async () => new Response('data', { status: 200 })) as typeof fetch

		const tool = createHttpTool(companyRoot, { httpAllowlist: [] })
		const result = await tool.execute(
			{ method: 'GET', url: 'https://anywhere.com' },
			makeCtx(),
		)

		expect(result.isError).toBeFalsy()
	})
})

// ─── HTTP execution ────────────────────────────────────────────────────────

describe('HTTP execution', () => {
	test('returns HTTP status and body', async () => {
		globalThis.fetch = (async () =>
			new Response('{"result":"ok"}', { status: 200 })
		) as typeof fetch

		const tool = createHttpTool(companyRoot)
		const result = await tool.execute(
			{ method: 'GET', url: 'https://example.com/data' },
			makeCtx(),
		)

		expect(result.isError).toBeFalsy()
		expect(result.content[0]?.text).toContain('HTTP 200')
		expect(result.content[0]?.text).toContain('"result":"ok"')
	})

	test('sends POST body as JSON', async () => {
		let capturedBody: string | null = null
		globalThis.fetch = (async (_url: unknown, opts: unknown) => {
			capturedBody = (opts as RequestInit).body as string
			return new Response('created', { status: 201 })
		}) as typeof fetch

		const tool = createHttpTool(companyRoot)
		await tool.execute(
			{ method: 'POST', url: 'https://example.com/items', body: { name: 'test' } },
			makeCtx(),
		)

		expect(capturedBody).toBe(JSON.stringify({ name: 'test' }))
	})

	test('handles fetch errors gracefully', async () => {
		globalThis.fetch = (async () => {
			throw new Error('ECONNREFUSED')
		}) as typeof fetch

		// Use example.com which resolves (passes SSRF) but our mocked fetch throws
		const tool = createHttpTool(companyRoot)
		const result = await tool.execute(
			{ method: 'GET', url: 'https://example.com/fail' },
			makeCtx(),
		)

		expect(result.isError).toBe(true)
		expect(result.content[0]?.text).toContain('HTTP request failed')
		expect(result.content[0]?.text).toContain('ECONNREFUSED')
	})

	test('does not send body for GET requests', async () => {
		let capturedBody: unknown = 'NOT_CHECKED'
		globalThis.fetch = (async (_url: unknown, opts: unknown) => {
			capturedBody = (opts as RequestInit).body
			return new Response('ok', { status: 200 })
		}) as typeof fetch

		const tool = createHttpTool(companyRoot)
		await tool.execute(
			{ method: 'GET', url: 'https://example.com/data', body: { ignored: true } },
			makeCtx(),
		)

		expect(capturedBody).toBeUndefined()
	})
})
