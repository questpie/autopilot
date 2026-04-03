import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

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
			DATABASE_URL: z.string().optional(),
			TURSO_SYNC_URL: z.string().optional(),
			TURSO_AUTH_TOKEN: z.string().optional(),
			AI_GATEWAY_API_KEY: z.string().optional(),
			/** Public base URL for the orchestrator (used in notifications, preview links). */
			ORCHESTRATOR_URL: z.string().url().optional(),
		},
		runtimeEnv,
		emptyStringAsUndefined: true,
	})

	assertCommaSeparatedUrls(resolvedEnv.CORS_ORIGIN, 'CORS_ORIGIN')

	return resolvedEnv
}

export const env = resolveEnv(process.env)

export function getEnv() {
	return resolveEnv(process.env)
}
