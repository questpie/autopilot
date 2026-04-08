/**
 * Search indexer — indexes tasks, runs, context files, and schedules into the
 * search_index table in index.db for FTS5 full-text search.
 *
 * Runs at startup and periodically (every 5 minutes).
 * Uses content hash to avoid re-indexing unchanged content.
 */
import { createHash } from 'node:crypto'
import { eq, and } from 'drizzle-orm'
import type { CompanyDb, IndexDb } from '../db'
import type { AuthoredConfig } from './workflow-engine'
import { tasks, runs, schedules } from '../db/company-schema'
import { searchIndex } from '../db/index-schema'

export interface IndexerConfig {
	companyDb: CompanyDb
	indexDb: IndexDb
	authoredConfig: AuthoredConfig
	/** Interval in ms between re-index cycles. Default: 300_000 (5 min). */
	intervalMs?: number
}

function contentHash(text: string): string {
	return createHash('sha256').update(text).digest('hex').slice(0, 16)
}

async function upsertEntry(
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

async function indexTasks(companyDb: CompanyDb, indexDb: IndexDb): Promise<number> {
	const allTasks = await companyDb.select().from(tasks).limit(1000).all()
	let count = 0
	for (const task of allTasks) {
		const content = [task.title, task.description].filter(Boolean).join('\n')
		if (!content) continue
		await upsertEntry(indexDb, 'task', task.id, task.title, content)
		count++
	}
	return count
}

async function indexRuns(companyDb: CompanyDb, indexDb: IndexDb): Promise<number> {
	// Only index runs with summaries, limit to most recent 500 to avoid memory issues
	const allRuns = await companyDb.select().from(runs).orderBy(runs.created_at).limit(500).all()
	let count = 0
	for (const run of allRuns) {
		if (!run.summary) continue
		await upsertEntry(indexDb, 'run', run.id, null, run.summary)
		count++
	}
	return count
}

async function indexContext(authoredConfig: AuthoredConfig, indexDb: IndexDb): Promise<number> {
	let count = 0
	for (const [path, content] of authoredConfig.context) {
		if (!content) continue
		await upsertEntry(indexDb, 'context', path, path, content)
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
		await upsertEntry(indexDb, 'schedule', sched.id, sched.name, content)
		count++
	}
	return count
}

async function runIndexCycle(config: IndexerConfig): Promise<void> {
	const { companyDb, indexDb, authoredConfig } = config
	try {
		const taskCount = await indexTasks(companyDb, indexDb)
		const runCount = await indexRuns(companyDb, indexDb)
		const contextCount = await indexContext(authoredConfig, indexDb)
		const scheduleCount = await indexSchedules(companyDb, indexDb)
		console.log(
			`[indexer] indexed: ${taskCount} tasks, ${runCount} runs, ${contextCount} context, ${scheduleCount} schedules`,
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
				console.error('[indexer] periodic cycle error:', err instanceof Error ? err.message : String(err))
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
