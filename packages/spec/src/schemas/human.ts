import { z } from 'zod'

export const NotificationRoutingSchema = z.object({
	transports: z.array(z.string()),
	throttle: z.string().nullable().default(null),
	batch: z.boolean().default(false),
})

export const QuietHoursSchema = z.object({
	enabled: z.boolean().default(false),
	start: z.string().default('22:00'),
	end: z.string().default('07:00'),
	timezone: z.string().default('UTC'),
	except: z.array(z.string()).default(['urgent']),
})

export const HumanSchema = z.object({
	id: z.string(),
	name: z.string(),
	role: z.string(),
	description: z.string().default(''),
	notification_routing: z.record(z.string(), NotificationRoutingSchema).default({}),
	quiet_hours: QuietHoursSchema.default({}),
	transport_config: z.record(z.string(), z.record(z.string())).default({}),
	approval_scopes: z.array(z.string()).default([]),
})

export const HumansFileSchema = z.object({
	humans: z.array(HumanSchema),
})
