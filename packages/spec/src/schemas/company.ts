import { z } from 'zod'

const nullToUndefined = (v: unknown) => (v === null ? undefined : v)

export const CompanyOwnerSchema = z.object({
	name: z.preprocess(nullToUndefined, z.string().default('Unknown')),
	email: z.preprocess(nullToUndefined, z.string().email().default('owner@example.com')),
})

export const CompanySettingsSchema = z.object({
	auto_assign: z.preprocess(nullToUndefined, z.boolean().default(true)),
	require_approval: z.preprocess(
		nullToUndefined,
		z.array(z.string()).default(['merge', 'deploy']),
	),
	max_concurrent_agents: z.preprocess(nullToUndefined, z.number().int().min(1).default(4)),
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
			})
			.default({}),
	),
	inference: z.preprocess(
		nullToUndefined,
		z
			.object({
				gateway_base_url: z.string().default('https://ai-gateway.vercel.sh/v1'),
				text_model: z.string().default('google/gemini-2.5-flash'),
				embedding_model: z.string().default('google/gemini-embedding-2'),
				embedding_dimensions: z.number().int().default(768),
			})
			.default({}),
	),
})

export const CompanySchema = z.object({
	name: z.preprocess(nullToUndefined, z.string().default('My Company')),
	slug: z.preprocess(nullToUndefined, z.string().regex(/^[a-z0-9-]+$/).default('my-company')),
	description: z.preprocess(nullToUndefined, z.string().default('')),
	timezone: z.preprocess(nullToUndefined, z.string().default('UTC')),
	language: z.preprocess(nullToUndefined, z.string().default('en')),
	owner: z.preprocess(nullToUndefined, CompanyOwnerSchema.default({})),
	settings: z.preprocess(nullToUndefined, CompanySettingsSchema.default({})),
	setup_completed: z.preprocess(nullToUndefined, z.boolean().default(false)),
})
