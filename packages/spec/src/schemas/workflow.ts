import { z } from 'zod'

export const WorkflowValidationRuleSchema = z.object({
	type: z.string(),
	target: z.string().optional(),
	value: z.unknown().optional(),
	message: z.string().optional(),
	params: z.record(z.string(), z.unknown()).default({}),
})

export const WorkflowValidationSchema = z.object({
	mode: z.enum(['auto', 'human', 'review', 'tool', 'composite']).default('auto'),
	gate: z.string().optional(),
	tool: z.string().optional(),
	reviewers_roles: z.array(z.string()).optional(),
	min_approvals: z.number().int().min(1).optional(),
	on_reject: z.string().optional(),
	on_reject_max_rounds: z.number().int().min(1).optional(),
	required_outputs: z.array(z.string()).default([]),
	rules: z.array(WorkflowValidationRuleSchema).default([]),
})

export const WorkflowExecutorSchema = z.object({
	kind: z.enum(['agent', 'human', 'tool', 'sub_workflow']),
	role: z.string().optional(),
	agent_id: z.string().optional(),
	gate: z.string().optional(),
	tool: z.string().optional(),
	workflow: z.string().optional(),
	model_policy: z.string().optional(),
})

export const WorkflowSpawnWorkflowSchema = z.object({
	workflow: z.string(),
	input_map: z.record(z.string(), z.string()).default({}),
	result_map: z.record(z.string(), z.string()).default({}),
	idempotency_key: z.string().optional(),
})

export const WorkflowFailureActionSchema = z.enum([
	'retry',
	'revise',
	'escalate',
	'block',
	'spawn_workflow',
])

export const WorkflowFailurePolicySchema = z.object({
	action: WorkflowFailureActionSchema,
	model_policy: z.string().optional(),
	workflow: z.string().optional(),
	input_map: z.record(z.string(), z.string()).default({}),
	idempotency_key: z.string().optional(),
})

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

export const WorkflowTransitionsSchema = z.union([z.string(), z.record(z.string(), z.string())])

const WorkflowStepBaseSchema = z.object({
	id: z.string(),
	name: z.string().optional(),
	type: z.enum(['agent', 'human_gate', 'terminal', 'sub_workflow']).default('agent'),
	executor: WorkflowExecutorSchema.optional(),
	spawn_workflow: WorkflowSpawnWorkflowSchema.optional(),
	assigned_role: z.string().optional(),
	assigned_to: z.string().optional(),
	gate: z.string().optional(),
	description: z.string().default(''),
	instructions: z.string().optional(),

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
	validate: WorkflowValidationSchema.optional(),
	on_fail: z.union([WorkflowFailureActionSchema, WorkflowFailurePolicySchema]).optional(),
	auto_execute: z.boolean().default(false),
	max_retries: z.number().int().min(0).optional(),
	model_policy: z.string().optional(),
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

export const WorkflowStepSchema = WorkflowStepBaseSchema.superRefine((step, ctx) => {
	const isSubWorkflowStep = step.type === 'sub_workflow' || step.executor?.kind === 'sub_workflow'
	const subWorkflowId = step.spawn_workflow?.workflow ?? step.executor?.workflow

	if (isSubWorkflowStep && !subWorkflowId) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: 'sub_workflow steps must declare spawn_workflow.workflow or executor.workflow',
			path: ['spawn_workflow'],
		})
	}
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
