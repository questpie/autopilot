import { z } from 'zod'

export const WorkflowOutputSchema = z.object({
	type: z.string(),
	path_template: z.string().optional(),
	name_template: z.string().optional(),
	description: z.string().optional(),
	target: z.string().optional(),
	labels: z.array(z.string()).optional(),
	environment: z.string().optional(),
})

export const WorkflowReviewSchema = z.object({
	reviewers_roles: z.array(z.string()).optional(),
	min_approvals: z.number().int().min(1).default(1),
	on_reject: z.string().default('revise'),
	on_reject_max_rounds: z.number().int().optional(),
})

export const WorkflowTransitionsSchema = z.union([
	z.string(),
	z.record(z.string(), z.string()),
])

export const WorkflowStepSchema = z.object({
	id: z.string(),
	name: z.string().optional(),
	type: z.enum(['agent', 'human_gate', 'terminal', 'sub_workflow']).default('agent'),
	assigned_role: z.string().optional(),
	assigned_to: z.string().optional(),
	gate: z.string().optional(),
	description: z.string().default(''),

	inputs: z
		.array(
			z.object({
				from_step: z.string(),
				type: z.string().optional(),
			}),
		)
		.optional(),

	outputs: z.array(WorkflowOutputSchema).optional(),
	review: WorkflowReviewSchema.optional(),
	auto_execute: z.boolean().default(false),
	can_skip_if: z.string().optional(),
	can_request_help_from: z.array(z.string()).optional(),

	expected_duration: z.string().optional(),
	timeout: z.string().optional(),
	timeout_action: z.string().optional(),

	transitions: z.record(z.string(), z.union([z.string(), z.record(z.string())])).default({}),

	surface: z.record(z.string(), z.boolean()).optional(),

	actions: z
		.array(
			z.union([
				z.object({ move_task_to: z.string() }),
				z.object({ notify: z.array(z.string()) }),
				z.object({ pin_to_board: z.record(z.string()) }),
				z.object({ trigger_index_rebuild: z.string() }),
			]),
		)
		.optional(),

	terminal: z.boolean().optional(),
})

export const WorkflowChangelogEntrySchema = z.object({
	version: z.number().int(),
	date: z.string(),
	by: z.string(),
	change: z.string(),
	proposed_by: z.string().optional(),
	human_approved: z.boolean().optional(),
})

export const WorkflowChangePolicySchema = z.object({
	propose: z.array(z.string()).default(['any_agent']),
	evaluate: z.array(z.string()).default(['ceo']),
	apply: z.array(z.string()).default(['ceo']),
	human_approval_required_for: z.array(z.string()).default([]),
})

export const WorkflowSchema = z.object({
	id: z.string(),
	name: z.string(),
	version: z.number().int().default(1),
	description: z.string().default(''),
	change_policy: WorkflowChangePolicySchema.default({}),
	changelog: z.array(WorkflowChangelogEntrySchema).default([]),
	steps: z.array(WorkflowStepSchema),
})
