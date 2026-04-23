import { randomBytes } from 'node:crypto'
import { basename, posix } from 'node:path'
import { and, eq, inArray, like, or } from 'drizzle-orm'
import type { CompanyDb, IndexDb } from '../db'
import { artifactBlobs, knowledge } from '../db/company-schema'
import type { BlobStore } from './blob-store'
import { deleteSearchEntry, upsertSearchEntry } from './indexer'

export type KnowledgeScopeType = 'company' | 'project' | 'task'

export interface KnowledgeScopeInput {
	scope_type?: KnowledgeScopeType
	scope_id?: string
	project_id?: string
	task_id?: string
}

export interface KnowledgeListInput extends KnowledgeScopeInput {
	path?: string
	includeInherited?: boolean
}

export interface KnowledgeWriteInput extends KnowledgeScopeInput {
	path: string
	content: string | Buffer
	title?: string
	mime_type?: string
}

export type KnowledgeRow = typeof knowledge.$inferSelect

export interface KnowledgeDocument extends KnowledgeRow {
	content: string
}

function normalizePath(path: string): string {
	const trimmed = path.trim().replace(/^\/+/, '')
	const normalized = posix.normalize(trimmed)
	if (
		!normalized ||
		normalized === '.' ||
		normalized.startsWith('../') ||
		normalized.includes('/../')
	) {
		throw new Error(`invalid knowledge path: ${path}`)
	}
	return normalized
}

function normalizePrefix(path?: string): string | undefined {
	if (!path?.trim()) return undefined
	return normalizePath(path).replace(/\/+$/, '')
}

function inferMimeType(path: string): string {
	const lower = path.toLowerCase()
	if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'text/markdown'
	if (lower.endsWith('.yaml') || lower.endsWith('.yml')) return 'text/yaml'
	if (lower.endsWith('.json')) return 'application/json'
	if (lower.endsWith('.txt')) return 'text/plain'
	return 'application/octet-stream'
}

function isIndexableMime(mimeType: string): boolean {
	return /(^text\/)|markdown|yaml|json/.test(mimeType)
}

function resolveWriteScope(input: KnowledgeScopeInput): {
	scopeType: KnowledgeScopeType
	scopeId: string
} {
	const scopeType =
		input.scope_type ?? (input.task_id ? 'task' : input.project_id ? 'project' : 'company')
	if (scopeType === 'company') return { scopeType, scopeId: 'company' }
	const scopeId = input.scope_id ?? (scopeType === 'project' ? input.project_id : input.task_id)
	if (!scopeId) throw new Error(`${scopeType} knowledge requires scope_id`)
	return { scopeType, scopeId }
}

function visibleScopes(
	input: KnowledgeScopeInput,
): Array<{ scopeType: KnowledgeScopeType; scopeId: string }> {
	const scopes: Array<{ scopeType: KnowledgeScopeType; scopeId: string }> = [
		{ scopeType: 'company', scopeId: 'company' },
	]
	const projectId =
		input.project_id ?? (input.scope_type === 'project' ? input.scope_id : undefined)
	if (projectId) scopes.push({ scopeType: 'project', scopeId: projectId })
	const taskId = input.task_id ?? (input.scope_type === 'task' ? input.scope_id : undefined)
	if (taskId) scopes.push({ scopeType: 'task', scopeId: taskId })
	return scopes
}

export class KnowledgeService {
	constructor(
		private db: CompanyDb,
		private blobStore: BlobStore,
		private indexDb?: IndexDb,
	) {}

	async list(input: KnowledgeListInput = {}): Promise<KnowledgeRow[]> {
		const pathPrefix = normalizePrefix(input.path)
		const scopes =
			input.includeInherited === false ? [resolveWriteScope(input)] : visibleScopes(input)
		const scopePredicates = scopes.map((scope) =>
			and(eq(knowledge.scope_type, scope.scopeType), eq(knowledge.scope_id, scope.scopeId)),
		)
		const predicates = [or(...scopePredicates)!]
		if (pathPrefix) {
			predicates.push(or(eq(knowledge.path, pathPrefix), like(knowledge.path, `${pathPrefix}/%`))!)
		}
		return this.db
			.select()
			.from(knowledge)
			.where(and(...predicates))
			.orderBy(knowledge.path)
			.all()
	}

	async get(path: string, input: KnowledgeScopeInput = {}): Promise<KnowledgeDocument | null> {
		const normalizedPath = normalizePath(path)
		const scopes = visibleScopes(input).reverse()
		for (const scope of scopes) {
			const row = await this.db
				.select()
				.from(knowledge)
				.where(
					and(
						eq(knowledge.path, normalizedPath),
						eq(knowledge.scope_type, scope.scopeType),
						eq(knowledge.scope_id, scope.scopeId),
					),
				)
				.get()
			if (row) return this.withContent(row)
		}
		return null
	}

