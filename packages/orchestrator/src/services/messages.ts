import { eq, and, desc } from 'drizzle-orm'
import { messages } from '../db/company-schema'
import type { CompanyDb } from '../db'

export type MessageRow = typeof messages.$inferSelect

export class MessageService {
	constructor(private db: CompanyDb) {}

	async create(input: {
		id: string
		from_id: string
		channel_id?: string
		run_id?: string
		content: string
		mentions?: string
		attachments?: string
		thread_id?: string
	}): Promise<MessageRow | undefined> {
		await this.db.insert(messages).values({
			...input,
			mentions: input.mentions ?? '[]',
			attachments: input.attachments ?? '[]',
			created_at: new Date().toISOString(),
		})
		return this.get(input.id)
	}

	async get(id: string): Promise<MessageRow | undefined> {
		return this.db.select().from(messages).where(eq(messages.id, id)).get()
	}

	/** List messages for a channel, newest first. */
	async listByChannel(channelId: string, opts?: { limit?: number; before?: string }): Promise<MessageRow[]> {
		const conditions = [eq(messages.channel_id, channelId)]

		const results = await this.db
			.select()
			.from(messages)
			.where(and(...conditions))
			.orderBy(desc(messages.created_at))
			.all()

		// Manual cursor + limit since drizzle SQLite doesn't support .limit() chaining cleanly
		let filtered = results
		if (opts?.before) {
			filtered = filtered.filter((m) => m.created_at < opts.before!)
		}
		if (opts?.limit) {
			filtered = filtered.slice(0, opts.limit)
		}
		return filtered
	}

	/** List messages for a run, ordered by creation time. */
	async listByRun(runId: string): Promise<MessageRow[]> {
		return this.db
			.select()
			.from(messages)
			.where(eq(messages.run_id, runId))
			.orderBy(messages.created_at)
			.all()
	}

	/** List thread replies for a given parent message. */
	async listThread(threadId: string): Promise<MessageRow[]> {
		return this.db
			.select()
			.from(messages)
			.where(eq(messages.thread_id, threadId))
			.orderBy(messages.created_at)
			.all()
	}

	async delete(id: string): Promise<void> {
		await this.db.delete(messages).where(eq(messages.id, id))
	}
}
