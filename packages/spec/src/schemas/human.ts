import { z } from 'zod'
import { HUMAN_ROLES } from '../constants'

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
	role: z.enum(HUMAN_ROLES),
	email: z.string().email().optional(),
	notification_routing: z.record(z.string(), NotificationRoutingSchema).default({}),
	quiet_hours: QuietHoursSchema.default({}),
})

/** @deprecated Use HumanSchema directly — humans are now individual files in HUMANS_DIR */
export const HumansFileSchema = HumanSchema
