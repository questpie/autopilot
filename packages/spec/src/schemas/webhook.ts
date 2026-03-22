import { z } from 'zod'

export const WebhookFilterSchema = z.object({
	headers: z.record(z.string()).optional(),
	payload: z.record(z.union([z.string(), z.array(z.string())])).optional(),
})

export const WebhookActionSchema = z.object({
	type: z.enum(['spawn_agent', 'create_task']).default('spawn_agent'),
	priority: z.enum(['normal', 'urgent']).default('normal'),
	context_template: z.string().default(''),
})

export const WebhookTaskConditionSchema = z.object({
	condition: z.string(),
	task_template: z.record(z.string()),
})

export const WebhookSchema = z.object({
	id: z.string(),
	path: z.string(),
	agent: z.string(),
	description: z.string().default(''),
	auth: z.enum(['hmac_sha256', 'bearer_token', 'none']).default('hmac_sha256'),
	secret_ref: z.string().optional(),
	filter: WebhookFilterSchema.optional(),
	action: WebhookActionSchema,
	create_task_if: WebhookTaskConditionSchema.optional(),
	enabled: z.boolean().default(true),
})

export const WebhooksFileSchema = z.object({
	server: z
		.object({
			base_url: z.string().url(),
			auth: z
				.object({
					type: z.string(),
					secret_ref: z.string(),
				})
				.optional(),
		})
		.optional(),
	webhooks: z.array(WebhookSchema),
})
