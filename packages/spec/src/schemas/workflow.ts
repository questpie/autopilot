import { z } from 'zod'

/** Execution targeting hints — where a run should execute. */
export const ExecutionTargetSchema = z.object({
	/** Route to a specific worker. */
	preferred_worker_id: z.string().optional(),
	/** Runtime the run must execute on (e.g. 'claude-code'). */
	required_runtime: z.string().optional(),
	/** Capability tags the claiming worker must advertise. */
	required_capabilities: z.array(z.string()).default([]),
	/** If true, relax matching when no exact match is available. Default true. */
	allow_fallback: z.boolean().default(true),
})

export const WorkflowStepSchema = z.object({
	id: z.string(),
	name: z.string().optional(),
	type: z.enum(['agent', 'human_approval', 'done']),
	/** The agent that executes this step. Required for 'agent' steps. */
	agent_id: z.string().optional(),
	/** Instructions passed to the agent run. */
	instructions: z.string().optional(),
	/** Who can approve. Only meaningful for 'human_approval' steps. */
	approvers: z.array(z.string()).optional(),
	/** Explicit next step ID. Falls back to array order if omitted. */
	next: z.string().optional(),
	/** Execution targeting hints for the run created by this step. */
	targeting: ExecutionTargetSchema.optional(),
})

export const WorkflowSchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string().default(''),
	steps: z.array(WorkflowStepSchema),
})
