import { z } from 'zod'

export const NotificationChannelSchema = z.object({
	type: z.string(),
	address: z.string().optional(),
	number: z.string().optional(),
	webhook: z.string().url().optional(),
	user: z.string().optional(),
	enabled: z.boolean().default(true),
})

export const CompanyOwnerSchema = z.object({
	name: z.string(),
	email: z.string().email(),
	notification_channels: z.array(NotificationChannelSchema).default([]),
})

export const CompanySettingsSchema = z.object({
	auto_assign: z.boolean().default(true),
	require_approval: z.array(z.string()).default(['merge', 'deploy', 'spend', 'publish']),
	max_concurrent_agents: z.number().int().min(1).default(6),
	agent_provider: z.string().default('anthropic'),
	agent_model: z.string().default('claude-sonnet-4-20250514'),
	budget: z
		.object({
			daily_token_limit: z.number().int().default(5_000_000),
			alert_at: z.number().int().min(0).max(100).default(80),
		})
		.default({}),
	embeddings: z
		.object({
			provider: z.enum(['gemini', 'multilingual-e5', 'nomic', 'none']).default('none'),
			fallback: z.enum(['gemini', 'multilingual-e5', 'nomic', 'none']).optional(),
			dimensions: z.number().int().min(1).default(768),
		})
		.optional(),
})

export const IntegrationConfigSchema = z.record(z.string(), z.record(z.string(), z.unknown()))

export const CompanySchema = z.object({
	name: z.string(),
	slug: z.string().regex(/^[a-z0-9-]+$/),
	description: z.string(),
	timezone: z.string().default('UTC'),
	language: z.string().default('en'),
	languages: z.array(z.string()).default(['en']),
	owner: CompanyOwnerSchema,
	settings: CompanySettingsSchema.default({}),
	integrations: IntegrationConfigSchema.optional().default({}),
})
