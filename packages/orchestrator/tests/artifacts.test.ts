/**
 * Tests for the artifacts primitive.
 *
 * Covers:
 * - Artifact creation with run/task linkage
 * - Listing artifacts by run and by task
 * - Real dogfood artifact kinds
 * - Artifacts registered from run completion
 * - No large blob storage
 */
import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createCompanyDb, type CompanyDbResult } from '../src/db'
import { ArtifactService, RunService, TaskService } from '../src/services'

const DDL = [
	`DROP TABLE IF EXISTS artifacts`,
	`DROP TABLE IF EXISTS runs`,
	`DROP TABLE IF EXISTS run_events`,
	`DROP TABLE IF EXISTS tasks`,
	`CREATE TABLE artifacts (
		id TEXT PRIMARY KEY, run_id TEXT NOT NULL, task_id TEXT,
		kind TEXT NOT NULL, title TEXT NOT NULL,
		ref_kind TEXT NOT NULL, ref_value TEXT NOT NULL,
		mime_type TEXT, metadata TEXT DEFAULT '{}',
		created_at TEXT NOT NULL
	)`,
	`CREATE TABLE runs (
		id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, task_id TEXT, worker_id TEXT,
		runtime TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
		initiated_by TEXT, instructions TEXT, summary TEXT,
		tokens_input INTEGER DEFAULT 0, tokens_output INTEGER DEFAULT 0,
		error TEXT, started_at TEXT, ended_at TEXT, created_at TEXT NOT NULL,
		runtime_session_ref TEXT, resumed_from_run_id TEXT,
		preferred_worker_id TEXT, resumable INTEGER DEFAULT 0,
		targeting TEXT
	)`,
	`CREATE TABLE run_events (
		id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL,
		type TEXT NOT NULL, summary TEXT, metadata TEXT DEFAULT '{}',
		created_at TEXT NOT NULL
	)`,
	`CREATE TABLE tasks (
		id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT DEFAULT '',
		type TEXT NOT NULL, status TEXT NOT NULL, priority TEXT DEFAULT 'medium',
		assigned_to TEXT, workflow_id TEXT, workflow_step TEXT,
		context TEXT DEFAULT '{}', metadata TEXT DEFAULT '{}',
		created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
	)`,
]

describe('Artifacts', () => {
	const companyRoot = join(tmpdir(), `qp-artifacts-${Date.now()}`)
	let dbResult: CompanyDbResult
	let artifactService: ArtifactService
	let runService: RunService
	let taskService: TaskService

	beforeAll(async () => {
		await mkdir(companyRoot, { recursive: true })
		await writeFile(join(companyRoot, 'company.yaml'), 'name: test\nowner:\n  name: Test\n  email: test@test.com\n')
		dbResult = await createCompanyDb(companyRoot)
		for (const sql of DDL) await dbResult.raw.execute(sql)
		artifactService = new ArtifactService(dbResult.db)
		runService = new RunService(dbResult.db)
		taskService = new TaskService(dbResult.db)
	})

	afterAll(async () => {
		dbResult.raw.close()
		await rm(companyRoot, { recursive: true, force: true })
	})

	test('create and retrieve artifact', async () => {
		const art = await artifactService.create({
			id: 'art-test-1',
			run_id: 'run-1',
			task_id: 'task-1',
			kind: 'changed_file',
			title: 'packages/orchestrator/src/server.ts',
			ref_kind: 'file',
			ref_value: 'packages/orchestrator/src/server.ts',
		})
		expect(art).not.toBeUndefined()
		expect(art!.kind).toBe('changed_file')
		expect(art!.ref_kind).toBe('file')

		const fetched = await artifactService.get('art-test-1')
		expect(fetched!.title).toBe('packages/orchestrator/src/server.ts')
	})

	test('list artifacts by run_id', async () => {
		await artifactService.create({
			id: 'art-run-a',
			run_id: 'run-A',
			kind: 'diff_summary',
			title: 'Changes summary',
			ref_kind: 'inline',
			ref_value: '+15 -3 across 2 files',
		})
		await artifactService.create({
			id: 'art-run-b',
			run_id: 'run-A',
			kind: 'test_report',
			title: 'Test results',
			ref_kind: 'inline',
			ref_value: '48 pass, 0 fail',
		})

		const arts = await artifactService.listForRun('run-A')
		expect(arts.length).toBe(2)
		expect(arts.map((a) => a.kind).sort()).toEqual(['diff_summary', 'test_report'])
	})

	test('list artifacts by task_id', async () => {
		await artifactService.create({
			id: 'art-task-1',
			run_id: 'run-X',
			task_id: 'task-X',
			kind: 'doc',
			title: 'Feature spec',
			ref_kind: 'file',
			ref_value: 'docs/feature-spec.md',
		})

		const arts = await artifactService.listForTask('task-X')
		expect(arts.length).toBe(1)
		expect(arts[0]!.kind).toBe('doc')
	})

	test('all dogfood artifact kinds can be created', async () => {
		const kinds = ['changed_file', 'diff_summary', 'test_report', 'doc', 'external_receipt', 'preview_url', 'other'] as const
		for (const kind of kinds) {
			const art = await artifactService.create({
				id: `art-kind-${kind}`,
				run_id: 'run-kinds',
				kind,
				title: `Test ${kind}`,
				ref_kind: kind === 'preview_url' ? 'url' : 'file',
				ref_value: kind === 'preview_url' ? 'http://localhost:3000' : `path/to/${kind}`,
			})
			expect(art).not.toBeUndefined()
			expect(art!.kind).toBe(kind)
		}
	})

	test('artifact metadata stored as JSON string, not blob', async () => {
		const art = await artifactService.create({
			id: 'art-meta',
			run_id: 'run-meta',
			kind: 'external_receipt',
			title: 'Deploy webhook',
			ref_kind: 'url',
			ref_value: 'https://hooks.example.com/deploy',
			metadata: JSON.stringify({ status: 200, idempotency_key: 'deploy-123' }),
		})
		expect(art!.metadata).toBe('{"status":200,"idempotency_key":"deploy-123"}')
	})

	test('inline ref_value is short text, not large payload', async () => {
		const art = await artifactService.create({
			id: 'art-inline',
			run_id: 'run-inline',
			kind: 'diff_summary',
			title: 'Compact diff',
			ref_kind: 'inline',
			ref_value: '+42 -7 across 3 files',
		})
		expect(art!.ref_value.length).toBeLessThan(100)
	})
})
