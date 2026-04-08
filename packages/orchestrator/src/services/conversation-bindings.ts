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
		// Enforce uniqueness at service level (exact match, no fallback)
		const existing = await this.findExact(input.provider_id, input.external_conversation_id, input.external_thread_id)
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

	/** Exact match — no fallback. Used for uniqueness/idempotency checks. */
	async findExact(
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
					isNull(conversationBindings.external_thread_id),
				),
			)
			.get()
	}

	async findByExternal(
		providerId: string,
		externalConversationId: string,
		externalThreadId?: string,
	): Promise<ConversationBindingRow | undefined> {
		if (externalThreadId) {
			// Try exact thread match first
			const exact = await this.db
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
			if (exact) return exact

			// Fall back to chat-level binding (no thread) for the same provider + conversation.
			// This supports surfaces like Telegram where callbacks carry a per-message thread_id
			// but the operator creates a single chat-level binding.
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

		// For conversation-level bindings (no thread), explicitly match NULL
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
