import { DeploymentModeSchema } from '@questpie/autopilot-spec'
import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

const urlLikeSchema = z.string().url()
const optionalPositiveInt = z.coerce.number().int().positive().optional()

function assertCommaSeparatedUrls(value: string | undefined, key: string): void {
	if (!value) return
	for (const origin of value
		.split(',')
		.map((part) => part.trim())
		.filter(Boolean)) {
		try {
			new URL(origin)
		} catch {
			throw new Error(`${key} must contain valid comma-separated URLs. Invalid value: ${origin}`)
		}
	}
}

function resolveEnv(runtimeEnv: NodeJS.ProcessEnv) {
	const resolvedEnv = createEnv({
		server: {
			NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
			CORS_ORIGIN: z.string().optional(),
			WEBHOOK_SECRET: z.string().optional(),
			OPENROUTER_API_KEY: z.string().optional(),
			QUESTPIE_AI_PROXY_URL: urlLikeSchema.optional(),
			QUESTPIE_AI_PROXY_TOKEN: z.string().optional(),
			AUTOPILOT_MASTER_KEY: z.string().optional(),
			DATABASE_URL: z.string().optional(),
			TURSO_SYNC_URL: z.string().optional(),
			TURSO_AUTH_TOKEN: z.string().optional(),
			DURABLE_STREAMS_URL: urlLikeSchema.optional(),
			DURABLE_STREAMS_PORT: z.coerce.number().int().positive().default(4437),
			SMTP_HOST: z.string().optional(),
			SMTP_PORT: z.coerce.number().int().positive().optional(),
			SMTP_USER: z.string().optional(),
			SMTP_PASS: z.string().optional(),
			SMTP_FROM: z.string().optional(),
			PLAN_MAX_AGENTS: optionalPositiveInt,
			PLAN_MAX_TOKENS_DAY: optionalPositiveInt,
			DEPLOYMENT_MODE: DeploymentModeSchema.default('selfhosted'),
		},
		runtimeEnv,
		emptyStringAsUndefined: true,
	})

	assertCommaSeparatedUrls(resolvedEnv.CORS_ORIGIN, 'CORS_ORIGIN')

	if (resolvedEnv.SMTP_HOST && !resolvedEnv.SMTP_PORT) {
		throw new Error('SMTP_PORT is required when SMTP_HOST is set')
	}

	if (resolvedEnv.DEPLOYMENT_MODE === 'cloud') {
		if (!resolvedEnv.QUESTPIE_AI_PROXY_URL) {
			throw new Error('QUESTPIE_AI_PROXY_URL is required when DEPLOYMENT_MODE=cloud')
		}
		if (!resolvedEnv.QUESTPIE_AI_PROXY_TOKEN) {
			throw new Error('QUESTPIE_AI_PROXY_TOKEN is required when DEPLOYMENT_MODE=cloud')
		}
	}

	return resolvedEnv
}

export const env = resolveEnv(process.env)

export function getEnv() {
	return resolveEnv(process.env)
}
