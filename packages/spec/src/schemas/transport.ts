import { z } from 'zod'

export const TransportConfigSchema = z.object({
	id: z.string(),
	type: z.string(),
	enabled: z.boolean().default(true),
	config: z.record(z.string()).default({}),
})

export const TransportsFileSchema = z.object({
	transports: z.array(TransportConfigSchema),
})
