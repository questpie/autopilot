import { z } from 'zod'
import { PIN_TYPES } from '../constants'

export const PinActionSchema = z.object({
	label: z.string(),
	action: z.string(),
})

export const PinMetadataSchema = z.object({
	task_id: z.string().optional(),
	agent_id: z.string().optional(),
	expires_at: z.string().optional(),
	progress: z.number().min(0).max(100).optional(),
	actions: z.array(PinActionSchema).optional(),
})

export const PinSchema = z.object({
	id: z.string(),
	group: z.string(),
	title: z.string(),
	content: z.string().default(''),
	type: z.enum(PIN_TYPES),
	created_by: z.string(),
	created_at: z.string().datetime(),
	expires_at: z.string().datetime().optional(),
	metadata: PinMetadataSchema.default({}),
})

export const DashboardGroupSchema = z.object({
	id: z.string(),
	title: z.string(),
	icon: z.string().optional(),
	position: z.number().int(),
})

export const DashboardGroupsFileSchema = z.object({
	groups: z.array(DashboardGroupSchema),
})
