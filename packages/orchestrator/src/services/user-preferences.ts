import { and, eq } from 'drizzle-orm'
import { userPreference } from '../db/auth-schema'
import type { CompanyDb } from '../db'

function parsePreferenceValue(raw: string): unknown {
	try {
		return JSON.parse(raw)
	} catch {
		return null
	}
}

function serializePreferenceValue(value: unknown): string {
	return JSON.stringify(value ?? null)
}

export interface UserPreferenceRecord {
	user_id: string
	key: string
	value: unknown
	created_at: string
	updated_at: string
}

export class UserPreferenceService {
	constructor(private db: CompanyDb) {}

	async list(userId: string): Promise<UserPreferenceRecord[]> {
		const rows = await this.db
			.select()
			.from(userPreference)
			.where(eq(userPreference.userId, userId))
			.all()

		return rows.map((row) => ({
			user_id: row.userId,
			key: row.key,
			value: parsePreferenceValue(row.value),
			created_at: row.createdAt.toISOString(),
			updated_at: row.updatedAt.toISOString(),
		}))
	}

	async get(userId: string, key: string): Promise<UserPreferenceRecord | undefined> {
		const row = await this.db
			.select()
			.from(userPreference)
			.where(and(eq(userPreference.userId, userId), eq(userPreference.key, key)))
			.get()

		if (!row) return undefined

		return {
			user_id: row.userId,
			key: row.key,
			value: parsePreferenceValue(row.value),
			created_at: row.createdAt.toISOString(),
			updated_at: row.updatedAt.toISOString(),
		}
	}

	async set(userId: string, key: string, value: unknown): Promise<UserPreferenceRecord> {
		const now = new Date()
		const serialized = serializePreferenceValue(value)

		await this.db
			.insert(userPreference)
			.values({
				userId,
				key,
				value: serialized,
				createdAt: now,
				updatedAt: now,
			})
			.onConflictDoUpdate({
				target: [userPreference.userId, userPreference.key],
				set: {
					value: serialized,
					updatedAt: now,
				},
			})

		return {
			user_id: userId,
			key,
			value,
			created_at: now.toISOString(),
			updated_at: now.toISOString(),
		}
	}

	async delete(userId: string, key: string): Promise<boolean> {
		const existing = await this.get(userId, key)
		if (!existing) return false

		await this.db
			.delete(userPreference)
			.where(and(eq(userPreference.userId, userId), eq(userPreference.key, key)))
			.run()

		return true
	}
}
