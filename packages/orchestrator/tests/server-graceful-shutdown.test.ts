import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { configureContainer, container } from '../src/container'
import { dbFactory } from '../src/db'
import { storageFactory } from '../src/fs/sqlite-backend'
import type { StorageBackend } from '../src/fs/storage'
import { writeYaml } from '../src/fs/yaml'
import { Orchestrator } from '../src/server'
import { createTestCompany } from './helpers'

/**
 * H6: Graceful shutdown tests.
 *
 * Verify that stop() marks in-flight agent sessions as 'interrupted'.
 */
describe('graceful shutdown (H6)', () => {
	let companyRoot: string
	let cleanup: () => Promise<void>
	let orchestrator: Orchestrator
	let storage: StorageBackend

	beforeEach(async () => {
		const tc = await createTestCompany()
		companyRoot = tc.root
		cleanup = tc.cleanup

		await writeYaml(join(companyRoot, 'company.yaml'), {
			name: 'Test Co',
			slug: 'test-co',
			description: 'Test company',
			timezone: 'UTC',
			language: 'en',
			languages: ['en'],
			owner: {
				name: 'Owner',
				email: 'owner@example.com',
				notification_channels: [],
			},
			settings: {},
		})

		container.clearAllInstances()
		configureContainer(companyRoot)
		;(container as unknown as { instances: Map<string, unknown> }).instances.set(
			'companyRoot',
			companyRoot,
		)
		const resolved = await container.resolveAsync([storageFactory])
		storage = resolved.storage
		orchestrator = new Orchestrator({ companyRoot })
	})

	afterEach(async () => {
		// storage may already be closed by stop(), so ignore close errors
		try {
			await storage.close()
		} catch {
			// Already closed
		}
		container.clearAllInstances()
		await cleanup()
	})

	test('stop() marks running sessions as interrupted', async () => {
		const { db: dbResult } = await container.resolveAsync([dbFactory])
		const raw = (dbResult.db as unknown as { $client: import('@libsql/client').Client }).$client
		const now = new Date().toISOString()

		// Insert two running sessions and one completed session
		await raw.execute({
			sql: `INSERT INTO agent_sessions (id, agent_id, task_id, trigger_type, status, started_at, tool_calls, tokens_used)
			      VALUES (?, ?, ?, ?, 'running', ?, 0, 0)`,
			args: ['running-1', 'agent-a', 'task-1', 'task_assigned', now],
		})
		await raw.execute({
			sql: `INSERT INTO agent_sessions (id, agent_id, task_id, trigger_type, status, started_at, tool_calls, tokens_used)
			      VALUES (?, ?, ?, ?, 'running', ?, 0, 0)`,
			args: ['running-2', 'agent-b', 'task-2', 'schedule', now],
		})
		await raw.execute({
			sql: `INSERT INTO agent_sessions (id, agent_id, task_id, trigger_type, status, started_at, ended_at, tool_calls, tokens_used)
			      VALUES (?, ?, ?, ?, 'completed', ?, ?, 5, 0)`,
			args: ['completed-1', 'agent-c', 'task-3', 'task_assigned', now, now],
		})

		// Manually set running = true so stop() actually runs the shutdown logic
		;(orchestrator as unknown as { running: boolean }).running = true

		await orchestrator.stop()

		// Re-open DB to query (stop() closes storage, so resolve fresh)
		container.clearAllInstances()
		configureContainer(companyRoot)
		;(container as unknown as { instances: Map<string, unknown> }).instances.set(
			'companyRoot',
			companyRoot,
		)
		const { db: freshDb } = await container.resolveAsync([dbFactory])
		const freshRaw = (freshDb.db as unknown as { $client: import('@libsql/client').Client }).$client

		// Running sessions should be interrupted
		const interrupted = await freshRaw.execute({
			sql: `SELECT id, status, ended_at FROM agent_sessions WHERE status = 'interrupted'`,
			args: [],
		})
		expect(interrupted.rows).toHaveLength(2)
		for (const row of interrupted.rows) {
			expect(String(row.status)).toBe('interrupted')
			expect(row.ended_at).toBeTruthy()
		}

		// Completed session should be unchanged
		const completed = await freshRaw.execute({
			sql: `SELECT status FROM agent_sessions WHERE id = 'completed-1'`,
			args: [],
		})
		expect(String(completed.rows[0]?.status)).toBe('completed')
	})

	test('stop() is safe when no running sessions exist', async () => {
		;(orchestrator as unknown as { running: boolean }).running = true

		// Should not throw even with empty sessions table
		await orchestrator.stop()
		expect(true).toBe(true)
	})
})
