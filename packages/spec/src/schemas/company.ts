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
	agent_provider: z.string().default('tanstack-ai'),
	agent_model: z.string().default('anthropic/claude-sonnet-4'),
	budget: z
		.object({
			daily_token_limit: z.number().int().default(5_000_000),
			alert_at: z.number().int().min(0).max(100).default(80),
		})
		.default({}),
	auth: z
		.object({
			cors_origin: z.string().optional(),
			ip_allowlist: z.array(z.string()).default([]),
			trusted_proxies: z.array(z.string()).default(['127.0.0.1', '::1', '::ffff:127.0.0.1']),
		})
		.nullable()
		.default({})
		.transform((v) => v ?? { ip_allowlist: [], trusted_proxies: ['127.0.0.1', '::1', '::ffff:127.0.0.1'] }),
	/** Model for lightweight classification tasks (micro-agents, routing, memory extraction). */
	utility_model: z.string().default('google/gemma-3-4b-it:free'),
	micro_agents: z
		.object({
			cache_ttl: z.number().default(300),
			escalation_threshold: z.number().default(30),
		})
		.default({}),
	embeddings: z
		.object({
			/** Embedding model on OpenRouter (default: nvidia/llama-nemotron-embed-vl-1b-v2:free) */
			model: z.string().optional(),
			dimensions: z.number().int().min(1).default(768),
		})
		.optional(),
	agent_http_allowlist: z.array(z.string()).optional(),
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
	setup_completed: z.boolean().default(false),
	setup_completed_at: z.string().optional(),
	setup_completed_by: z.string().optional(),
})
