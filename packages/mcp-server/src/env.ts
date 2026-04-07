import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

const DEFAULT_AUTOPILOT_API_URL = 'http://localhost:7778'

export const env = createEnv({
	server: {
		AUTOPILOT_API_URL: z.string().url().default(DEFAULT_AUTOPILOT_API_URL),
		AUTOPILOT_API_KEY: z.string().optional(),
		/** When 'true', sends X-Local-Dev header instead of Bearer auth. Only for `autopilot start`. */
		AUTOPILOT_LOCAL_DEV: z.string().optional(),
	},
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
})
