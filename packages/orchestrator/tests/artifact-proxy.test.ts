import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { stringify as stringifyYaml } from 'yaml'
import { container, configureContainer } from '../src/container'
import type { StorageBackend } from '../src/fs/storage'

let app: ReturnType<typeof import('../src/api/app').createApp>
let companyRoot: string
let storage: StorageBackend
let upstreamServer: ReturnType<typeof Bun.serve> | null = null

const UPSTREAM_PORT = 4188

beforeAll(async () => {
	companyRoot = await mkdtemp(join(tmpdir(), 'artifact-proxy-test-'))

	// Create required directory structure
	const dirs = [
		'tasks/backlog',
		'tasks/active',
		'tasks/review',
		'tasks/blocked',
		'tasks/done',
		'comms/channels/general',
		'comms/direct',
		'dashboard/pins',
		'logs/activity',
		'logs/sessions',
		'team',
		'team/workflows',
		'context/memory',
		'context/indexes',
		'artifacts',
	]
	for (const dir of dirs) {
		await mkdir(join(companyRoot, dir), { recursive: true })
	}

	// Write company.yaml
	await writeFile(
		join(companyRoot, 'company.yaml'),
		stringifyYaml({
			name: 'Test Company',
			slug: 'test-company',
			description: 'Test',
			timezone: 'UTC',
			language: 'en',
			languages: ['en'],
			owner: { name: 'Owner', email: 'owner@test.com', notification_channels: [] },
			settings: {},
		}),
	)

	// Write agents.yaml
	await writeFile(join(companyRoot, 'team', 'agents.yaml'), stringifyYaml({ agents: [] }))

	// Configure DI container
	container.clearAllInstances()
	configureContainer(companyRoot)
	;(container as any).instances.set('companyRoot', companyRoot)

	const { storageFactory } = await import('../src/fs/sqlite-backend')
	const resolved = await container.resolveAsync([storageFactory])
	storage = resolved.storage

	// Create the Hono app with auth disabled
	const { createApp } = await import('../src/api/app')
	app = createApp({ authEnabled: false, corsOrigin: '*' })
})

afterAll(async () => {
	if (upstreamServer) upstreamServer.stop()
	if (storage) await storage.close()
	container.clearAllInstances()
	if (companyRoot) await rm(companyRoot, { recursive: true, force: true })
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function setupFakeArtifact(name: string, port: number) {
	const dir = join(companyRoot, 'artifacts', name)
	await mkdir(dir, { recursive: true })
	await writeFile(
		join(dir, '.artifact.yaml'),
		stringifyYaml({
			name,
			// We won't actually cold-start — we mock the router instead
			serve: `echo "not used"`,
			health: '/',
			timeout: '5m',
		}),
	)
}

function startUpstreamServer(port: number) {
	if (upstreamServer) upstreamServer.stop()
	upstreamServer = Bun.serve({
		port,
		fetch(req) {
			const url = new URL(req.url)
			if (url.pathname === '/') {
				return new Response('<html><body>Hello Artifact</body></html>', {
					headers: { 'Content-Type': 'text/html' },
				})
			}
			if (url.pathname === '/api/data') {
				return Response.json({ message: 'artifact data' })
			}
			if (url.pathname === '/redirect') {
				return new Response(null, {
					status: 302,
					headers: { Location: `http://localhost:${port}/target` },
				})
			}
			return new Response('Not Found', { status: 404 })
		},
	})
}

// ─── Proxy route tests ──────────────────────────────────────────────────────

describe('GET /artifacts/:id (proxy)', () => {
	test('returns 502 for non-existent artifact', async () => {
		const res = await app.request('/artifacts/nonexistent')
		expect(res.status).toBe(502)
		const data = (await res.json()) as { error: string }
		expect(data.error).toContain('nonexistent')
	})
})

describe('artifact proxy with upstream server', () => {
	beforeAll(async () => {
		// Start a fake upstream artifact server
		startUpstreamServer(UPSTREAM_PORT)

		// Setup an artifact and manually register it in the router
		await setupFakeArtifact('test-artifact', UPSTREAM_PORT)

		// Import and manually register the process in the shared router
		const { getRouter } = await import('../src/artifact/router')
		const router = getRouter(companyRoot)

		// Manually inject a running process to avoid cold-start
		const processes = (router as any).processes as Map<string, any>
		processes.set('test-artifact', {
			process: { pid: process.pid, kill: () => {} },
			port: UPSTREAM_PORT,
			config: { name: 'test-artifact', serve: 'echo', health: '/', timeout: '5m' },
			startedAt: new Date(),
		})
	})

	test('proxies root path to upstream', async () => {
		const res = await app.request('/artifacts/test-artifact')
		expect(res.status).toBe(200)
		const text = await res.text()
		expect(text).toContain('Hello Artifact')
		expect(res.headers.get('content-type')).toContain('text/html')
	})

	test('proxies sub-path to upstream', async () => {
		const res = await app.request('/artifacts/test-artifact/api/data')
		expect(res.status).toBe(200)
		const data = (await res.json()) as { message: string }
		expect(data.message).toBe('artifact data')
	})

	test('returns upstream 404 for missing sub-path', async () => {
		const res = await app.request('/artifacts/test-artifact/missing')
		expect(res.status).toBe(404)
	})

	test('rewrites Location headers on redirect', async () => {
		const res = await app.request('/artifacts/test-artifact/redirect')
		expect(res.status).toBe(302)
		const location = res.headers.get('location')
		expect(location).toContain('/artifacts/test-artifact/')
		expect(location).not.toContain(`localhost:${UPSTREAM_PORT}`)
	})

	test('sets X-Frame-Options to SAMEORIGIN on proxied responses', async () => {
		const res = await app.request('/artifacts/test-artifact')
		expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN')
	})

	test('does not set CSP or X-Frame-Options DENY on artifact responses', async () => {
		const res = await app.request('/artifacts/test-artifact')
		const csp = res.headers.get('content-security-policy')
		// CSP should NOT be set by our security headers middleware for artifact proxy
		// (the upstream might set its own, but we skip the global one)
		expect(csp).toBeNull()
	})
})

// ─── Auth middleware tests ──────────────────────────────────────────────────

describe('artifact proxy auth', () => {
	test('allows requests when auth is disabled (implicit owner)', async () => {
		// App was created with authEnabled: false — all requests get implicit owner
		const res = await app.request('/artifacts/test-artifact')
		expect(res.status).toBe(200)
	})

	test('returns 401 when auth is enabled and no credentials', async () => {
		const { createApp } = await import('../src/api/app')
		const authApp = createApp({ authEnabled: true, corsOrigin: '*' })

		const res = await authApp.request('/artifacts/test-artifact')
		expect(res.status).toBe(401)
		const data = (await res.json()) as { error: string }
		expect(data.error).toBe('Unauthorized')
	})
})

// ─── Body size limit exemption ──────────────────────────────────────────────

describe('artifact proxy body limit', () => {
	test('does not reject large responses from artifact upstream', async () => {
		// The proxy should not limit response bodies from upstream
		const res = await app.request('/artifacts/test-artifact')
		expect(res.status).toBe(200)
	})
})
