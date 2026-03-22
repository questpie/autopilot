import { z } from 'zod'
import { TRANSPORT_TYPES } from '../constants'

export const TransportConfigSchema = z.object({
	id: z.string(),
	type: z.enum(TRANSPORT_TYPES),
	enabled: z.boolean().default(true),
	config: z.record(z.string()).default({}),
})

export const TransportsFileSchema = z.object({
	transports: z.array(TransportConfigSchema),
})
