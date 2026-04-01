import { z } from 'zod'

/**
 * Preprocess helper: coerce `null` → `undefined` so that Zod `.default()` can
 * kick in.  YAML parsers emit `null` for explicit `key: null` or `key: ` lines,
 * which would otherwise bypass `.default()` (it only handles `undefined`).
 */
const nullToUndefined = (v: unknown) => (v === null ? undefined : v)

export const NotificationChannelSchema = z.object({
	type: z.string(),
	address: z.string().optional(),
	number: z.string().optional(),
	webhook: z.string().url().optional(),
	user: z.string().optional(),
	enabled: z.preprocess(nullToUndefined, z.boolean().default(true)),
})

export const CompanyOwnerSchema = z.object({
	name: z.preprocess(nullToUndefined, z.string().default('Unknown')),
	email: z.preprocess(nullToUndefined, z.string().email().default('owner@example.com')),
	notification_channels: z.preprocess(
		nullToUndefined,
		z.array(NotificationChannelSchema).default([]),
	),
})

export const CompanySettingsSchema = z.object({
	auto_assign: z.preprocess(nullToUndefined, z.boolean().default(true)),
	require_approval: z.preprocess(
		nullToUndefined,
		z.array(z.string()).default(['merge', 'deploy', 'spend', 'publish']),
	),
	max_concurrent_agents: z.preprocess(nullToUndefined, z.number().int().min(1).default(6)),
	agent_provider: z.preprocess(nullToUndefined, z.string().default('tanstack-ai')),
	agent_model: z.preprocess(nullToUndefined, z.string().default('anthropic/claude-sonnet-4')),
	budget: z.preprocess(
		nullToUndefined,
		z
			.object({
				daily_token_limit: z.preprocess(nullToUndefined, z.number().int().default(5_000_000)),
				alert_at: z.preprocess(
					nullToUndefined,
					z.number().int().min(0).max(100).default(80),
				),
			})
			.default({}),
	),
	auth: z.preprocess(
		nullToUndefined,
		z
			.object({
				cors_origin: z.string().optional(),
				ip_allowlist: z.preprocess(nullToUndefined, z.array(z.string()).default([])),
				trusted_proxies: z.preprocess(
					nullToUndefined,
					z.array(z.string()).default(['127.0.0.1', '::1', '::ffff:127.0.0.1']),
				),
			})
			.default({}),
	),
	/** Model for lightweight classification tasks (micro-agents, routing, memory extraction). */
	utility_model: z.preprocess(nullToUndefined, z.string().default('google/gemma-3-4b-it:free')),
	ai_provider: z.preprocess(
		nullToUndefined,
		z
			.object({
				provider: z.preprocess(nullToUndefined, z.string().default('openrouter')),
				secret_ref: z.string().optional(),
				base_url: z.string().url().optional(),
				default_model: z.string().optional(),
				utility_model: z.string().optional(),
			})
			.optional(),
	),
	micro_agents: z.preprocess(
		nullToUndefined,
		z
			.object({
				cache_ttl: z.preprocess(nullToUndefined, z.number().default(300)),
				escalation_threshold: z.preprocess(nullToUndefined, z.number().default(30)),
			})
			.default({}),
	),
	embeddings: z.preprocess(
		nullToUndefined,
		z
			.object({
				/** Embedding model on OpenRouter (default: nvidia/llama-nemotron-embed-vl-1b-v2:free) */
				model: z.string().optional(),
				dimensions: z.preprocess(nullToUndefined, z.number().int().min(1).default(768)),
			})
			.optional(),
	),
	agent_http_allowlist: z.preprocess(nullToUndefined, z.array(z.string()).optional()),
})

export const IntegrationConfigSchema = z.record(z.string(), z.record(z.string(), z.unknown()))

export const CompanySchema = z.object({
	name: z.preprocess(nullToUndefined, z.string().default('My Company')),
	slug: z.preprocess(nullToUndefined, z.string().regex(/^[a-z0-9-]+$/).default('my-company')),
	description: z.preprocess(nullToUndefined, z.string().default('')),
	timezone: z.preprocess(nullToUndefined, z.string().default('UTC')),
	language: z.preprocess(nullToUndefined, z.string().default('en')),
	languages: z.preprocess(nullToUndefined, z.array(z.string()).default(['en'])),
	owner: z.preprocess(nullToUndefined, CompanyOwnerSchema.default({})),
	settings: z.preprocess(nullToUndefined, CompanySettingsSchema.default({})),
	integrations: z.preprocess(nullToUndefined, IntegrationConfigSchema.optional().default({})),
	setup_completed: z.preprocess(nullToUndefined, z.boolean().default(false)),
	setup_completed_at: z.string().optional(),
	setup_completed_by: z.string().optional(),
	onboarding_chat_completed: z.preprocess(nullToUndefined, z.boolean().default(false)),
})
