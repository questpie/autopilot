/**
 * SecretService — CRUD for orchestrator-managed shared secrets.
 *
 * All values are encrypted at rest using AES-256-GCM (see crypto.ts).
 * Listing never returns raw values — only metadata.
 */
import { eq, inArray } from 'drizzle-orm'
import type { CompanyDb } from '../db'
import { sharedSecrets } from '../db/company-schema'
import { encrypt, decrypt } from '../crypto'
import type { SharedSecretScope, SharedSecretMetadata } from '@questpie/autopilot-spec'

export type SharedSecretRow = typeof sharedSecrets.$inferSelect

export class SecretService {
	constructor(private db: CompanyDb) {}

	/**
	 * Set (create or update) a shared secret.
	 * The plaintext value is encrypted before storage.
	 */
	async set(input: {
		name: string
		scope: SharedSecretScope
		value: string
		description?: string
	}): Promise<SharedSecretMetadata> {
		const now = new Date().toISOString()
		const payload = encrypt(input.value)

		const existing = await this.findByName(input.name)

		if (existing) {
			const description = input.description ?? existing.description
			await this.db
				.update(sharedSecrets)
				.set({
					scope: input.scope,
					encrypted_value: payload.ciphertext,
					iv: payload.iv,
					auth_tag: payload.auth_tag,
					description,
					updated_at: now,
				})
				.where(eq(sharedSecrets.name, input.name))

			return toMetadata({ ...existing, scope: input.scope, description, updated_at: now })
		}

		const row = {
			name: input.name,
			scope: input.scope,
			encrypted_value: payload.ciphertext,
			iv: payload.iv,
			auth_tag: payload.auth_tag,
			description: input.description ?? null,
			created_at: now,
			updated_at: now,
		}
		await this.db.insert(sharedSecrets).values(row)

		return toMetadata(row)
	}

	async getValue(name: string): Promise<string | null> {
		const row = await this.findByName(name)
		if (!row) return null
		return decryptRow(row)
	}

	async getMetadata(name: string): Promise<SharedSecretMetadata | null> {
		const row = await this.findByName(name)
		return row ? toMetadata(row) : null
	}

	async list(): Promise<SharedSecretMetadata[]> {
		const rows = await this.db.query.sharedSecrets.findMany()
		return rows.map(toMetadata)
	}

	async delete(name: string): Promise<boolean> {
		const result = await this.db
			.delete(sharedSecrets)
			.where(eq(sharedSecrets.name, name))
			.returning()
		return result.length > 0
	}

	/**
	 * Resolve shared secret refs to their decrypted values, filtered by allowed scopes.
	 *
	 * Used by:
	 * - Provider handler resolution (scope: provider, orchestrator_only)
	 * - Worker claim delivery (scope: worker only)
	 */
	async resolveForScopes(
		names: string[],
		allowedScopes: SharedSecretScope[],
	): Promise<Map<string, string>> {
		const resolved = new Map<string, string>()
		if (names.length === 0) return resolved

		const rows = await this.db.query.sharedSecrets.findMany({
			where: inArray(sharedSecrets.name, names),
		})

		for (const row of rows) {
			if (!allowedScopes.includes(row.scope as SharedSecretScope)) continue
			resolved.set(row.name, decryptRow(row))
		}

		return resolved
	}

	async hasAny(): Promise<boolean> {
		const row = await this.db.query.sharedSecrets.findFirst()
		return row !== undefined
	}

	private async findByName(name: string) {
		return this.db.query.sharedSecrets.findFirst({
			where: eq(sharedSecrets.name, name),
		})
	}
}

function toMetadata(row: SharedSecretRow): SharedSecretMetadata {
	return {
		name: row.name,
		scope: row.scope as SharedSecretScope,
		description: row.description,
		created_at: row.created_at,
		updated_at: row.updated_at,
	}
}

function decryptRow(row: SharedSecretRow): string {
	return decrypt({
		ciphertext: row.encrypted_value,
		iv: row.iv,
		auth_tag: row.auth_tag,
	})
}
