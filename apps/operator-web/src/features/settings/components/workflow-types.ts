/**
 * Form-shape types for the workflow wizard.
 *
 * These intentionally use friendly snake_case keys that map 1:1 to the
 * persisted Workflow schema in `packages/spec/src/schemas/workflow.ts`,
 * so serialization is a flat copy with optional fields stripped.
 */

export type WorkflowStepType = 'agent' | 'human_approval' | 'wait_for_children' | 'done'

export interface WorkflowTransitionDraft {
	when_field: string
	when_value: string
	goto: string
}

export interface WorkflowStepDraft {
	id: string
	name: string
	type: WorkflowStepType
	agent_id?: string
	instructions?: string
	approvers?: string[]
	next?: string

	transitions?: WorkflowTransitionDraft[]
	on_approve?: string
	on_reply?: string
	on_reject?: string

	join_relation_type?: string
	join_policy?: 'all_done' | 'any_failed'
	on_met?: string
	on_failed?: string

	capability_profiles?: string[]
	context?: string[]

	retry_max_attempts?: number
	retry_delay_seconds?: number

	targeting_runtime?: string
	targeting_tags?: string[]
}

export interface WorkflowDraft {
	id: string
	name: string
	description: string
	workspace_mode: 'none' | 'isolated_worktree'
	steps: WorkflowStepDraft[]
}

export const STEP_TYPE_LABEL: Record<WorkflowStepType, string> = {
	agent: 'Agent',
	human_approval: 'Human approval',
	wait_for_children: 'Wait for children',
	done: 'Done',
}

export function emptyStep(id: string, type: WorkflowStepType = 'agent'): WorkflowStepDraft {
	return {
		id,
		name: '',
		type,
		capability_profiles: [],
		context: [],
		approvers: type === 'human_approval' ? [] : undefined,
		instructions: type === 'agent' ? '' : undefined,
		join_policy: type === 'wait_for_children' ? 'all_done' : undefined,
		join_relation_type: type === 'wait_for_children' ? 'decomposes_to' : undefined,
		transitions: [],
		targeting_tags: [],
	}
}

export function emptyWorkflow(id: string): WorkflowDraft {
	return {
		id,
		name: '',
		description: '',
		workspace_mode: 'isolated_worktree',
		steps: [emptyStep('plan'), { ...emptyStep('done'), type: 'done' }],
	}
}

// ─── Parse / serialize ──────────────────────────────────────────────────

function asString(value: unknown): string | undefined {
	return typeof value === 'string' ? value : undefined
}

function asStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return []
	return value.filter((item): item is string => typeof item === 'string')
}

function parseStep(raw: unknown, fallbackId: string): WorkflowStepDraft {
	if (!raw || typeof raw !== 'object') return emptyStep(fallbackId)
	const r = raw as Record<string, unknown>
	const type = (asString(r.type) ?? 'agent') as WorkflowStepType
	const retryPolicy = (r.retry_policy ?? null) as Record<string, unknown> | null
	const targeting = (r.targeting ?? null) as Record<string, unknown> | null
	const transitionsRaw = Array.isArray(r.transitions) ? r.transitions : []

	return {
		id: asString(r.id) ?? fallbackId,
		name: asString(r.name) ?? '',
		type: (['agent', 'human_approval', 'wait_for_children', 'done'] as WorkflowStepType[]).includes(
			type,
		)
			? type
			: 'agent',
		agent_id: asString(r.agent_id),
		instructions: asString(r.instructions),
		approvers: Array.isArray(r.approvers) ? asStringArray(r.approvers) : undefined,
		next: asString(r.next),
		transitions: transitionsRaw.map((t) => {
			const tr = t as Record<string, unknown>
			const when = (tr.when ?? {}) as Record<string, unknown>
			const firstField = Object.keys(when)[0] ?? ''
			const firstValue = firstField ? String(when[firstField] ?? '') : ''
			return {
				when_field: firstField,
				when_value: firstValue,
				goto: asString(tr.goto) ?? '',
			}
		}),
		on_approve: asString(r.on_approve),
		on_reply: asString(r.on_reply),
		on_reject: asString(r.on_reject),
		join_relation_type: asString(r.join_relation_type),
		join_policy:
			r.join_policy === 'all_done' || r.join_policy === 'any_failed' ? r.join_policy : undefined,
		on_met: asString(r.on_met),
		on_failed: asString(r.on_failed),
		capability_profiles: asStringArray(r.capability_profiles),
		context: asStringArray(r.context),
		retry_max_attempts:
			typeof retryPolicy?.max_attempts === 'number' ? retryPolicy.max_attempts : undefined,
		retry_delay_seconds:
			typeof retryPolicy?.delay_seconds === 'number' ? retryPolicy.delay_seconds : undefined,
		targeting_runtime: asString(targeting?.required_runtime),
		targeting_tags: asStringArray(targeting?.required_worker_tags),
	}
}

