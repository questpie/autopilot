/**
 * Canonical standalone script model.
 * Scripts can exist independently (managed via .autopilot/scripts/*.yaml)
 * or be referenced from workflow step actions by ID.
 */
import { z } from 'zod'
import { FsScopeSchema } from './agent'
import { ScriptRunnerSchema } from './external-action'

export const ScriptInputSchema = z.object({
	name: z.string(),
	description: z.string().default(''),
	type: z.enum(['string', 'number', 'boolean', 'json']).default('string'),
	required: z.boolean().default(false),
	default: z.unknown().optional(),
})

export const ScriptOutputSchema = z.object({
	name: z.string(),
	description: z.string().default(''),
	type: z.enum(['string', 'number', 'boolean', 'json']).default('string'),
})

export const ScriptSandboxSchema = z.object({
	/** Filesystem access scopes. Defaults to read-only workspace root. */
	fs_scope: FsScopeSchema.default({ read: ['.'], write: [] }),
	/** Network access policy. Phase 1: advisory only, enforcement deferred to Phase 6. */
	network: z.enum(['none', 'local', 'unrestricted']).default('unrestricted'),
	/** Max execution time in ms. */
	timeout_ms: z.number().int().positive().default(300_000),
	/** Max memory in MB (advisory in Phase 1). */
	max_memory_mb: z.number().int().positive().optional(),
})

export const StandaloneScriptSchema = z.object({
	id: z.string().regex(/^[a-z0-9-]+$/),
	name: z.string().min(1),
	description: z.string().default(''),
	/** Repo-relative path to the script entry point. */
	entry_point: z.string().min(1),
	runner: ScriptRunnerSchema.default('exec'),
	/** Declared inputs the script accepts. */
	inputs: z.array(ScriptInputSchema).default([]),
	/** Declared outputs the script produces. */
	outputs: z.array(ScriptOutputSchema).default([]),
	/** Sandbox constraints. */
	sandbox: ScriptSandboxSchema.default({}),
	/** Static env vars. */
	env: z.record(z.string()).optional(),
	/** Secret env var references. */
	secret_env: z.record(z.string()).optional(),
	/** Tags for categorization/filtering. */
	tags: z.array(z.string()).default([]),
})
