import { randomBytes } from 'node:crypto'
import { eq, and, isNull, asc, gt, desc, sql } from 'drizzle-orm'
import { sessionMessages } from '../db/company-schema'
import type { CompanyDb } from '../db'

function _getSessionMessage(db: CompanyDb, id: string) {
	return db.select().from(sessionMessages).where(eq(sessionMessages.id, id)).get()
}

export type SessionMessageRow = NonNullable<Awaited<ReturnType<typeof _getSessionMessage>>>

export class SessionMessageService {
	constructor(private db: CompanyDb) {}

	async create(input: {
		session_id: string
		role: 'user' | 'assistant' | 'system'
		content: string
		query_id?: string
		external_message_id?: string
		metadata?: string
	}): Promise<SessionMessageRow> {
		const id = `smsg-${Date.now()}-${randomBytes(6).toString('hex')}`
		const now = new Date().toISOString()

		await this.db.insert(sessionMessages).values({
			id,
			session_id: input.session_id,
			role: input.role,
			content: input.content,
			query_id: input.query_id ?? null,
			external_message_id: input.external_message_id ?? null,
			metadata: input.metadata ?? '{}',
			created_at: now,
		})

		const row = await this.get(id)
		if (!row) throw new Error(`Failed to read back session message ${id} after insert`)
		return row
	}

	async get(id: string): Promise<SessionMessageRow | undefined> {
		return _getSessionMessage(this.db, id)
	}

	/** Update message content in place (for editing assistant progress messages). */
	async updateContent(id: string, content: string): Promise<void> {
		await this.db
			.update(sessionMessages)
			.set({ content })
			.where(eq(sessionMessages.id, id))
	}

	/** Update assistant delivery state in place. */
	async updateDelivery(
		id: string,
		input: { content?: string; external_message_id?: string | null },
	): Promise<void> {
		const changes: { content?: string; external_message_id?: string | null } = {}
		if (input.content !== undefined) changes.content = input.content
		if (input.external_message_id !== undefined) changes.external_message_id = input.external_message_id
		if (Object.keys(changes).length === 0) return

		await this.db
			.update(sessionMessages)
			.set(changes)
			.where(eq(sessionMessages.id, id))
	}

	/** Find the assistant message for a query, if it exists. */
	async findAssistantForQuery(queryId: string): Promise<SessionMessageRow | undefined> {
		return this.db
			.select()
			.from(sessionMessages)
			.where(
				and(
					eq(sessionMessages.query_id, queryId),
					eq(sessionMessages.role, 'assistant'),
				),
			)
			.orderBy(asc(sessionMessages.created_at), sql`rowid ASC`)
			.get()
	}

	/** Create or update the assistant message for a query in place. */
	async upsertAssistantForQuery(input: {
		session_id: string
		query_id: string
		content: string
		external_message_id?: string | null
	}): Promise<SessionMessageRow> {
		const existing = await this.findAssistantForQuery(input.query_id)
		if (existing) {
			await this.updateDelivery(existing.id, {
				content: input.content,
				external_message_id: input.external_message_id,
			})
			const row = await this.get(existing.id)
			if (!row) throw new Error(`Failed to read back assistant session message ${existing.id}`)
			return row
		}

		return this.create({
			session_id: input.session_id,
			role: 'assistant',
			content: input.content,
			query_id: input.query_id,
			external_message_id: input.external_message_id ?? undefined,
		})
	}

	/** List the latest N messages for a session, returned in chronological (oldest-first) order. */
	async listRecent(sessionId: string, limit = 20): Promise<SessionMessageRow[]> {
		// Select latest N by ordering DESC, then reverse for chronological order
		const rows = await this.db
			.select()
			.from(sessionMessages)
			.where(eq(sessionMessages.session_id, sessionId))
			.orderBy(desc(sessionMessages.created_at), sql`rowid DESC`)
			.limit(limit)
			.all()
		return rows.reverse()
	}

	/** List system messages created after a given timestamp. */
	async listSystemSince(sessionId: string, since: string): Promise<SessionMessageRow[]> {
		return this.db
			.select()
			.from(sessionMessages)
			.where(
				and(
					eq(sessionMessages.session_id, sessionId),
					eq(sessionMessages.role, 'system'),
					gt(sessionMessages.created_at, since),
				),
			)
			.orderBy(asc(sessionMessages.created_at), sql`rowid ASC`)
			.all()
	}

	/** List queued user messages (role='user', query_id IS NULL). */
	async listQueued(sessionId: string): Promise<SessionMessageRow[]> {
		return this.db
			.select()
			.from(sessionMessages)
			.where(
				and(
					eq(sessionMessages.session_id, sessionId),
					eq(sessionMessages.role, 'user'),
					isNull(sessionMessages.query_id),
				),
			)
			.orderBy(asc(sessionMessages.created_at), sql`rowid ASC`)
			.all()
	}

	/** Mark queued messages as consumed by a query. */
	async markConsumed(ids: string[], queryId: string): Promise<void> {
		for (const id of ids) {
			await this.db
				.update(sessionMessages)
				.set({ query_id: queryId })
				.where(eq(sessionMessages.id, id))
		}
	}

	/** Clear all messages for a session (used by /reset). */
	async clearForSession(sessionId: string): Promise<void> {
		await this.db
			.delete(sessionMessages)
			.where(eq(sessionMessages.session_id, sessionId))
	}
}
