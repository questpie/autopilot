import { z } from 'zod'

export const ScheduleSchema = z.object({
	id: z.string(),
	agent: z.string(),
	cron: z.string(),
	description: z.string().default(''),
	create_task: z.boolean().default(false),
	task_template: z.record(z.string()).optional(),
	workflow: z.string().optional(),
	workflow_inputs: z.record(z.string(), z.unknown()).optional(),
	enabled: z.boolean().default(true),
})

/** @deprecated Each file is now a single schedule. Use ScheduleSchema directly. */
export const SchedulesFileSchema = ScheduleSchema
