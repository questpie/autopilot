import { z } from 'zod'

export const MessageSchema = z.object({
	id: z.string(),
	from: z.string(),
	to: z.string().optional(),
	channel: z.string().optional(),
	at: z.string().datetime(),
	content: z.string(),
	mentions: z.array(z.string()).default([]),
	references: z.array(z.string()).default([]),
	reactions: z.array(z.string()).default([]),
	thread: z.string().nullable().default(null),
	transport: z.string().optional(),
	external: z.boolean().default(false),
})
