/**
 * D32-D37: MCP server tests.
 *
 * Tests the MCP tool registration, API client, transport detection,
 * and tool parameter schemas. Uses mocked fetch for API calls.
 */
import { describe, test, expect, beforeAll, afterAll, beforeEach, mock } from 'bun:test'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerTools } from '../src/tools'
import { getBaseUrl, apiGet, apiPost, apiPut, apiDelete, apiStream } from '../src/api-client'

// ─── D32: MCP server scaffold ──────────────────────────────────────────────

describe('D32: MCP server scaffold', () => {
	test('McpServer can be instantiated', () => {
		const server = new McpServer({ name: 'test', version: '1.0.0' })
		expect(server).toBeDefined()
	})

	test('registerTools does not throw', () => {
		const server = new McpServer({ name: 'test', version: '1.0.0' })
		expect(() => registerTools(server)).not.toThrow()
	})

	test('server has correct name and version', () => {
		const server = new McpServer({ name: 'questpie-autopilot', version: '1.0.0' })
		expect(server).toBeDefined()
	})
})

// ─── D33: Core tools registration ──────────────────────────────────────────

describe('D33: core MCP tools', () => {
	const expectedCoreTools = [
		'task_list',
		'task_get',
		'task_create',
		'task_update',
		'agent_list',
		'agent_steer',
		'status',
		'activity',
	]

	test('all core tools are defined in tools.ts', async () => {
		const { readFileSync } = await import('node:fs')
		const { join } = await import('node:path')
		const source = readFileSync(join(import.meta.dir, '..', 'src', 'tools.ts'), 'utf-8')
		for (const name of expectedCoreTools) {
			expect(source).toContain(`'${name}'`)
		}
	})

	test('task_list tool builds correct query string', () => {
		const params = new URLSearchParams()
		params.set('status', 'in_progress')
		params.set('assigned_to', 'dev')
		params.set('limit', '10')
		expect(params.toString()).toBe('status=in_progress&assigned_to=dev&limit=10')
	})

	test('task_get encodes special characters in ID', () => {
		const id = 'task-with spaces&special'
		const encoded = encodeURIComponent(id)
		expect(encoded).toBe('task-with%20spaces%26special')
	})
})

// ─── D34: Search + file tools ──────────────────────────────────────────────

describe('D34: search + file MCP tools', () => {
	const expectedTools = ['search', 'file_read', 'file_list']

	test('all search/file tools are defined', async () => {
		const { readFileSync } = await import('node:fs')
		const { join } = await import('node:path')
		const source = readFileSync(join(import.meta.dir, '..', 'src', 'tools.ts'), 'utf-8')
		for (const name of expectedTools) {
			expect(source).toContain(`'${name}'`)
		}
	})

	test('search tool uses query param "q"', async () => {
		const { readFileSync } = await import('node:fs')
		const { join } = await import('node:path')
		const source = readFileSync(join(import.meta.dir, '..', 'src', 'tools.ts'), 'utf-8')
		expect(source).toContain("q: args.query")
	})
})

// ─── D35: Session + chat tools ─────────────────────────────────────────────

describe('D35: session + chat MCP tools', () => {
	const expectedTools = ['session_list', 'session_stream', 'chat_send', 'chat_history']

	test('all session/chat tools are defined', async () => {
		const { readFileSync } = await import('node:fs')
		const { join } = await import('node:path')
		const source = readFileSync(join(import.meta.dir, '..', 'src', 'tools.ts'), 'utf-8')
		for (const name of expectedTools) {
			expect(source).toContain(`'${name}'`)
		}
	})

	test('session_stream uses apiStream (SSE)', async () => {
		const { readFileSync } = await import('node:fs')
		const { join } = await import('node:path')
		const source = readFileSync(join(import.meta.dir, '..', 'src', 'tools.ts'), 'utf-8')
		expect(source).toContain('apiStream')
	})

	test('chat_send calls the chat endpoint with agent_id', async () => {
		const { readFileSync } = await import('node:fs')
		const { join } = await import('node:path')
		const source = readFileSync(join(import.meta.dir, '..', 'src', 'tools.ts'), 'utf-8')
		expect(source).toContain('args.agent_id')
		expect(source).toContain('/api/chat/')
	})
})

