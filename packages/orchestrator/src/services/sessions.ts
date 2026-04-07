import { randomBytes } from 'node:crypto'
import { eq, and, desc } from 'drizzle-orm'
import { sessions } from '../db/company-schema'
import type { CompanyDb } from '../db'

/**
 * Sentinel value stored in external_thread_id for chat-level sessions.
 *
 * SQLite treats NULL as distinct in UNIQUE indexes, so storing NULL would
 * allow duplicate chat-level rows for the same provider + conversation.
 * Using a non-null sentinel makes the unique index enforce at-most-one
 * chat-level session per (provider, conversation).
 */
const CHAT_LEVEL_THREAD = '__chat__'

function _getSession(db: CompanyDb, id: string) {
	return db.select().from(sessions).where(eq(sessions.id, id)).get()
}

/** Convert internal sentinel values back to null for external consumers. */
function normalizeRow<T extends { external_thread_id: string | null }>(row: T): T {
	if (row.external_thread_id === CHAT_LEVEL_THREAD || row.external_thread_id?.startsWith('__closed__')) {
		return { ...row, external_thread_id: null }
	}
	return row
}

function normalizeRows(rows: SessionRow[]): SessionRow[] {
	return Array.from(rows, normalizeRow)
}

export type SessionRow = NonNullable<Awaited<ReturnType<typeof _getSession>>>

export class SessionService {
	constructor(private db: CompanyDb) {}

	/**
	 * Find an existing active session or create a new one.
	 * The default mode for a new session is 'query'.
	 *
	 * Uses onConflictDoNothing + re-read to handle concurrent creates safely.
	 * Chat-level sessions (no thread_id) use a sentinel value so the unique
	 * index enforces at-most-one per (provider, conversation).
	 */
	async findOrCreate(input: {
		provider_id: string
		external_conversation_id: string
		external_thread_id?: string
		mode?: 'query' | 'task_thread'
		task_id?: string
	}): Promise<SessionRow> {
		const existing = await this.findByExternal(
			input.provider_id,
			input.external_conversation_id,
			input.external_thread_id,
		)
		if (existing) return existing

		const id = `sess-${Date.now()}-${randomBytes(6).toString('hex')}`
		const now = new Date().toISOString()
		const mode = input.mode ?? 'query'
		const threadKey = input.external_thread_id ?? CHAT_LEVEL_THREAD

		await this.db.insert(sessions).values({
			id,
			provider_id: input.provider_id,
			external_conversation_id: input.external_conversation_id,
			external_thread_id: threadKey,
			mode,
			task_id: mode === 'task_thread' ? (input.task_id ?? null) : null,
			last_query_id: null,
			status: 'active',
			created_at: now,
			updated_at: now,
			metadata: '{}',
		}).onConflictDoNothing()

		// Re-read: if a concurrent insert won, we return that row instead
		const session = await this.findByExternal(
			input.provider_id,
			input.external_conversation_id,
			input.external_thread_id,
		)
		return session ?? (this.get(id) as Promise<SessionRow>)
	}

	async get(id: string): Promise<SessionRow | undefined> {
		const row = await _getSession(this.db, id)
		return row ? normalizeRow(row) : undefined
	}

	/** Find an active session by external identity. Closed sessions are ignored. */
	async findByExternal(
		providerId: string,
		externalConversationId: string,
		externalThreadId?: string,
	): Promise<SessionRow | undefined> {
		const threadKey = externalThreadId ?? CHAT_LEVEL_THREAD
		const row = await this.db
			.select()
			.from(sessions)
			.where(
				and(
					eq(sessions.provider_id, providerId),
					eq(sessions.external_conversation_id, externalConversationId),
					eq(sessions.external_thread_id, threadKey),
					eq(sessions.status, 'active'),
				),
			)
			.get()
		return row ? normalizeRow(row) : undefined
	}

	/** Transition session to task_thread mode and bind a task. */
	async bindTask(id: string, taskId: string): Promise<SessionRow | undefined> {
		await this.db
			.update(sessions)
			.set({
				mode: 'task_thread',
				task_id: taskId,
				updated_at: new Date().toISOString(),
			})
			.where(eq(sessions.id, id))
		return this.get(id)
	}

	/** Update the last query reference for session-level continuity. */
	async updateLastQuery(id: string, queryId: string): Promise<SessionRow | undefined> {
		await this.db
			.update(sessions)
			.set({
				last_query_id: queryId,
				updated_at: new Date().toISOString(),
			})
			.where(eq(sessions.id, id))
		return this.get(id)
	}

	/**
	 * Close a session (e.g. when a task completes or thread becomes inactive).
	 *
	 * Tombstones the external_thread_id so the unique index slot is freed,
	 * allowing a new session to be created for the same surface identity.
	 */
	async close(id: string): Promise<SessionRow | undefined> {
		await this.db
			.update(sessions)
			.set({
				status: 'closed',
				external_thread_id: `__closed__${id}`,
				updated_at: new Date().toISOString(),
			})
			.where(eq(sessions.id, id))
		return this.get(id)
	}

	async list(filter?: { provider_id?: string; status?: string; mode?: string }): Promise<SessionRow[]> {
		const conditions = []
		if (filter?.provider_id) conditions.push(eq(sessions.provider_id, filter.provider_id))
		if (filter?.status) conditions.push(eq(sessions.status, filter.status))
		if (filter?.mode) conditions.push(eq(sessions.mode, filter.mode))

		const query = this.db.select().from(sessions)
		const filtered = conditions.length > 0 ? query.where(and(...conditions)) : query
		const rows = await filtered.orderBy(desc(sessions.updated_at)).all()
		return normalizeRows(rows)
	}

	/** Find the active session whose last_query_id matches the given query. */
	async findByLastQuery(queryId: string): Promise<SessionRow | undefined> {
		const row = await this.db
			.select()
			.from(sessions)
			.where(
				and(
					eq(sessions.last_query_id, queryId),
					eq(sessions.status, 'active'),
				),
			)
			.get()
		return row ? normalizeRow(row) : undefined
	}

	async listForTask(taskId: string): Promise<SessionRow[]> {
		const rows = await this.db
			.select()
			.from(sessions)
			.where(eq(sessions.task_id, taskId))
			.all()
		return normalizeRows(rows)
	}
}
