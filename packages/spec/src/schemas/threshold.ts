import { z } from 'zod'

export const ThresholdSchema = z.object({
	id: z.string(),
	agent: z.string(),
	metric: z.string(),
	condition: z.string(),
	description: z.string().default(''),
	action: z.enum(['spawn_agent', 'alert_human']),
	priority: z.enum(['normal', 'urgent']).optional(),
	create_task: z.boolean().default(false),
	task_template: z.record(z.string()).optional(),
	cooldown: z.string().default('1h'),
	enabled: z.boolean().default(true),
})