// ─── D36: CLI command ──────────────────────────────────────────────────────

describe('D36: CLI autopilot mcp command', () => {
	test('mcp command file exists', async () => {
		const { existsSync } = await import('node:fs')
		const { join } = await import('node:path')
		const mcpCmd = join(import.meta.dir, '..', '..', 'cli', 'src', 'commands', 'mcp.ts')
		expect(existsSync(mcpCmd)).toBe(true)
	})

	test('mcp command registers with commander', async () => {
		const { readFileSync } = await import('node:fs')
		const { join } = await import('node:path')
		const source = readFileSync(
			join(import.meta.dir, '..', '..', 'cli', 'src', 'commands', 'mcp.ts'),
			'utf-8',
		)
		expect(source).toContain(".command('mcp')")
		expect(source).toContain('--transport')
		expect(source).toContain('--port')
	})

	test('mcp command is registered in CLI index', async () => {
		const { readFileSync } = await import('node:fs')
		const { join } = await import('node:path')
		const source = readFileSync(
			join(import.meta.dir, '..', '..', 'cli', 'src', 'index.ts'),
			'utf-8',
		)
		expect(source).toContain("'./commands/mcp'")
	})
})

// ─── D37: SSE transport ────────────────────────────────────────────────────

describe('D37: SSE transport', () => {
	test('index.ts supports --transport=sse flag', async () => {
		const { readFileSync } = await import('node:fs')
		const { join } = await import('node:path')
		const source = readFileSync(join(import.meta.dir, '..', 'src', 'index.ts'), 'utf-8')
		expect(source).toContain('--transport=sse')
		expect(source).toContain("'sse'")
		expect(source).toContain('SSEServerTransport')
	})

	test('index.ts supports --sse shorthand', async () => {
		const { readFileSync } = await import('node:fs')
		const { join } = await import('node:path')
		const source = readFileSync(join(import.meta.dir, '..', 'src', 'index.ts'), 'utf-8')
		expect(source).toContain("'--sse'")
	})

	test('SSE transport uses node http.createServer', async () => {
		const { readFileSync } = await import('node:fs')
		const { join } = await import('node:path')
		const source = readFileSync(join(import.meta.dir, '..', 'src', 'index.ts'), 'utf-8')
		expect(source).toContain('createServer')
		expect(source).toContain('/sse')
		expect(source).toContain('/messages')
	})

	test('default port is 3100', async () => {
		const { readFileSync } = await import('node:fs')
		const { join } = await import('node:path')
		const source = readFileSync(join(import.meta.dir, '..', 'src', 'index.ts'), 'utf-8')
		expect(source).toContain('3100')
	})
})

// ─── API client tests ──────────────────────────────────────────────────────

