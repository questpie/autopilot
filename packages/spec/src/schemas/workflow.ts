import { z } from 'zod'

export const WorkflowStepSchema = z.object({
	id: z.string(),
	name: z.string().optional(),
	type: z.enum(['agent', 'human_approval', 'done']),
	agent_id: z.string().optional(),
	role: z.string().optional(),
	instructions: z.string().optional(),
	approvers: z.array(z.string()).optional(),
	next: z.string().optional(),
})

export const WorkflowSchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string().default(''),
	steps: z.array(WorkflowStepSchema),
})
