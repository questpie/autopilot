/**
 * MCP server tests — all functional, no source-reading.
 */
import { describe, test, expect, afterEach } from 'bun:test'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerTools } from '../src/tools'
import { getBaseUrl, apiGet, apiPost, apiPut, apiDelete, apiStream } from '../src/api-client'

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
		expect(getBaseUrl()).toBe('http://localhost:7778')
	})

	test('getBaseUrl reads env', () => {
		process.env.AUTOPILOT_API_URL = 'http://custom:9999'
		expect(getBaseUrl()).toBe('http://custom:9999')
	})

	test('apiGet throws on 404', async () => {
		globalThis.fetch = (async () => new Response('Not Found', { status: 404 })) as typeof fetch
		await expect(apiGet('/api/x')).rejects.toThrow('API 404')
	})

	test('apiPost throws on 500', async () => {
		globalThis.fetch = (async () => new Response('Error', { status: 500 })) as typeof fetch
		await expect(apiPost('/api/x', {})).rejects.toThrow('API 500')
	})

	test('apiGet returns parsed JSON', async () => {
		globalThis.fetch = (async () => new Response('{"ok":true}', { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch
		expect(await apiGet('/api/status')).toEqual({ ok: true })
	})

	test('apiPost sends JSON body', async () => {
		let body: string | null = null
		globalThis.fetch = (async (_: unknown, opts: unknown) => {
			body = (opts as RequestInit).body as string
			return new Response('{"id":"1"}', { status: 200, headers: { 'Content-Type': 'application/json' } })
		}) as typeof fetch
		await apiPost('/api/tasks', { title: 'Test' })
		expect(body).toBe('{"title":"Test"}')
	})

	test('apiPut sends PUT method', async () => {
		let method: string | null = null
		globalThis.fetch = (async (_: unknown, opts: unknown) => {
			method = (opts as RequestInit).method ?? null
			return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
		}) as typeof fetch
		await apiPut('/api/tasks/1', {})
		expect(method).toBe('PUT')
	})

	test('apiDelete sends DELETE method', async () => {
		let method: string | null = null
		globalThis.fetch = (async (_: unknown, opts: unknown) => {
			method = (opts as RequestInit).method ?? null
			return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
		}) as typeof fetch
		await apiDelete('/api/tasks/1')
		expect(method).toBe('DELETE')
	})

	test('apiStream returns text', async () => {
		globalThis.fetch = (async () => new Response('data: {"type":"text"}\n\n', { status: 200 })) as typeof fetch
		const text = await apiStream('/api/agent-sessions/s1/stream')
		expect(text).toContain('data:')
	})

	test('apiStream throws on error', async () => {
		globalThis.fetch = (async () => new Response('Bad Gateway', { status: 502 })) as typeof fetch
		await expect(apiStream('/api/x')).rejects.toThrow('API 502')
	})
})