export function parseWorkflowDraft(value: string, fallbackId: string): WorkflowDraft {
	if (!value.trim()) return emptyWorkflow(fallbackId)
	let raw: unknown
	try {
		raw = JSON.parse(value)
	} catch {
		return emptyWorkflow(fallbackId)
	}
	if (!raw || typeof raw !== 'object') return emptyWorkflow(fallbackId)
	const r = raw as Record<string, unknown>
	const workspace = (r.workspace ?? null) as Record<string, unknown> | null
	const stepsRaw = Array.isArray(r.steps) ? r.steps : []

	return {
		id: asString(r.id) ?? fallbackId,
		name: asString(r.name) ?? '',
		description: asString(r.description) ?? '',
		workspace_mode: workspace?.mode === 'none' ? 'none' : 'isolated_worktree',
		steps: stepsRaw.map((step, index) => parseStep(step, `step-${index + 1}`)),
	}
}

function serializeStep(step: WorkflowStepDraft): Record<string, unknown> {
	const out: Record<string, unknown> = {
		id: step.id,
		type: step.type,
	}
	if (step.name) out.name = step.name
	if (step.agent_id) out.agent_id = step.agent_id
	if (step.instructions) out.instructions = step.instructions
	if (step.approvers && step.approvers.length > 0) out.approvers = step.approvers
	if (step.next) out.next = step.next
	if (step.on_approve) out.on_approve = step.on_approve
	if (step.on_reply) out.on_reply = step.on_reply
	if (step.on_reject) out.on_reject = step.on_reject
	if (step.join_relation_type) out.join_relation_type = step.join_relation_type
	if (step.join_policy) out.join_policy = step.join_policy
	if (step.on_met) out.on_met = step.on_met
	if (step.on_failed) out.on_failed = step.on_failed

	if (step.capability_profiles && step.capability_profiles.length > 0) {
		out.capability_profiles = step.capability_profiles
	}
	if (step.context && step.context.length > 0) out.context = step.context

	if (step.transitions && step.transitions.length > 0) {
		out.transitions = step.transitions
			.filter((t) => t.when_field.trim() && t.goto.trim())
			.map((t) => ({ when: { [t.when_field]: t.when_value }, goto: t.goto }))
	}

	if (step.retry_max_attempts !== undefined || step.retry_delay_seconds !== undefined) {
		const retry: Record<string, unknown> = {}
		if (step.retry_max_attempts !== undefined) retry.max_attempts = step.retry_max_attempts
		if (step.retry_delay_seconds !== undefined) retry.delay_seconds = step.retry_delay_seconds
		out.retry_policy = retry
	}

	if (step.targeting_runtime || (step.targeting_tags && step.targeting_tags.length > 0)) {
		const targeting: Record<string, unknown> = {}
		if (step.targeting_runtime) targeting.required_runtime = step.targeting_runtime
		if (step.targeting_tags && step.targeting_tags.length > 0) {
			targeting.required_worker_tags = step.targeting_tags
		}
		out.targeting = targeting
	}

	return out
}

export function serializeWorkflowDraft(draft: WorkflowDraft): string {
	const out: Record<string, unknown> = {
		id: draft.id,
		name: draft.name,
		description: draft.description,
		workspace: { mode: draft.workspace_mode },
		steps: draft.steps.map(serializeStep),
	}
	return JSON.stringify(out, null, 2)
}
