import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod/v4'

const DEFAULT_INTERNAL_API_URL = 'http://localhost:7778'

function readServerEnv(name: 'API_INTERNAL_URL'): string | undefined {
	return import.meta.env.SSR ? process.env[name] : undefined
}

export const env = createEnv({
	isServer: import.meta.env.SSR,
	server: {
		API_INTERNAL_URL: z.string().url().default(DEFAULT_INTERNAL_API_URL),
	},
	clientPrefix: 'VITE_',
	client: {
		VITE_API_URL: z.string().url().optional(),
	},
	runtimeEnvStrict: {
		API_INTERNAL_URL: readServerEnv('API_INTERNAL_URL'),
		VITE_API_URL: import.meta.env.VITE_API_URL,
	},
	emptyStringAsUndefined: true,
})

export function getPublicApiBase(): string {
	return env.VITE_API_URL ?? (import.meta.env.DEV ? DEFAULT_INTERNAL_API_URL : '')
}
