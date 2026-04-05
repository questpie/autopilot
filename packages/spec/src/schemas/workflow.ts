import { z } from 'zod'
import { ExternalActionSchema } from './external-action'

/** Execution targeting constraints — where a run should execute. */
export const ExecutionTargetSchema = z.object({
	/** Hard pin: only this worker may claim the run. */
	required_worker_id: z.string().optional(),
	/** Runtime the run must execute on (e.g. 'claude-code'). */
	required_runtime: z.string().optional(),
	/** Tags (runtime names, model names, explicit tags) the claiming worker must advertise. */
	required_worker_tags: z.array(z.string()).default([]),
	/** If true, relax runtime/tag matching when no exact match is available. Default true. */
	allow_fallback: z.boolean().default(true),
	/** Environment to resolve tags and secrets from. */
	environment: z.string().optional(),
})

// ─── Step Output Declaration ──────────────────────────────────────────────

/**
 * A tag declaration — describes a named field the agent should produce.
 * All tags have the same shape. `outcome` and `artifacts` are just special names
 * that the engine interprets (routing + registration).
 */
const StepOutputTagSchema = z.object({
	/** What this tag represents (shown to AI as placeholder/description). */
	description: z.string(),
	/** Optional enumerated values. If set, the AI must pick one. */
	values: z.record(z.string()).optional(),
})

/** Artifact declaration — engine registers these through the artifact system. */
const StepOutputArtifactSchema = z.object({
	kind: z.string(),
	title: z.string(),
	description: z.string(),
})

/**
 * Declarative output contract for a workflow step.
 * Engine auto-generates structured-output suffix from this.
 *
 * Everything is a tag inside <AUTOPILOT_RESULT>.
 * - `artifacts` is special: engine registers them through the artifact system
 * - All other tags are generic named fields matched by transition rules
 *
 * Any tag can have `values` (constrained enum) or just `description` (freeform).
 */
export const StepOutputSchema = z
	.object({
		artifacts: z.array(StepOutputArtifactSchema).optional(),
	})
	.catchall(StepOutputTagSchema)

// ─── Step Input Declaration ───────────────────────────────────────────────

/** Declarative input for a workflow step — what context should be forwarded from prior steps. */
export const StepInputSchema = z.object({
	/** Artifact kinds to look up from the task's artifact history and include as input context. */
	artifacts: z.array(z.string()).optional(),
})

// ─── Step Transitions ────────────────────────────────────────────────────

/**
 * A single transition rule. Evaluated in order — first match wins.
 * All fields in `when` must match the run's structured output for the transition to fire.
 */
export const StepTransitionSchema = z.object({
	/** Field-value pairs to match against structured output. All must match. */
	when: z.record(z.string()),
	/** Target step ID to jump to. */
	goto: z.string(),
})

// ─── Workflow Step ────────────────────────────────────────────────────────

export const WorkflowStepSchema = z.object({
	id: z.string(),
	name: z.string().optional(),
	type: z.enum(['agent', 'human_approval', 'wait_for_children', 'done']),
	/** The agent that executes this step. Required for 'agent' steps. */
	agent_id: z.string().optional(),
	/** Instructions passed to the agent run. */
	instructions: z.string().optional(),
	/** Who can approve. Only meaningful for 'human_approval' steps. */
	approvers: z.array(z.string()).optional(),
	/** Default next step ID. Falls back to array order if omitted. */
	next: z.string().optional(),

	// ─── Control flow ─────────────────────────────────────────────────
	/** Ordered transition rules. First match wins. Falls back to `next` → array order. */
	transitions: z.array(StepTransitionSchema).optional(),
	on_approve: z.string().optional(),
	on_reply: z.string().optional(),
	on_reject: z.string().optional(),

	// ─── Wait-for-children join policy ────────────────────────────────
	/** Relation type to evaluate. Defaults to 'decomposes_to'. Only for wait_for_children. */
	join_relation_type: z.string().default('decomposes_to'),
	/** Join condition. Only for wait_for_children. */
	join_policy: z.enum(['all_done', 'any_failed']).default('all_done'),
	/** Step to route to when join condition is met. Only for wait_for_children. */
	on_met: z.string().optional(),
	/** Step to route to when a child fails (before all_done). Only for wait_for_children. */
	on_failed: z.string().optional(),

	// ─── Step I/O declarations ────────────────────────────────────────
	/** Declarative output contract. Engine auto-generates structured-output suffix. */
	output: StepOutputSchema.optional(),
	/** Declarative input. Engine forwards specified artifacts as context. */
	input: StepInputSchema.optional(),

	/** Execution targeting hints for the run created by this step. */
	targeting: ExecutionTargetSchema.optional(),
	/** External actions to execute after the step's run completes. */
	actions: z.array(ExternalActionSchema).default([]),
	/** Capability profile IDs active for this step. Extends agent-level profiles (deduplicated). */
	capability_profiles: z.array(z.string()).default([]),
})

export const WorkflowSchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string().default(''),
	steps: z.array(WorkflowStepSchema),
})
