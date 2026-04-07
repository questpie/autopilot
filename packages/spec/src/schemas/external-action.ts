import { z } from 'zod'
import { ArtifactKindSchema, ArtifactRefKindSchema } from './artifact'

// ─── Webhook action (existing) ─────────────────────────────────────────────

export const WebhookActionSchema = z.object({
	kind: z.literal('webhook'),
	/** Secret ref name whose resolved value is the URL. */
	url_ref: z.string().min(1),
	method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('POST'),
	/** Secret ref name for headers JSON. */
	headers_ref: z.string().optional(),
	/** Static body template. */
	body: z.string().optional(),
	/** Idempotency key to prevent duplicate executions. */
	idempotency_key: z.string().optional(),
	/** Environment to resolve secret refs from. */
	environment: z.string().optional(),
})

// ─── Script action (new) ───────────────────────────────────────────────────

export const ScriptRunnerSchema = z.enum(['bun', 'node', 'python3', 'bash', 'exec'])

export const ScriptActionSchema = z.object({
	kind: z.literal('script'),
	/** Repo-relative path to the script file. */
	script: z.string().min(1),
	/** Arguments passed to the script. */
	args: z.array(z.string()).default([]),
	/** Repo-relative working directory. Defaults to workspace root. */
	cwd: z.string().optional(),
	/** Execution timeout in milliseconds. */
	timeout_ms: z.number().int().positive().optional(),
	/** Runner to use for script execution. `exec` means direct invocation. */
	runner: ScriptRunnerSchema.default('exec'),
	/** Static non-secret environment variables. */
	env: z.record(z.string()).optional(),
	/** Secret environment variables. Key = env var name, value = secret ref name. */
	secret_env: z.record(z.string()).optional(),
	/** Artifact titles from the just-completed run result to make available to the script. */
	input_artifacts: z.array(z.string()).optional(),
})

// ─── Script result contract ────────────────────────────────────────────────

/** Shape a script may emit on stdout as JSON to contribute to the run result. */
export const ScriptResultSchema = z.object({
	summary: z.string().optional(),
	artifacts: z
		.array(
			z.object({
				kind: ArtifactKindSchema.default('other'),
				title: z.string(),
				ref_kind: ArtifactRefKindSchema.default('file'),
				ref_value: z.string(),
				mime_type: z.string().optional(),
				metadata: z.record(z.unknown()).optional(),
			}),
		)
		.optional(),
	outputs: z.record(z.string()).optional(),
})

// ─── Discriminated union ───────────────────────────────────────────────────

/** A side-effecting external action executed by the worker after a run step. */
export const ExternalActionSchema = z.discriminatedUnion('kind', [
	WebhookActionSchema,
	ScriptActionSchema,
])
