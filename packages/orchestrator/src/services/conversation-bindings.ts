import { eq, and, isNull } from 'drizzle-orm'
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
		// Enforce uniqueness at service level (SQLite unique index doesn't prevent NULL duplicates)
		const existing = await this.findByExternal(input.provider_id, input.external_conversation_id, input.external_thread_id)
		if (existing) {
			throw new Error(
				`Binding already exists for provider=${input.provider_id} conversation=${input.external_conversation_id}` +
				(input.external_thread_id ? ` thread=${input.external_thread_id}` : ''),
			)
		}

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

		// For conversation-level bindings (no thread), explicitly match NULL
		// to avoid SQLite's NULL != NULL uniqueness quirk
		return this.db
			.select()
			.from(conversationBindings)
			.where(
				and(
					eq(conversationBindings.provider_id, providerId),
					eq(conversationBindings.external_conversation_id, externalConversationId),
					isNull(conversationBindings.external_thread_id),
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
