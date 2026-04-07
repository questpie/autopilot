/**
 * MCP server tests — all functional, no source-reading.
 */
import { describe, expect, test } from 'bun:test'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerTools } from '../src/tools'

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

// ─── API client auth headers ────────────────────────────────────────────────

/**
 * Spawns a subprocess that imports the Hono RPC api-client, intercepts fetch
 * to capture the headers the client sends, and prints them as JSON.
 * Env vars must be set on the subprocess (module-level instantiation).
 */
function spawnHeaderCapture(envOverrides: Record<string, string>) {
	return Bun.spawnSync(
		[
			'bun',
			'-e',
			`
import { tasks } from './src/api-client.ts';
let capturedHeaders = {};
globalThis.fetch = async (url, opts) => {
  const h = opts?.headers;
  if (h instanceof Headers) {
    capturedHeaders = Object.fromEntries(h.entries());
  } else if (h && typeof h === 'object') {
    capturedHeaders = Object.fromEntries(
      Object.entries(h).map(([k, v]) => [k.toLowerCase(), v])
    );
  }
  return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
};
await tasks.$get({ query: {} });
console.log(JSON.stringify(capturedHeaders));
`,
		],
		{
			cwd: import.meta.dir + '/..',
			env: {
				...process.env,
				AUTOPILOT_API_URL: 'http://localhost:7778',
				...envOverrides,
			},
			stdout: 'pipe',
			stderr: 'pipe',
		},
	)
}

describe('API client auth headers', () => {
	test('auth header includes Bearer token when AUTOPILOT_API_KEY is set', async () => {
		const child = spawnHeaderCapture({
			AUTOPILOT_API_KEY: 'test-machine-secret',
			AUTOPILOT_LOCAL_DEV: '',
		})

		if (child.exitCode !== 0) {
			console.error('stderr:', child.stderr.toString())
		}
		expect(child.exitCode).toBe(0)
		const headers = JSON.parse(child.stdout.toString().trim())
		expect(headers.authorization).toBe('Bearer test-machine-secret')
	})

	test('local-dev mode sends X-Local-Dev header instead of Bearer', async () => {
		const child = spawnHeaderCapture({
			AUTOPILOT_LOCAL_DEV: 'true',
			AUTOPILOT_API_KEY: 'should-be-ignored',
		})

		if (child.exitCode !== 0) {
			console.error('stderr:', child.stderr.toString())
		}
		expect(child.exitCode).toBe(0)
		const headers = JSON.parse(child.stdout.toString().trim())
		expect(headers['x-local-dev']).toBe('true')
		expect(headers.authorization).toBeUndefined()
	})

	test('no auth headers when neither API key nor local-dev is set', async () => {
		const child = spawnHeaderCapture({
			AUTOPILOT_API_KEY: '',
			AUTOPILOT_LOCAL_DEV: '',
		})

		if (child.exitCode !== 0) {
			console.error('stderr:', child.stderr.toString())
		}
		expect(child.exitCode).toBe(0)
		const headers = JSON.parse(child.stdout.toString().trim())
		expect(headers.authorization).toBeUndefined()
		expect(headers['x-local-dev']).toBeUndefined()
	})
})
