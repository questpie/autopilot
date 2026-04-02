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

export const WorkflowStepSchema = z.object({
	id: z.string(),
	name: z.string().optional(),
	type: z.enum(['agent', 'human_approval', 'done']),
	/** The agent that executes this step. Required for 'agent' steps. */
	agent_id: z.string().optional(),
	/** Instructions passed to the agent run. */
	instructions: z.string().optional(),
	/** Who can approve. Only meaningful for 'human_approval' steps. Not enforced yet — any authenticated user can approve. */
	approvers: z.array(z.string()).optional(),
	/** Explicit next step ID. Falls back to array order if omitted. */
	next: z.string().optional(),
	/** Execution targeting hints for the run created by this step. */
	targeting: ExecutionTargetSchema.optional(),
	/** External actions to execute after the step's run completes. */
	actions: z.array(ExternalActionSchema).default([]),
})

export const WorkflowSchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string().default(''),
	steps: z.array(WorkflowStepSchema),
})
