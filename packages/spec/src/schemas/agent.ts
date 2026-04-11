import { z } from 'zod'

export const FsScopeSchema = z.object({
	read: z.array(z.string()).default([]),
	write: z.array(z.string()).default([]),
})

/**
 * Declarative trigger shape for agent YAML. Reserved for future use.
 * Currently inert — no runtime code reads or dispatches agent triggers.
 * Scheduling is handled exclusively by ScheduleService + SchedulerDaemon.
 */
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
	/** Canonical provider hint (e.g. 'anthropic', 'openai'). Carried as intent; not yet used for claim routing. */
	provider: z.string().optional(),
	/** Behavioral variant hint (e.g. 'extended-thinking'). Carried as canonical intent; variant-specific adapter behavior is deferred. */
	variant: z.string().optional(),
	fs_scope: FsScopeSchema.optional(),
	/** Reserved. Agent triggers are declared but not read at runtime. Scheduling uses ScheduleService. */
	triggers: z.array(AgentTriggerSchema).default([]),
	/** Capability profile IDs active for all runs by this agent. Step-level profiles extend these. */
	capability_profiles: z.array(z.string()).default([]),
})
