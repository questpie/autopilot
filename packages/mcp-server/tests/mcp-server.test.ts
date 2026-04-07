/**
 * MCP server tests — all functional, no source-reading.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerTools } from '../src/tools'

async function loadApiClient() {
	return import(`../src/api-client.ts?cacheBust=${Date.now()}-${Math.random()}`)
}

// ─── MCP server scaffold ────────────────────────────────────────────────────

describe('MCP server scaffold', () => {
	test('McpServer can be instantiated', () => {
		expect(new McpServer({ name: 'test', version: '1.0.0' })).toBeDefined()
	})

	test('registerTools does not throw', () => {
		const server = new McpServer({ name: 'test', version: '1.0.0' })
		expect(() => registerTools(server)).not.toThrow()
	})
})

// ─── API client ─────────────────────────────────────────────────────────────

describe('API client', () => {
	const originalFetch = globalThis.fetch

	afterEach(() => {
		globalThis.fetch = originalFetch
		delete process.env.AUTOPILOT_API_URL
	})

	test('getBaseUrl returns default', () => {
		delete process.env.AUTOPILOT_API_URL
		return loadApiClient().then(({ getBaseUrl }) => {
			expect(getBaseUrl()).toBe('http://localhost:7778')
		})
	})

	test('getBaseUrl reads env', async () => {
		const child = Bun.spawnSync(
			['bun', '-e', "import { getBaseUrl } from './src/api-client.ts'; console.log(getBaseUrl())"],
			{
				cwd: import.meta.dir + '/..',
				env: { ...process.env, AUTOPILOT_API_URL: 'http://custom:9999' },
				stdout: 'pipe',
				stderr: 'pipe',
			},
		)

		expect(child.exitCode).toBe(0)
		expect(child.stdout.toString().trim()).toBe('http://custom:9999')
	})

	test('apiGet throws on 404', async () => {
		const { apiGet } = await loadApiClient()
		globalThis.fetch = (async () => new Response('Not Found', { status: 404 })) as typeof fetch
		await expect(apiGet('/api/x')).rejects.toThrow('API 404')
	})

	test('apiPost throws on 500', async () => {
		const { apiPost } = await loadApiClient()
		globalThis.fetch = (async () => new Response('Error', { status: 500 })) as typeof fetch
		await expect(apiPost('/api/x', {})).rejects.toThrow('API 500')
	})

	test('apiGet returns parsed JSON', async () => {
		const { apiGet } = await loadApiClient()
		globalThis.fetch = (async () =>
			new Response('{"ok":true}', {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			})) as typeof fetch
		expect(await apiGet('/api/status')).toEqual({ ok: true })
	})

	test('apiPost sends JSON body', async () => {
		const { apiPost } = await loadApiClient()
		let body: string | null = null
		globalThis.fetch = (async (_: unknown, opts: unknown) => {
			body = (opts as RequestInit).body as string
			return new Response('{"id":"1"}', {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			})
		}) as typeof fetch
		await apiPost('/api/tasks', { title: 'Test' })
		expect(body).toBe('{"title":"Test"}')
	})

	test('apiPatch sends PATCH method', async () => {
		const { apiPatch } = await loadApiClient()
		let method: string | null = null
		globalThis.fetch = (async (_: unknown, opts: unknown) => {
			method = (opts as RequestInit).method ?? null
			return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
		}) as typeof fetch
		await apiPatch('/api/tasks/1', {})
		expect(method).toBe('PATCH')
	})

	test('apiDelete sends DELETE method', async () => {
		const { apiDelete } = await loadApiClient()
		let method: string | null = null
		globalThis.fetch = (async (_: unknown, opts: unknown) => {
			method = (opts as RequestInit).method ?? null
			return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
		}) as typeof fetch
		await apiDelete('/api/tasks/1')
		expect(method).toBe('DELETE')
	})

	test('auth header is included when AUTOPILOT_API_KEY is set', async () => {
		const child = Bun.spawnSync(
			[
				'bun',
				'-e',
				`
import { apiGet } from './src/api-client.ts';
let capturedHeaders = {};
globalThis.fetch = async (_, opts) => {
  capturedHeaders = Object.fromEntries(Object.entries(opts?.headers ?? {}));
  return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
};
await apiGet('/api/tasks');
console.log(JSON.stringify(capturedHeaders));
`,
			],
			{
				cwd: import.meta.dir + '/..',
				env: {
					...process.env,
					AUTOPILOT_API_URL: 'http://localhost:7778',
					AUTOPILOT_API_KEY: 'my-secret',
				},
				stdout: 'pipe',
				stderr: 'pipe',
			},
		)

		expect(child.exitCode).toBe(0)
		const headers = JSON.parse(child.stdout.toString().trim())
		expect(headers.Authorization).toBe('Bearer my-secret')
	})
})
