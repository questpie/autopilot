import { z } from 'zod'

export const ScheduleSchema = z.object({
	id: z.string(),
	agent: z.string(),
	cron: z.string(),
	description: z.string().default(''),
	create_task: z.boolean().default(false),
	task_template: z.record(z.string()).optional(),
	timeout: z.string().default('5m'),
	on_failure: z.enum(['alert_human', 'retry', 'ignore']).default('alert_human'),
	enabled: z.boolean().default(true),
})

export const SchedulesFileSchema = z.object({
	schedules: z.array(ScheduleSchema),
})
