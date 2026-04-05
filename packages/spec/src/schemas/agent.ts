import { z } from 'zod'

export const FsScopeSchema = z.object({
	read: z.array(z.string()).default([]),
	write: z.array(z.string()).default([]),
})

export const AgentTriggerSchema = z.object({
	on: z.string(),
	status: z.string().optional(),
	cron: z.string().optional(),
})

export const AgentSchema = z.object({
	id: z.string().regex(/^[a-z0-9-]+$/),
	name: z.string(),
	role: z.string(),
	description: z.string().default(''),
	model: z.string().optional(),
	fs_scope: FsScopeSchema.optional(),
	triggers: z.array(AgentTriggerSchema).default([]),
	/** Capability profile IDs active for all runs by this agent. Step-level profiles extend these. */
	capability_profiles: z.array(z.string()).default([]),
})
