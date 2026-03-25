import { z } from 'zod'

export const SecretSchema = z.object({
	service: z.string(),
	type: z.string().default('api_token'),
	created_at: z.string().datetime(),
	created_by: z.string(),
	value: z.string(),
	allowed_agents: z.array(z.string()).default([]),
	usage: z.string().default(''),
	encrypted: z.boolean().default(false),
})
