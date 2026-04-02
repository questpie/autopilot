import { z } from 'zod'

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
})

export const WorkflowSchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string().default(''),
	steps: z.array(WorkflowStepSchema),
})
