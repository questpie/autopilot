/**
 * Artifact service with durable blob storage support.
 *
 * Large payloads (>= BLOB_THRESHOLD) are stored in the content-addressed blob store
 * via a separate `artifact_blobs` table. Small inline payloads stay in `ref_value`.
 * Orphan blob detection and cleanup are supported for GC.
 */
import { randomBytes } from 'node:crypto'
import { eq, sql, inArray } from 'drizzle-orm'
import { artifacts, artifactBlobs } from '../db/company-schema'
import type { CompanyDb } from '../db'
import type { BlobStore } from './blob-store'

const BLOB_THRESHOLD = 4096 // bytes

function _getArtifact(db: CompanyDb, id: string) {
	return db.select().from(artifacts).where(eq(artifacts.id, id)).get()
}

export type ArtifactRow = NonNullable<Awaited<ReturnType<typeof _getArtifact>>>

export type ArtifactBlobRow = typeof artifactBlobs.$inferSelect

export class ArtifactService {
	constructor(
		private db: CompanyDb,
		private blobStore?: BlobStore,
	) {}

	async create(input: {
		id: string
		run_id: string
		task_id?: string | null
		kind: string
		title: string
		ref_kind: string
		ref_value: string
		mime_type?: string
		metadata?: string
	}) {
		const isInlineable = input.ref_kind === 'inline' || input.ref_kind === 'base64'
		const contentBytes = isInlineable
			? input.ref_kind === 'base64'
				? Buffer.from(input.ref_value, 'base64')
				: Buffer.from(input.ref_value, 'utf-8')
			: null

		let blobId: string | null = null
		let refValue = input.ref_value

		if (contentBytes && contentBytes.length >= BLOB_THRESHOLD && this.blobStore) {
			// Store in blob — find or create artifact_blobs row
			const blobResult = await this.blobStore.put(contentBytes)
			const blobRow = await this.#findOrCreateBlobRow(blobResult)
			blobId = blobRow.id
			// Replace ref_value with pointer so the NOT NULL column doesn't bloat the DB
			refValue = `blob:${blobRow.id}`
		}

		await this.db.insert(artifacts).values({
			...input,
			ref_value: refValue,
			blob_id: blobId,
			created_at: new Date().toISOString(),
		})
		return this.get(input.id)
	}

	async get(id: string) {
		return _getArtifact(this.db, id)
	}

	async listForRun(runId: string) {
		return this.db.select().from(artifacts).where(eq(artifacts.run_id, runId)).all()
	}

	async listForTask(taskId: string) {
		return this.db.select().from(artifacts).where(eq(artifacts.task_id, taskId)).all()
	}

	/** Resolve the actual content of an artifact — reads blob from disk if needed. */
	async resolveContent(row: ArtifactRow): Promise<Buffer | string> {
		if (row.blob_id) {
			const blobRow = await this.db
				.select()
				.from(artifactBlobs)
				.where(eq(artifactBlobs.id, row.blob_id))
				.get()
			if (!blobRow) throw new Error(`Blob row missing for artifact ${row.id}: blob_id=${row.blob_id}`)
			if (!this.blobStore) throw new Error(`BlobStore not configured but artifact ${row.id} references blob ${row.blob_id}`)
			const data = await this.blobStore.get(blobRow.storage_key)
			if (!data) throw new Error(`Blob file missing for artifact ${row.id}: ${blobRow.storage_key}`)
			return data
		}
		if (row.ref_kind === 'base64') {
			return Buffer.from(row.ref_value, 'base64')
		}
		if (row.ref_kind === 'file') {
			const { readFile } = await import('node:fs/promises')
			return readFile(row.ref_value)
		}
		if (row.ref_kind === 'url') {
			const res = await fetch(row.ref_value)
			if (!res.ok) throw new Error(`Failed to fetch artifact ${row.id} from ${row.ref_value}: ${res.status}`)
			return Buffer.from(await res.arrayBuffer())
		}
		return row.ref_value
	}

	// ── Cleanup / GC ────────────────────────────────────────────────────────

	/** Delete all artifacts for a run. Does NOT auto-clean orphan blobs — call removeOrphanBlobs() after. */
	async deleteForRun(runId: string): Promise<number> {
		const result = await this.db.delete(artifacts).where(eq(artifacts.run_id, runId)).run()
		return result.rowsAffected
	}

	/** Delete all artifacts for a task. Does NOT auto-clean orphan blobs — call removeOrphanBlobs() after. */
	async deleteForTask(taskId: string): Promise<number> {
		const result = await this.db.delete(artifacts).where(eq(artifacts.task_id, taskId)).run()
		return result.rowsAffected
	}

	/**
	 * Find orphan blob rows (no artifacts reference them) and remove both the
	 * DB row and the filesystem blob. Returns the number of blobs removed.
	 */
	async removeOrphanBlobs(): Promise<number> {
		if (!this.blobStore) return 0

		// Find all blob IDs that have no referencing artifact
		const orphans = await this.db
			.select({ id: artifactBlobs.id, storage_key: artifactBlobs.storage_key })
			.from(artifactBlobs)
			.where(
				sql`${artifactBlobs.id} NOT IN (SELECT ${artifacts.blob_id} FROM ${artifacts} WHERE ${artifacts.blob_id} IS NOT NULL)`,
			)
			.all()

		if (orphans.length === 0) return 0

		// Delete filesystem blobs
		for (const orphan of orphans) {
			await this.blobStore.delete(orphan.storage_key)
		}

		// Delete DB rows
		const orphanIds = orphans.map((o) => o.id)
		await this.db.delete(artifactBlobs).where(inArray(artifactBlobs.id, orphanIds)).run()

		return orphans.length
	}

	/** Get a blob row by ID (for testing/inspection). */
	async getBlob(blobId: string): Promise<ArtifactBlobRow | undefined> {
		return await this.db.select().from(artifactBlobs).where(eq(artifactBlobs.id, blobId)).get()
	}

	/**
	 * Derive the preview URL for a run from its preview_file artifacts.
	 * Returns null if the run has no preview_file artifacts.
	 */
	async resolvePreviewUrl(runId: string, orchestratorUrl?: string): Promise<string | null> {
		const arts = await this.listForRun(runId)
		const previewFiles = arts.filter((a) => a.kind === 'preview_file')
		if (previewFiles.length === 0) return null

		const htmlFile = previewFiles.find((a) => /\.(html?)$/i.test(a.title))
		const entry = htmlFile?.title ?? 'index.html'
		const base = orchestratorUrl ?? ''
		return `${base}/api/previews/${runId}/${entry}`
	}

	// ── Internal ─────────────────────────────────────────────────────────────

	async #findOrCreateBlobRow(blob: {
		storageKey: string
		contentHash: string
		size: number
	}): Promise<ArtifactBlobRow> {
		// Dedup: check if a blob with this content_hash already exists
		const existing = await this.db
			.select()
			.from(artifactBlobs)
			.where(eq(artifactBlobs.content_hash, blob.contentHash))
			.get()
		if (existing) return existing

		const id = `blob-${Date.now()}-${randomBytes(6).toString('hex')}`
		await this.db.insert(artifactBlobs).values({
			id,
			content_hash: blob.contentHash,
			storage_key: blob.storageKey,
			size: blob.size,
			created_at: new Date().toISOString(),
		}).run()

		const created = await this.db.select().from(artifactBlobs).where(eq(artifactBlobs.id, id)).get()
		if (!created) throw new Error(`Failed to create artifact_blobs row for ${blob.contentHash}`)
		return created
	}
}
