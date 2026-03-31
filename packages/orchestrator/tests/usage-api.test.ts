/**
 * D39: Functional usage API tests.
 *
 * Tests GET /api/usage with a real in-memory libSQL database seeded
 * with agent_sessions data. Verifies totals, perAgent, and last24h.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { stringify as stringifyYaml } from 'yaml'
import { container, configureContainer } from '../src/container'
import { setupTestApiKey, withApiKey } from './auth-helpers'
import type { StorageBackend } from '../src/fs/storage'
import type { Client } from '@libsql/client'

let app: ReturnType<typeof import('../src/api/app').createApp>
let companyRoot: string
let storage: StorageBackend
let apiKey: string

function req(path: string, init?: RequestInit) {
	return app.request(path, withApiKey(init, apiKey))
}

beforeAll(async () => {
	companyRoot = await mkdtemp(join(tmpdir(), 'usage-api-test-'))

	const dirs = [
		'tasks/backlog', 'tasks/active', 'tasks/review', 'tasks/blocked', 'tasks/done',
		'comms/channels/general', 'comms/direct',
		'dashboard/pins', 'logs/activity', 'logs/sessions',
		'team', 'team/roles', 'team/workflows',
		'context/memory', 'context/indexes',
	]
	for (const dir of dirs) {
		await mkdir(join(companyRoot, dir), { recursive: true })
	}

	await writeFile(
		join(companyRoot, 'company.yaml'),
		stringifyYaml({
			name: 'Usage Test Co',
			slug: 'usage-test',
			description: 'test',
			timezone: 'UTC',
			language: 'en',
			languages: ['en'],
			owner: { name: 'Test', email: 'test@test.com', notification_channels: [] },
		}),
	)
	await mkdir(join(companyRoot, 'team', 'agents'), { recursive: true })

	container.clearAllInstances()
	configureContainer(companyRoot)
	;(container as any).instances.set('companyRoot', companyRoot)

	const { storageFactory } = await import('../src/fs/sqlite-backend')
	const resolved = await container.resolveAsync([storageFactory])
	storage = resolved.storage

	apiKey = await setupTestApiKey(companyRoot)

	// Seed agent_sessions data
	const { dbFactory } = await import('../src/db')
	const { db } = await container.resolveAsync([dbFactory])
	const raw = (db.db as unknown as { $client: Client }).$client

	const now = new Date().toISOString()
	const yesterday = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()

	// 2 recent sessions for 'developer', 1 old session for 'devops'
	await raw.execute({
		sql: `INSERT INTO agent_sessions (id, agent_id, trigger_type, status, started_at, tool_calls, tokens_used) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		args: ['s1', 'developer', 'task_assigned', 'completed', now, 5, 1000],
	})
	await raw.execute({
		sql: `INSERT INTO agent_sessions (id, agent_id, trigger_type, status, started_at, tool_calls, tokens_used) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		args: ['s2', 'developer', 'mention', 'completed', now, 3, 500],
	})
	await raw.execute({
		sql: `INSERT INTO agent_sessions (id, agent_id, trigger_type, status, started_at, tool_calls, tokens_used) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		args: ['s3', 'devops', 'schedule', 'completed', yesterday, 10, 2000],
	})

	const { createApp } = await import('../src/api/app')
	app = createApp({ corsOrigin: '*' })
})

afterAll(async () => {
	try { if (storage) await storage.close() } catch {}
	try { container.clearAllInstances() } catch {}
	try { if (companyRoot) await rm(companyRoot, { recursive: true, force: true }) } catch {}
})

describe('D39: GET /api/usage', () => {
	test('returns 200 with usage stats', async () => {
		const res = await req('/api/usage')
		expect(res.status).toBe(200)
	})

	test('returns totals with correct session count', async () => {
		const res = await req('/api/usage')
		const data = (await res.json()) as {
			totals: { sessions: number; tool_calls: number; tokens: number }
			last24h: { sessions: number; tokens: number }
			perAgent: Array<{ agent_id: string; session_count: number; total_tool_calls: number; total_tokens: number }>
		}

		expect(data.totals.sessions).toBe(3) // s1 + s2 + s3
		expect(data.totals.tool_calls).toBe(18) // 5 + 3 + 10
		expect(data.totals.tokens).toBe(3500) // 1000 + 500 + 2000
	})

	test('returns last24h excluding old sessions', async () => {
		const res = await req('/api/usage')
		const data = (await res.json()) as {
			last24h: { sessions: number; tokens: number }
		}

		// Only s1 and s2 are within last 24h (s3 is 2 days old)
		expect(data.last24h.sessions).toBe(2)
		expect(data.last24h.tokens).toBe(1500) // 1000 + 500
	})

	test('returns perAgent breakdown', async () => {
		const res = await req('/api/usage')
		const data = (await res.json()) as {
			perAgent: Array<{ agent_id: string; session_count: number; total_tool_calls: number; total_tokens: number }>
		}

		expect(data.perAgent.length).toBe(2) // developer + devops

		const dev = data.perAgent.find((a) => a.agent_id === 'developer')
		expect(dev).toBeDefined()
		expect(dev!.session_count).toBe(2)
		expect(dev!.total_tool_calls).toBe(8) // 5 + 3
		expect(dev!.total_tokens).toBe(1500) // 1000 + 500

		const ops = data.perAgent.find((a) => a.agent_id === 'devops')
		expect(ops).toBeDefined()
		expect(ops!.session_count).toBe(1)
		expect(ops!.total_tokens).toBe(2000)
	})

	test('perAgent is ordered by total_tokens descending', async () => {
		const res = await req('/api/usage')
		const data = (await res.json()) as {
			perAgent: Array<{ agent_id: string; total_tokens: number }>
		}

		// devops (2000) should come before developer (1500)
		expect(data.perAgent[0]!.agent_id).toBe('devops')
		expect(data.perAgent[1]!.agent_id).toBe('developer')
	})

	test('returns valid JSON structure', async () => {
		const res = await req('/api/usage')
		const data = (await res.json()) as Record<string, unknown>

		expect(data).toHaveProperty('totals')
		expect(data).toHaveProperty('last24h')
		expect(data).toHaveProperty('perAgent')
		expect(Array.isArray(data.perAgent)).toBe(true)
	})
})
