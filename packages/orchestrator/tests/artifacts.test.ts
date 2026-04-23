/**
 * Tests for the artifacts primitive.
 *
 * Covers:
 * - Artifact creation with run/task linkage
 * - Listing artifacts by run and by task
 * - Real dogfood artifact kinds
 * - Artifacts registered from run completion
 * - Blob storage with separate artifact_blobs table
 * - Orphan blob detection and cleanup
 */
import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createCompanyDb, type CompanyDbResult } from '../src/db'
import { ArtifactService, RunService, TaskService, BlobStore } from '../src/services'

const DDL = [
	`DROP TABLE IF EXISTS artifacts`,
	`DROP TABLE IF EXISTS artifact_blobs`,
	`DROP TABLE IF EXISTS runs`,
	`DROP TABLE IF EXISTS run_events`,
	`DROP TABLE IF EXISTS tasks`,
	`CREATE TABLE artifact_blobs (
		id TEXT PRIMARY KEY, content_hash TEXT NOT NULL UNIQUE,
		storage_key TEXT NOT NULL UNIQUE, size INTEGER NOT NULL,
		created_at TEXT NOT NULL
	)`,
	`CREATE TABLE artifacts (
		id TEXT PRIMARY KEY, run_id TEXT NOT NULL, task_id TEXT,
		kind TEXT NOT NULL, title TEXT NOT NULL,
		ref_kind TEXT NOT NULL, ref_value TEXT NOT NULL,
		mime_type TEXT, metadata TEXT DEFAULT '{}',
		blob_id TEXT REFERENCES artifact_blobs(id),
		created_at TEXT NOT NULL
	)`,
	`CREATE INDEX idx_artifacts_blob_id ON artifacts(blob_id)`,
	`CREATE TABLE runs (
		id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, task_id TEXT, project_id TEXT, worker_id TEXT,
		runtime TEXT NOT NULL, model TEXT, provider TEXT, variant TEXT, status TEXT NOT NULL DEFAULT 'pending',
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
		assigned_to TEXT, project_id TEXT, workflow_id TEXT, workflow_step TEXT,
		context TEXT DEFAULT '{}', metadata TEXT DEFAULT '{}',
		queue TEXT, start_after TEXT, scheduled_by TEXT,
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
		await mkdir(join(companyRoot, '.autopilot'), { recursive: true })
		await writeFile(join(companyRoot, '.autopilot', 'company.yaml'), 'name: test\nslug: test\nowner:\n  name: Test\n  email: test@test.com\n')
		dbResult = await createCompanyDb(companyRoot)
		for (const sql of DDL) await dbResult.raw.execute(sql)
		const blobStore = new BlobStore(join(companyRoot, '.data'))
		artifactService = new ArtifactService(dbResult.db, blobStore)
		runService = new RunService(dbResult.db)
		taskService = new TaskService(dbResult.db)
		taskService.setArtifactService(artifactService)
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

	// ─── Blob Storage Tests ──────────────────────────────────────────────────

	test('large inline artifact stored as blob with separate blob row', async () => {
		const largeContent = 'x'.repeat(8192) // 8KB > 4KB threshold
		const art = await artifactService.create({
			id: 'art-blob-1',
			run_id: 'run-blob',
			kind: 'preview_file',
			title: 'large-file.html',
			ref_kind: 'inline',
			ref_value: largeContent,
		})
		expect(art!.blob_id).not.toBeNull()
		expect(art!.ref_value).toStartWith('blob:')

		// Verify the blob row exists
		const blobRow = await artifactService.getBlob(art!.blob_id!)
		expect(blobRow).not.toBeUndefined()
		expect(blobRow!.content_hash).toMatch(/^sha256:/)
		expect(blobRow!.storage_key).toMatch(/^sha256\//)
		expect(blobRow!.size).toBe(8192)
	})

	test('small inline artifact stays inline (no blob_id)', async () => {
		const art = await artifactService.create({
			id: 'art-inline-small',
			run_id: 'run-inline-small',
			kind: 'diff_summary',
			title: 'Small diff',
			ref_kind: 'inline',
			ref_value: 'short content',
		})
		expect(art!.blob_id).toBeNull()
		expect(art!.ref_value).toBe('short content')
	})

	test('large base64 artifact stored as blob', async () => {
		const binary = Buffer.alloc(8192, 0xff)
		const b64 = binary.toString('base64')
		const art = await artifactService.create({
			id: 'art-blob-b64',
			run_id: 'run-blob-b64',
			kind: 'preview_file',
			title: 'image.png',
			ref_kind: 'base64',
			ref_value: b64,
		})
		expect(art!.blob_id).not.toBeNull()
		const blobRow = await artifactService.getBlob(art!.blob_id!)
		expect(blobRow!.size).toBe(8192) // raw bytes, not base64 length
	})

	test('resolveContent returns blob data for blob artifacts', async () => {
		const content = 'x'.repeat(8192)
		await artifactService.create({
			id: 'art-resolve-1',
			run_id: 'run-resolve',
			kind: 'doc',
			title: 'big-doc.md',
			ref_kind: 'inline',
			ref_value: content,
		})
		const row = await artifactService.get('art-resolve-1')
		const resolved = await artifactService.resolveContent(row!)
		const text = Buffer.isBuffer(resolved) ? resolved.toString('utf-8') : resolved
		expect(text).toBe(content)
	})

	test('dedup: identical content shares blob row', async () => {
		const content = 'shared-content-' + 'y'.repeat(8192)
		await artifactService.create({
			id: 'art-dedup-1',
			run_id: 'run-dedup',
			kind: 'doc',
			title: 'file-a.md',
			ref_kind: 'inline',
			ref_value: content,
		})
		await artifactService.create({
			id: 'art-dedup-2',
			run_id: 'run-dedup',
			kind: 'doc',
			title: 'file-b.md',
			ref_kind: 'inline',
			ref_value: content,
		})
		const a = await artifactService.get('art-dedup-1')
		const b = await artifactService.get('art-dedup-2')
		expect(a!.blob_id).toBe(b!.blob_id)
	})

	// ─── Cleanup / GC Tests ─────────────────────────────────────────────────

	test('deleteForRun removes artifacts for a run', async () => {
		await artifactService.create({
			id: 'art-del-run-1',
			run_id: 'run-del-target',
			kind: 'doc',
			title: 'temp.md',
			ref_kind: 'inline',
			ref_value: 'delete me',
		})
		const before = await artifactService.listForRun('run-del-target')
		expect(before.length).toBe(1)

		const deleted = await artifactService.deleteForRun('run-del-target')
		expect(deleted).toBe(1)

		const after = await artifactService.listForRun('run-del-target')
		expect(after.length).toBe(0)
	})

	test('removeOrphanBlobs cleans up unreferenced blobs', async () => {
		const content = 'orphan-test-' + 'z'.repeat(8192)
		await artifactService.create({
			id: 'art-orphan-1',
			run_id: 'run-orphan',
			kind: 'doc',
			title: 'orphan.md',
			ref_kind: 'inline',
			ref_value: content,
		})
		const art = await artifactService.get('art-orphan-1')
		const blobId = art!.blob_id!

		// Blob exists before deletion
		const blobBefore = await artifactService.getBlob(blobId)
		expect(blobBefore).not.toBeUndefined()

		// Delete the artifact, leaving the blob orphaned
		await artifactService.deleteForRun('run-orphan')

		// Blob row still exists (not auto-cleaned)
		const blobStill = await artifactService.getBlob(blobId)
		expect(blobStill).not.toBeUndefined()

		// Run orphan cleanup
		const removed = await artifactService.removeOrphanBlobs()
		expect(removed).toBeGreaterThanOrEqual(1)

		// Blob row is now gone
		const blobAfter = await artifactService.getBlob(blobId)
		expect(blobAfter).toBeUndefined()
	})

	test('deleteCascade cleans up orphaned blobs', async () => {
		const taskId = `task-cascade-${Date.now()}`
		const runId = `run-cascade-${Date.now()}`
		await taskService.create({ id: taskId, title: 'Cascade test', type: 'dev', created_by: 'test' })
		await runService.create({ id: runId, agent_id: 'dev', task_id: taskId, runtime: 'claude-code', initiated_by: 'test', instructions: 'cascade' })

		const largeContent = 'cascade-blob-' + 'c'.repeat(8192)
		await artifactService.create({
			id: `art-cascade-${Date.now()}`,
			run_id: runId,
			task_id: taskId,
			kind: 'doc',
			title: 'big.md',
			ref_kind: 'inline',
			ref_value: largeContent,
		})

		const art = (await artifactService.listForTask(taskId))[0]!
		const blobId = art.blob_id!
		expect(await artifactService.getBlob(blobId)).not.toBeUndefined()

		await taskService.deleteCascade(taskId)

		// Blob should be cleaned up (orphan removal runs after transaction)
		expect(await artifactService.getBlob(blobId)).toBeUndefined()
	})

	test('removeOrphanBlobs does not remove referenced blobs', async () => {
		const content = 'referenced-blob-' + 'w'.repeat(8192)
		await artifactService.create({
			id: 'art-ref-blob-1',
			run_id: 'run-ref-blob',
			kind: 'doc',
			title: 'keep-me.md',
			ref_kind: 'inline',
			ref_value: content,
		})
		const art = await artifactService.get('art-ref-blob-1')
		const blobId = art!.blob_id!

		// Run orphan cleanup — this blob is still referenced
		await artifactService.removeOrphanBlobs()

		// Blob should still exist
		const blobAfter = await artifactService.getBlob(blobId)
		expect(blobAfter).not.toBeUndefined()
	})
})
