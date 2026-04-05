import { z } from 'zod'

// ─── Secret Reference ─────────────────────────────────────────────────────

const localRefBase = {
	name: z.string().min(1),
	key: z.string().min(1),
	description: z.string().optional(),
}

/** Local secret ref — worker resolves value on its own machine. */
export const LocalSecretRefSchema = z.object({
	...localRefBase,
	source: z.enum(['env', 'file', 'exec']),
})

/** Shared secret ref — value is orchestrator-managed and delivered at claim time. */
export const SharedSecretRefSchema = z.object({
	name: z.string().min(1),
	source: z.literal('shared'),
	description: z.string().optional(),
})

/**
 * A reference to a secret value.
 *
 * - Local refs (env/file/exec): workers resolve values on their own machine.
 * - Shared refs: orchestrator stores encrypted value and delivers it at claim time.
 */
export const SecretRefSchema = z.discriminatedUnion('source', [
	z.object({ ...localRefBase, source: z.literal('env') }),
	z.object({ ...localRefBase, source: z.literal('file') }),
	z.object({ ...localRefBase, source: z.literal('exec') }),
	SharedSecretRefSchema,
])

// ─── Shared Secret Store ──────────────────────────────────────────────────

/** Scope determines who can receive a shared secret's value. */
export const SharedSecretScopeSchema = z.enum(['worker', 'provider', 'orchestrator_only'])

/** Schema for creating/updating a shared secret in the orchestrator store. */
export const SharedSecretInputSchema = z.object({
	/** Unique name (e.g. "TELEGRAM_BOT_TOKEN"). */
	name: z.string().min(1).regex(/^[A-Za-z0-9_.-]+$/, 'Name must be alphanumeric with underscores, dots, or hyphens'),
	/** Who may receive the decrypted value. */
	scope: SharedSecretScopeSchema,
	/** The plaintext value (only accepted on write, never returned on read). */
	value: z.string().min(1),
	/** Optional human-readable description. */
	description: z.string().optional(),
})

/** Metadata returned when listing shared secrets (never includes the raw value). */
export const SharedSecretMetadataSchema = z.object({
	name: z.string(),
	scope: SharedSecretScopeSchema,
	description: z.string().nullable(),
	created_at: z.string(),
	updated_at: z.string(),
})
