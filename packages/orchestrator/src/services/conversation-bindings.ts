import { eq, and } from 'drizzle-orm'
import { conversationBindings } from '../db/company-schema'
import type { CompanyDb } from '../db'

function _getBinding(db: CompanyDb, id: string) {
	return db.select().from(conversationBindings).where(eq(conversationBindings.id, id)).get()
}

export type ConversationBindingRow = NonNullable<Awaited<ReturnType<typeof _getBinding>>>

export class ConversationBindingService {
	constructor(private db: CompanyDb) {}

	async create(input: {
		id: string
		provider_id: string
		external_conversation_id: string
		external_thread_id?: string
		mode: string
		task_id?: string
		metadata?: string
	}): Promise<ConversationBindingRow | undefined> {
		const now = new Date().toISOString()
		await this.db.insert(conversationBindings).values({
			...input,
			metadata: input.metadata ?? '{}',
			created_at: now,
			updated_at: now,
		})
		return this.get(input.id)
	}

	async get(id: string): Promise<ConversationBindingRow | undefined> {
		return _getBinding(this.db, id)
	}

	async findByExternal(
		providerId: string,
		externalConversationId: string,
		externalThreadId?: string,
	): Promise<ConversationBindingRow | undefined> {
		if (externalThreadId) {
			return this.db
				.select()
				.from(conversationBindings)
				.where(
					and(
						eq(conversationBindings.provider_id, providerId),
						eq(conversationBindings.external_conversation_id, externalConversationId),
						eq(conversationBindings.external_thread_id, externalThreadId),
					),
				)
				.get()
		}

		return this.db
			.select()
			.from(conversationBindings)
			.where(
				and(
					eq(conversationBindings.provider_id, providerId),
					eq(conversationBindings.external_conversation_id, externalConversationId),
				),
			)
			.get()
	}

	async listForTask(taskId: string): Promise<ConversationBindingRow[]> {
		return this.db
			.select()
			.from(conversationBindings)
			.where(eq(conversationBindings.task_id, taskId))
			.all()
	}
}
