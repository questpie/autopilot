import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { stringify as stringifyYaml } from 'yaml'
import { parseCidr, isIpAllowed, getClientIp } from '../src/api/middleware/ip-allowlist'
import { container, configureContainer } from '../src/container'
import type { StorageBackend } from '../src/fs/storage'

// ─── Unit tests for pure functions ──────────────────────────────────────────

describe('parseCidr', () => {
	test('parses /24 subnet correctly', () => {
		const result = parseCidr('192.168.1.0/24')
		expect(result).not.toBeNull()
		expect(result!.mask).toBe(0xFFFFFF00 >>> 0)
		expect(result!.network).toBe((192 << 24 | 168 << 16 | 1 << 8 | 0) >>> 0)
	})

	test('parses /8 subnet correctly', () => {
		const result = parseCidr('10.0.0.0/8')
		expect(result).not.toBeNull()
		expect(result!.mask).toBe(0xFF000000 >>> 0)
		expect(result!.network).toBe((10 << 24) >>> 0)
	})

	test('parses /10 subnet (Tailscale CGNAT)', () => {
		const result = parseCidr('100.64.0.0/10')
		expect(result).not.toBeNull()
		expect(result!.mask).toBe(0xFFC00000 >>> 0)
		expect(result!.network).toBe((100 << 24 | 64 << 16) >>> 0)
	})

	test('parses /0 (match all)', () => {
		const result = parseCidr('0.0.0.0/0')
		expect(result).not.toBeNull()
		expect(result!.mask).toBe(0)
		expect(result!.network).toBe(0)
	})

	test('single IP without prefix treated as /32', () => {
		const result = parseCidr('1.2.3.4')
		expect(result).not.toBeNull()
		expect(result!.mask).toBe(0xFFFFFFFF >>> 0)
		expect(result!.network).toBe((1 << 24 | 2 << 16 | 3 << 8 | 4) >>> 0)
	})

	test('returns null for invalid input', () => {
		expect(parseCidr('not-an-ip')).toBeNull()
		expect(parseCidr('256.1.1.1')).toBeNull()
		expect(parseCidr('1.2.3.4/33')).toBeNull()
		expect(parseCidr('')).toBeNull()
		expect(parseCidr('1.2.3')).toBeNull()
	})
})

describe('isIpAllowed', () => {
	test('IP in range returns true', () => {
		const cidrs = [parseCidr('192.168.1.0/24')!]
		expect(isIpAllowed('192.168.1.50', cidrs)).toBe(true)
		expect(isIpAllowed('192.168.1.1', cidrs)).toBe(true)
		expect(isIpAllowed('192.168.1.254', cidrs)).toBe(true)
	})

	test('IP out of range returns false', () => {
		const cidrs = [parseCidr('192.168.1.0/24')!]
		expect(isIpAllowed('10.0.0.1', cidrs)).toBe(false)
		expect(isIpAllowed('192.168.2.1', cidrs)).toBe(false)
	})

	test('boundary IPs (first and last in subnet)', () => {
		const cidrs = [parseCidr('192.168.1.0/24')!]
		expect(isIpAllowed('192.168.1.0', cidrs)).toBe(true)   // network address
		expect(isIpAllowed('192.168.1.255', cidrs)).toBe(true)  // broadcast
		expect(isIpAllowed('192.168.0.255', cidrs)).toBe(false) // just before
		expect(isIpAllowed('192.168.2.0', cidrs)).toBe(false)   // just after
	})

	test('0.0.0.0/0 matches any IP', () => {
		const cidrs = [parseCidr('0.0.0.0/0')!]
		expect(isIpAllowed('1.2.3.4', cidrs)).toBe(true)
		expect(isIpAllowed('255.255.255.255', cidrs)).toBe(true)
	})

	test('Tailscale CGNAT range', () => {
		const cidrs = [parseCidr('100.64.0.0/10')!]
		expect(isIpAllowed('100.64.0.1', cidrs)).toBe(true)
		expect(isIpAllowed('100.127.255.254', cidrs)).toBe(true)
		expect(isIpAllowed('100.128.0.1', cidrs)).toBe(false)
		expect(isIpAllowed('100.63.255.255', cidrs)).toBe(false)
	})

	test('multiple CIDRs', () => {
		const cidrs = [parseCidr('192.168.1.0/24')!, parseCidr('10.0.0.0/8')!]
		expect(isIpAllowed('192.168.1.50', cidrs)).toBe(true)
		expect(isIpAllowed('10.1.2.3', cidrs)).toBe(true)
		expect(isIpAllowed('172.16.0.1', cidrs)).toBe(false)
	})
})

