import { z } from 'zod'
import { TASK_STATUSES, TASK_TYPES, PRIORITIES } from '../constants'

export const TaskHistoryEntrySchema = z.object({
	at: z.string().datetime(),
	by: z.string(),
	action: z.string(),
	note: z.string().optional(),
	from: z.string().optional(),
	to: z.string().optional(),
	step: z.string().optional(),
	from_step: z.string().optional(),
	to_step: z.string().optional(),
})

export const BlockerSchema = z.object({
	type: z.string().default('human_required'),
	reason: z.string(),
	assigned_to: z.string(),
	resolved: z.boolean().default(false),
	resolved_at: z.string().datetime().optional(),
	resolved_by: z.string().optional(),
	resolved_note: z.string().optional(),
})

export const TaskContextSchema = z.record(z.string(), z.string()).default({})

export const TaskSchema = z.object({
	id: z.string(),
	title: z.string(),
	description: z.string().default(''),
	type: z.enum(TASK_TYPES),
	status: z.enum(TASK_STATUSES),
	priority: z.enum(PRIORITIES).default('medium'),

	created_by: z.string(),
	assigned_to: z.string().optional(),
	reviewers: z.array(z.string()).default([]),
	approver: z.string().optional(),

	project: z.string().optional(),
	parent: z.string().nullable().default(null),
	depends_on: z.array(z.string()).default([]),
	blocks: z.array(z.string()).default([]),
	related: z.array(z.string()).default([]),

	workflow: z.string().optional(),
	workflow_step: z.string().optional(),

	context: TaskContextSchema,
	blockers: z.array(BlockerSchema).default([]),

	created_at: z.string().datetime(),
	updated_at: z.string().datetime(),
	started_at: z.string().datetime().optional(),
	completed_at: z.string().datetime().optional(),
	deadline: z.string().datetime().optional(),

	history: z.array(TaskHistoryEntrySchema).default([]),

	_linear_id: z.string().optional(),
	_github_pr: z.string().optional(),
})