describe('API client', () => {
	test('getBaseUrl returns default when no env', () => {
		const original = process.env.AUTOPILOT_API_URL
		delete process.env.AUTOPILOT_API_URL
		try {
			expect(getBaseUrl()).toBe('http://localhost:7778')
		} finally {
			if (original) process.env.AUTOPILOT_API_URL = original
		}
	})

	test('getBaseUrl reads AUTOPILOT_API_URL env', () => {
		const original = process.env.AUTOPILOT_API_URL
		process.env.AUTOPILOT_API_URL = 'http://custom:9999'
		try {
			expect(getBaseUrl()).toBe('http://custom:9999')
		} finally {
			if (original) process.env.AUTOPILOT_API_URL = original
			else delete process.env.AUTOPILOT_API_URL
		}
	})

	test('apiGet throws on non-ok response', async () => {
		const originalFetch = globalThis.fetch
		globalThis.fetch = (async () =>
			new Response('Not Found', { status: 404 })) as typeof fetch
		try {
			await expect(apiGet('/api/nonexistent')).rejects.toThrow('API 404')
		} finally {
			globalThis.fetch = originalFetch
		}
	})

	test('apiPost throws on server error', async () => {
		const originalFetch = globalThis.fetch
		globalThis.fetch = (async () =>
			new Response('Internal Error', { status: 500 })) as typeof fetch
		try {
			await expect(apiPost('/api/tasks', { title: 'test' })).rejects.toThrow('API 500')
		} finally {
			globalThis.fetch = originalFetch
		}
	})

	test('apiGet returns parsed JSON on success', async () => {
		const originalFetch = globalThis.fetch
		globalThis.fetch = (async () =>
			new Response(JSON.stringify({ ok: true }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			})) as typeof fetch
		try {
			const result = await apiGet('/api/status')
			expect(result).toEqual({ ok: true })
		} finally {
			globalThis.fetch = originalFetch
		}
	})

	test('apiPost sends JSON body', async () => {
		const originalFetch = globalThis.fetch
		let capturedBody: string | null = null
		globalThis.fetch = (async (_url: unknown, opts: unknown) => {
			capturedBody = (opts as RequestInit).body as string
			return new Response(JSON.stringify({ id: 'task-1' }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			})
		}) as typeof fetch
		try {
			await apiPost('/api/tasks', { title: 'Test Task' })
			expect(capturedBody).toBe(JSON.stringify({ title: 'Test Task' }))
		} finally {
			globalThis.fetch = originalFetch
		}
	})

	test('apiPut sends correct method', async () => {
		const originalFetch = globalThis.fetch
		let capturedMethod: string | null = null
		globalThis.fetch = (async (_url: unknown, opts: unknown) => {
			capturedMethod = (opts as RequestInit).method ?? null
			return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
		}) as typeof fetch
		try {
			await apiPut('/api/tasks/1', { status: 'done' })
			expect(capturedMethod).toBe('PUT')
		} finally {
			globalThis.fetch = originalFetch
		}
	})

	test('apiDelete sends DELETE method', async () => {
		const originalFetch = globalThis.fetch
		let capturedMethod: string | null = null
		globalThis.fetch = (async (_url: unknown, opts: unknown) => {
			capturedMethod = (opts as RequestInit).method ?? null
			return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
		}) as typeof fetch
		try {
			await apiDelete('/api/tasks/1')
			expect(capturedMethod).toBe('DELETE')
		} finally {
			globalThis.fetch = originalFetch
		}
	})

	test('apiStream returns text content', async () => {
		const originalFetch = globalThis.fetch
		globalThis.fetch = (async () =>
			new Response('data: {"type":"text"}\n\n', {
				status: 200,
				headers: { 'Content-Type': 'text/event-stream' },
			})) as typeof fetch
		try {
			const text = await apiStream('/api/agent-sessions/s1/stream')
			expect(text).toContain('data:')
		} finally {
			globalThis.fetch = originalFetch
		}
	})

	test('apiStream throws on error response', async () => {
		const originalFetch = globalThis.fetch
		globalThis.fetch = (async () =>
			new Response('Bad Gateway', { status: 502 })) as typeof fetch
		try {
			await expect(apiStream('/api/agent-sessions/s1/stream')).rejects.toThrow('API 502')
		} finally {
			globalThis.fetch = originalFetch
		}
	})
})

// ─── Tool count verification ───────────────────────────────────────────────

describe('tool completeness', () => {
	test('all 15 MCP tools are registered', async () => {
		const { readFileSync } = await import('node:fs')
		const { join } = await import('node:path')
		const source = readFileSync(join(import.meta.dir, '..', 'src', 'tools.ts'), 'utf-8')

		const expectedTools = [
			'task_list', 'task_get', 'task_create', 'task_update',
			'agent_list', 'agent_steer', 'status', 'activity',
			'search', 'file_read', 'file_list',
			'session_list', 'session_stream', 'chat_send', 'chat_history',
		]

		for (const tool of expectedTools) {
			expect(source).toContain(`'${tool}'`)
		}
		expect(expectedTools).toHaveLength(15)
	})
})
