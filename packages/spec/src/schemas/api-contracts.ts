import { z } from 'zod'
import { ExecutionTargetSchema } from './workflow'
import { ExternalActionSchema } from './external-action'
import { SecretRefSchema } from './secret-ref'

// ─── Shared ────────────────────────────────────────────────────────────────

/** A single runtime capability a worker advertises. */
export const WorkerCapabilitySchema = z.object({
	runtime: z.string(),
	models: z.array(z.string()).default([]),
	maxConcurrent: z.number().int().default(1),
	/** Explicit tags this worker advertises (e.g. 'staging', 'gpu', 'github'). */
	tags: z.array(z.string()).default([]),
})

// ─── Worker Registration ────────────────────────────────────────────────────

export const WorkerRegisterRequestSchema = z.object({
	id: z.string().min(1),
	device_id: z.string().optional(),
	name: z.string().optional(),
	capabilities: z.array(WorkerCapabilitySchema).default([]),
})

export const WorkerRegisterResponseSchema = z.object({
	workerId: z.string(),
	status: z.string(),
})

// ─── Worker Heartbeat ───────────────────────────────────────────────────────

export const WorkerHeartbeatRequestSchema = z.object({
	worker_id: z.string().min(1),
})

// ─── Worker Claim ───────────────────────────────────────────────────────────

export const WorkerClaimRequestSchema = z.object({
	worker_id: z.string().min(1),
	runtime: z.string().optional(),
})

/**
 * Portable execution context the worker receives when claiming a run.
 *
 * This is the resolved contract — the worker should not need to walk
 * a project filesystem or resolve config to execute a run.
 *
 * Orchestrator enriches the raw run row with:
 * - task context (title, description)
 * - agent identity (name, role) from authored config
 * - separated actions/secret_refs (split from the targeting blob)
 */
export const ClaimedRunSchema = z.object({
	id: z.string(),
	agent_id: z.string(),
	task_id: z.string().nullable(),
	runtime: z.string(),
	status: z.string(),

	// ─── Task context ──────────────────────────────────────────────
	task_title: z.string().nullable().optional(),
	task_description: z.string().nullable().optional(),

	// ─── Agent identity (resolved from authored config) ────────────
	agent_name: z.string().nullable().optional(),
	agent_role: z.string().nullable().optional(),

	// ─── Execution ─────────────────────────────────────────────────
	/** Fully baked instructions — includes context forwarding, step instructions, output suffix. */
	instructions: z.string().nullable().optional(),

	// ─── Session continuation ──────────────────────────────────────
	runtime_session_ref: z.string().nullable().optional(),
	resumed_from_run_id: z.string().nullable().optional(),

	// ─── Execution targeting (constraints only) ────────────────────
	targeting: z.record(z.unknown()).nullable().optional(),

	// ─── Post-run hooks (separated from targeting) ─────────────────
	actions: z.array(ExternalActionSchema).default([]),
	secret_refs: z.array(SecretRefSchema).default([]),

	// ─── Pre-resolved shared secrets ───────���───────────────────────
	/**
	 * Decrypted shared secret values delivered by the orchestrator at claim time.
	 * Only includes secrets with scope 'worker' or 'provider' — never 'orchestrator_only'.
	 * Keyed by secret name → plaintext value.
	 */
	resolved_shared_secrets: z.record(z.string()).default({}),
})

export const WorkerClaimResponseSchema = z.object({
	run: ClaimedRunSchema.nullable(),
	lease_id: z.string().nullable(),
})

// ─── Worker Deregister ──────────────────────────────────────────────────────

export const WorkerDeregisterRequestSchema = z.object({
	worker_id: z.string().min(1),
})

// ─── Run Event POST ─────────────────────────────────────────────────────────
// Uses WorkerEventSchema from worker-event.ts

// ─── Run Completion POST ────────────────────────────────────────────────────
// Uses RunCompletionSchema from worker-event.ts

// ─── Run Creation ───────────────────────────────────────────────────────────

export const CreateRunRequestSchema = z.object({
	agent_id: z.string().min(1),
	task_id: z.string().optional(),
	runtime: z.string().min(1).default('claude-code'),
	initiated_by: z.string().optional(),
	instructions: z.string().optional(),
	/** For continuation runs: the run being continued. */
	resumed_from_run_id: z.string().optional(),
	/** For continuation runs: the worker-local session to resume. */
	runtime_session_ref: z.string().optional(),
	/** For continuation runs: route to this specific worker. */
	preferred_worker_id: z.string().optional(),
	/** Execution targeting hints (resolved by orchestrator or passed explicitly). */
	targeting: ExecutionTargetSchema.optional(),
})

// ─── Run Continuation ──────────────────────────────────────────────────────

export const ContinueRunRequestSchema = z.object({
	/** New instructions / steering message for the continuation. */
	message: z.string().min(1),
	/** Override initiator (defaults to original run's initiator). */
	initiated_by: z.string().optional(),
})

// ─── Worker Enrollment ─────────────────────────────────────────────────────

export const CreateJoinTokenRequestSchema = z.object({
	/** Human-readable description (e.g. "Andrej laptop"). */
	description: z.string().optional(),
	/** Token lifetime in seconds. Default 3600 (1 hour). */
	ttl_seconds: z.number().int().positive().default(3600),
})

export const CreateJoinTokenResponseSchema = z.object({
	/** Token ID (for reference/revocation). */
	token_id: z.string(),
	/** The secret to pass to the worker. Only returned once. */
	secret: z.string(),
	/** When the token expires. */
	expires_at: z.string(),
})

export const WorkerEnrollRequestSchema = z.object({
	/** The join token secret. */
	token: z.string().min(1),
	/** Worker's self-chosen display name. */
	name: z.string().min(1),
	/** Device identifier. */
	device_id: z.string().min(1),
	/** Runtime capabilities. */
	capabilities: z.array(WorkerCapabilitySchema).default([]),
})

export const WorkerEnrollResponseSchema = z.object({
	/** Durable worker ID assigned by orchestrator. */
	worker_id: z.string(),
	/** Durable machine secret for subsequent API calls. */
	machine_secret: z.string(),
})