// ─── Middleware integration tests ──────────────────────────────────────────

describe('IP allowlist middleware', () => {
	let companyRoot: string
	let storage: StorageBackend

	beforeAll(async () => {
		companyRoot = await mkdtemp(join(tmpdir(), 'ip-allowlist-test-'))

		const dirs = [
			'tasks/backlog', 'tasks/active', 'tasks/review', 'tasks/blocked', 'tasks/done',
			'comms/channels/general', 'comms/direct', 'dashboard/pins',
			'logs/activity', 'logs/sessions', 'team', 'team/workflows',
			'context/memory', 'context/indexes',
		]
		for (const dir of dirs) {
			await mkdir(join(companyRoot, dir), { recursive: true })
		}

		// Write company.yaml WITH ip_allowlist
		await writeFile(join(companyRoot, 'company.yaml'), stringifyYaml({
			name: 'Test Company',
			slug: 'test-company',
			description: 'IP allowlist test',
			timezone: 'UTC',
			language: 'en',
			languages: ['en'],
			owner: { name: 'Test', email: 'test@test.com', notification_channels: [] },
			settings: {
				auth: {
					ip_allowlist: ['192.168.1.0/24'],
				},
			},
		}))

		await writeFile(join(companyRoot, 'team', 'agents.yaml'), stringifyYaml({ agents: [] }))

		container.clearAllInstances()
		configureContainer(companyRoot)
		;(container as any).instances.set('companyRoot', companyRoot)

		const { storageFactory } = await import('../src/fs/sqlite-backend')
		const resolved = await container.resolveAsync([storageFactory])
		storage = resolved.storage
	})

	afterAll(async () => {
		if (storage) await storage.close()
		container.clearAllInstances()
		if (companyRoot) await rm(companyRoot, { recursive: true, force: true })
	})

	test('blocks non-allowed IP via X-Forwarded-For', async () => {
		const { createApp } = await import('../src/api/app')
		const app = createApp({ authEnabled: false, corsOrigin: '*' })

		const res = await app.request('/api/tasks', {
			headers: { 'X-Forwarded-For': '10.0.0.1' },
		})
		expect(res.status).toBe(403)
		const body = await res.json() as { error: string }
		expect(body.error).toBe('IP not allowed')
	})

	test('allows request from allowed IP', async () => {
		const { createApp } = await import('../src/api/app')
		const app = createApp({ authEnabled: false, corsOrigin: '*' })

		const res = await app.request('/api/tasks', {
			headers: { 'X-Forwarded-For': '192.168.1.50' },
		})
		expect(res.status).not.toBe(403)
	})

	test('empty allowlist allows all traffic', async () => {
		// Rewrite company.yaml without allowlist
		await writeFile(join(companyRoot, 'company.yaml'), stringifyYaml({
			name: 'Test Company',
			slug: 'test-company',
			description: 'IP allowlist test',
			timezone: 'UTC',
			language: 'en',
			languages: ['en'],
			owner: { name: 'Test', email: 'test@test.com', notification_channels: [] },
			settings: {},
		}))

		const { createApp } = await import('../src/api/app')
		const app = createApp({ authEnabled: false, corsOrigin: '*' })

		const res = await app.request('/api/tasks', {
			headers: { 'X-Forwarded-For': '10.0.0.1' },
		})
		expect(res.status).not.toBe(403)

		// Restore allowlist
		await writeFile(join(companyRoot, 'company.yaml'), stringifyYaml({
			name: 'Test Company',
			slug: 'test-company',
			description: 'IP allowlist test',
			timezone: 'UTC',
			language: 'en',
			languages: ['en'],
			owner: { name: 'Test', email: 'test@test.com', notification_channels: [] },
			settings: {
				auth: {
					ip_allowlist: ['192.168.1.0/24'],
				},
			},
		}))
	})

	test('/hooks/* path is exempt from IP allowlist', async () => {
		const { createApp } = await import('../src/api/app')
		const app = createApp({ authEnabled: false, corsOrigin: '*' })

		const res = await app.request('/hooks/github', {
			method: 'POST',
			headers: { 'X-Forwarded-For': '10.0.0.1' },
		})
		expect(res.status).not.toBe(403)
	})

	test('/api/status is exempt from IP allowlist', async () => {
		const { createApp } = await import('../src/api/app')
		const app = createApp({ authEnabled: false, corsOrigin: '*' })

		const res = await app.request('/api/status', {
			headers: { 'X-Forwarded-For': '10.0.0.1' },
		})
		expect(res.status).not.toBe(403)
	})
})
