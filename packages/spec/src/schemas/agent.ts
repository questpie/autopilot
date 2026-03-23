import { z } from 'zod'
import { AGENT_ROLES } from '../constants'

export const FsScopeSchema = z.object({
	read: z.array(z.string()),
	write: z.array(z.string()),
})

export const AgentTriggerSchema = z.object({
	on: z.string(),
	status: z.string().optional(),
	cron: z.string().optional(),
})

/** Supported agent provider backends. */
export const AGENT_PROVIDERS = ['claude-agent-sdk', 'codex-sdk'] as const

export const AgentSchema = z.object({
	id: z.string().regex(/^[a-z0-9-]+$/),
	name: z.string(),
	role: z.enum(AGENT_ROLES),
	description: z.string(),
	provider: z.enum(AGENT_PROVIDERS).default('claude-agent-sdk'),
	model: z.string().default('claude-sonnet-4-20250514'),
	fs_scope: FsScopeSchema,
	tools: z.array(z.string()).default(['fs', 'terminal']),
	mcps: z.array(z.string()).default([]),
	triggers: z.array(AgentTriggerSchema).default([]),
})

export const AgentsFileSchema = z.object({
	agents: z.array(AgentSchema),
})