	async write(input: KnowledgeWriteInput): Promise<KnowledgeDocument> {
		const path = normalizePath(input.path)
		const { scopeType, scopeId } = resolveWriteScope(input)
		const content = Buffer.isBuffer(input.content)
			? input.content
			: Buffer.from(input.content, 'utf-8')
		const blob = await this.blobStore.put(content)
		const blobRow = await this.findOrCreateBlobRow(blob)
		const now = new Date().toISOString()
		const existing = await this.db
			.select()
			.from(knowledge)
			.where(
				and(
					eq(knowledge.path, path),
					eq(knowledge.scope_type, scopeType),
					eq(knowledge.scope_id, scopeId),
				),
			)
			.get()
		const values = {
			path,
			title: input.title ?? basename(path),
			content_hash: blob.contentHash,
			blob_id: blobRow.id,
			mime_type: input.mime_type ?? inferMimeType(path),
			scope_type: scopeType,
			scope_id: scopeId,
			updated_at: now,
		}

		if (existing) {
			await this.db.update(knowledge).set(values).where(eq(knowledge.id, existing.id)).run()
		} else {
			await this.db
				.insert(knowledge)
				.values({
					id: `knowledge-${Date.now()}-${randomBytes(6).toString('hex')}`,
					...values,
					created_at: now,
				})
				.run()
		}

		const row = await this.get(path, { scope_type: scopeType, scope_id: scopeId })
		if (!row) throw new Error(`failed to write knowledge document: ${path}`)
		await this.index(row, content)
		return row
	}

	async delete(path: string, input: KnowledgeScopeInput = {}): Promise<boolean> {
		const normalizedPath = normalizePath(path)
		const { scopeType, scopeId } = resolveWriteScope(input)
		const row = await this.db
			.select()
			.from(knowledge)
			.where(
				and(
					eq(knowledge.path, normalizedPath),
					eq(knowledge.scope_type, scopeType),
					eq(knowledge.scope_id, scopeId),
				),
			)
			.get()
		if (!row) return false
		await this.db.delete(knowledge).where(eq(knowledge.id, row.id)).run()
		if (this.indexDb) await deleteSearchEntry(this.indexDb, 'knowledge', row.id)
		return true
	}

	async search(query: string, input: KnowledgeScopeInput = {}): Promise<KnowledgeDocument[]> {
		const lower = query.trim().toLowerCase()
		if (!lower) return []
		const docs = await this.list(input)
		const matches: KnowledgeDocument[] = []
		for (const doc of docs) {
			const withContent = await this.withContent(doc)
			if (
				withContent.title.toLowerCase().includes(lower) ||
				withContent.path.toLowerCase().includes(lower) ||
				withContent.content.toLowerCase().includes(lower)
			) {
				matches.push(withContent)
			}
		}
		return matches
	}

	private async withContent(row: KnowledgeRow): Promise<KnowledgeDocument> {
		const blob = await this.db
			.select()
			.from(artifactBlobs)
			.where(eq(artifactBlobs.id, row.blob_id))
			.get()
		if (!blob) throw new Error(`Blob row missing for knowledge ${row.id}: ${row.blob_id}`)
		const content = await this.blobStore.get(blob.storage_key)
		if (!content) throw new Error(`Blob file missing for knowledge ${row.id}: ${blob.storage_key}`)
		return { ...row, content: content.toString('utf-8') }
	}

	private async index(row: KnowledgeRow, content: Buffer): Promise<void> {
		if (!this.indexDb) return
		if (!isIndexableMime(row.mime_type)) {
			await deleteSearchEntry(this.indexDb, 'knowledge', row.id)
			return
		}
		await upsertSearchEntry(this.indexDb, 'knowledge', row.id, row.title, content.toString('utf-8'))
	}

	private async findOrCreateBlobRow(blob: {
		storageKey: string
		contentHash: string
		size: number
	}) {
		const existing = await this.db
			.select()
			.from(artifactBlobs)
			.where(eq(artifactBlobs.content_hash, blob.contentHash))
			.get()
		if (existing) return existing

		const id = `blob-${Date.now()}-${randomBytes(6).toString('hex')}`
		await this.db
			.insert(artifactBlobs)
			.values({
				id,
				content_hash: blob.contentHash,
				storage_key: blob.storageKey,
				size: blob.size,
				created_at: new Date().toISOString(),
			})
			.run()

		const created = await this.db.select().from(artifactBlobs).where(eq(artifactBlobs.id, id)).get()
		if (!created) throw new Error(`Failed to create artifact_blobs row for ${blob.contentHash}`)
		return created
	}
}

export { normalizePath as normalizeKnowledgePath }
