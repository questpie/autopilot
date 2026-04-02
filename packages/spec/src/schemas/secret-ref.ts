import { z } from 'zod'

/** A reference to a secret value. The orchestrator stores only the ref — workers resolve values locally. */
export const SecretRefSchema = z.object({
	/** Unique name for this secret reference (e.g. "deploy-webhook-url"). */
	name: z.string().min(1),
	/** How the worker resolves the actual value: env var, file read, or command exec. */
	source: z.enum(['env', 'file', 'exec']),
	/** Source-specific key: env var name, file path, or shell command. */
	key: z.string().min(1),
	/** Human-readable description. */
	description: z.string().optional(),
})
