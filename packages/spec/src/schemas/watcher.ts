import { z } from 'zod'

export const WatcherSchema = z.object({
	id: z.string(),
	agent: z.string(),
	watch: z.string(),
	events: z.array(z.enum(['create', 'modify', 'delete'])),
	description: z.string().default(''),
	debounce: z.string().default('10s'),
	create_task: z.boolean().default(false),
	task_template: z.record(z.string()).optional(),
	enabled: z.boolean().default(true),
})
