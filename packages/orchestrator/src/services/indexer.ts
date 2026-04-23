/**
 * Search indexer — indexes tasks, runs, context files, and schedules into the
 * search_index table in index.db for FTS5 full-text search.
 *
 * Runs at startup and periodically (every 5 minutes).
 * Uses content hash to avoid re-indexing unchanged content.
 */
import { createHash } from 'node:crypto'
import { and, desc, eq } from 'drizzle-orm'
import type { CompanyDb, IndexDb } from '../db'
import { artifactBlobs, knowledge, runs, schedules, tasks } from '../db/company-schema'
import { searchIndex } from '../db/index-schema'
import type { BlobStore } from './blob-store'
import type { AuthoredConfig } from './workflow-engine'

export interface IndexerConfig {
	companyDb: CompanyDb
	indexDb: IndexDb
	authoredConfig: AuthoredConfig
	blobStore?: BlobStore
	/** Interval in ms between re-index cycles. Default: 300_000 (5 min). */
	intervalMs?: number
}

function contentHash(text: string): string {
	return createHash('sha256').update(text).digest('hex').slice(0, 16)
}

export async function upsertSearchEntry(
	indexDb: IndexDb,
	entityType: string,
	entityId: string,
	title: string | null,
	content: string,
): Promise<void> {
	const hash = contentHash(content)
	const now = new Date().toISOString()

	const existing = await indexDb
		.select({ contentHash: searchIndex.contentHash })
		.from(searchIndex)
		.where(and(eq(searchIndex.entityType, entityType), eq(searchIndex.entityId, entityId)))
		.get()

	if (existing && existing.contentHash === hash) return

	if (existing) {
		await indexDb
			.update(searchIndex)
			.set({ title, content, contentHash: hash, indexedAt: now })
			.where(and(eq(searchIndex.entityType, entityType), eq(searchIndex.entityId, entityId)))
			.run()
	} else {
		await indexDb
			.insert(searchIndex)
			.values({ entityType, entityId, title, content, contentHash: hash, indexedAt: now })
			.run()
	}
}

export async function deleteSearchEntry(
	indexDb: IndexDb,
	entityType: string,
	entityId: string,
): Promise<void> {
	await indexDb
		.delete(searchIndex)
		.where(and(eq(searchIndex.entityType, entityType), eq(searchIndex.entityId, entityId)))
		.run()
}

async function indexTasks(companyDb: CompanyDb, indexDb: IndexDb): Promise<number> {
	const allTasks = await companyDb.select().from(tasks).limit(1000).all()
	let count = 0
	for (const task of allTasks) {
		const content = [task.title, task.description].filter(Boolean).join('\n')
		if (!content) continue
		await upsertSearchEntry(indexDb, 'task', task.id, task.title, content)
		count++
	}
	return count
}

async function indexRuns(companyDb: CompanyDb, indexDb: IndexDb): Promise<number> {
	// Only index runs with summaries, limit to most recent 500 to avoid memory issues
	const allRuns = await companyDb
		.select()
		.from(runs)
		.orderBy(desc(runs.created_at))
		.limit(500)
		.all()
	let count = 0
	for (const run of allRuns) {
		if (!run.summary) continue
		await upsertSearchEntry(indexDb, 'run', run.id, null, run.summary)
		count++
	}
	return count
}

async function indexContext(authoredConfig: AuthoredConfig, indexDb: IndexDb): Promise<number> {
	let count = 0
	for (const [path, content] of authoredConfig.context) {
		if (!content) continue
		await upsertSearchEntry(indexDb, 'context', path, path, content)
		count++
	}
	return count
}

async function indexSchedules(companyDb: CompanyDb, indexDb: IndexDb): Promise<number> {
	const allSchedules = await companyDb.select().from(schedules).all()
	let count = 0
	for (const sched of allSchedules) {
		const content = [sched.name, sched.description].filter(Boolean).join('\n')
		if (!content) continue
		await upsertSearchEntry(indexDb, 'schedule', sched.id, sched.name, content)
		count++
	}
	return count
}

function isIndexableKnowledgeMime(mimeType: string): boolean {
	return /(^text\/)|markdown|yaml|json/.test(mimeType)
}

async function indexKnowledge(
	companyDb: CompanyDb,
	indexDb: IndexDb,
	blobStore?: BlobStore,
): Promise<number> {
	if (!blobStore) return 0

	const docs = await companyDb
		.select({
			id: knowledge.id,
			title: knowledge.title,
			mime_type: knowledge.mime_type,
			storage_key: artifactBlobs.storage_key,
		})
		.from(knowledge)
		.leftJoin(artifactBlobs, eq(knowledge.blob_id, artifactBlobs.id))
		.all()

	let count = 0
	for (const doc of docs) {
		if (!doc.storage_key || !isIndexableKnowledgeMime(doc.mime_type)) continue
		const content = await blobStore.get(doc.storage_key)
		if (!content) continue
		await upsertSearchEntry(indexDb, 'knowledge', doc.id, doc.title, content.toString('utf-8'))
		count++
	}
	return count
}

async function runIndexCycle(config: IndexerConfig): Promise<void> {
	const { companyDb, indexDb, authoredConfig, blobStore } = config
	try {
		const taskCount = await indexTasks(companyDb, indexDb)
		const runCount = await indexRuns(companyDb, indexDb)
		const contextCount = await indexContext(authoredConfig, indexDb)
		const scheduleCount = await indexSchedules(companyDb, indexDb)
		const knowledgeCount = await indexKnowledge(companyDb, indexDb, blobStore)
		console.log(
			`[indexer] indexed: ${taskCount} tasks, ${runCount} runs, ${contextCount} context, ${scheduleCount} schedules, ${knowledgeCount} knowledge`,
		)
	} catch (err) {
		console.error('[indexer] cycle failed:', err instanceof Error ? err.message : String(err))
	}
}

export class Indexer {
	private timer: ReturnType<typeof setInterval> | null = null
	private config: IndexerConfig

	constructor(config: IndexerConfig) {
		this.config = config
	}

	async start(): Promise<void> {
		await runIndexCycle(this.config)
		const interval = this.config.intervalMs ?? 300_000
		this.timer = setInterval(() => {
			runIndexCycle(this.config).catch((err) => {
				console.error(
					'[indexer] periodic cycle error:',
					err instanceof Error ? err.message : String(err),
				)
			})
		}, interval)
		this.timer.unref()
	}

	stop(): void {
		if (this.timer) {
			clearInterval(this.timer)
			this.timer = null
		}
	}
}
