/**
 * Pre-save validation for workflow drafts.
 *
 * Returns a list of human-readable issues. Empty array == valid. Save UIs
 * should show issues inline rather than blocking on missing optional fields,
 * but should refuse to save when any issue is present.
 */
import type { WorkflowDraft, WorkflowStepDraft } from './workflow-types'

export interface WorkflowValidationContext {
	availableAgents: ReadonlyArray<{ id: string }>
}

export interface WorkflowIssue {
	severity: 'error' | 'warning'
	message: string
	stepId?: string
}

export function validateWorkflow(
	draft: WorkflowDraft,
	ctx: WorkflowValidationContext,
): WorkflowIssue[] {
	const issues: WorkflowIssue[] = []

	if (!draft.id.trim()) issues.push({ severity: 'error', message: 'Workflow ID is required.' })
	if (!draft.name.trim()) issues.push({ severity: 'error', message: 'Workflow name is required.' })

	if (draft.steps.length === 0) {
		issues.push({ severity: 'error', message: 'Workflow must contain at least one step.' })
		return issues
	}

	const stepIds = new Set<string>()
	const agentIds = new Set(ctx.availableAgents.map((agent) => agent.id))

	for (const step of draft.steps) {
		if (!step.id.trim()) {
			issues.push({ severity: 'error', message: 'Every step needs an ID.' })
			continue
		}
		if (stepIds.has(step.id)) {
			issues.push({
				severity: 'error',
				stepId: step.id,
				message: `Duplicate step ID "${step.id}".`,
			})
		}
		stepIds.add(step.id)
	}

	for (const step of draft.steps) {
		validateStep(step, { stepIds, agentIds }, issues)
	}

	return issues
}

interface StepCheckCtx {
	stepIds: Set<string>
	agentIds: Set<string>
}

function validateStep(
	step: WorkflowStepDraft,
	ctx: StepCheckCtx,
	issues: WorkflowIssue[],
): void {
	if (step.type === 'agent') {
		if (!step.agent_id?.trim()) {
			issues.push({
				severity: 'error',
				stepId: step.id,
				message: `Step "${step.id}" must select an agent.`,
			})
		} else if (!ctx.agentIds.has(step.agent_id)) {
			issues.push({
				severity: 'warning',
				stepId: step.id,
				message: `Step "${step.id}" references unknown agent "${step.agent_id}".`,
			})
		}
		if (step.retry_max_attempts !== undefined && step.retry_max_attempts < 1) {
			issues.push({
				severity: 'error',
				stepId: step.id,
				message: `Step "${step.id}" retry max_attempts must be >= 1.`,
			})
		}
	}

	if (step.type === 'human_approval') {
		if (!step.approvers || step.approvers.length === 0) {
			issues.push({
				severity: 'warning',
				stepId: step.id,
				message: `Step "${step.id}" has no approvers; defaults to owner.`,
			})
		}
	}

	const targets = new Set<string>()
	if (step.next) targets.add(step.next)
	if (step.on_approve) targets.add(step.on_approve)
	if (step.on_reply) targets.add(step.on_reply)
	if (step.on_reject) targets.add(step.on_reject)
	if (step.on_met) targets.add(step.on_met)
	if (step.on_failed) targets.add(step.on_failed)
	for (const transition of step.transitions ?? []) {
		if (transition.goto) targets.add(transition.goto)
	}

	for (const target of targets) {
		if (!ctx.stepIds.has(target)) {
			issues.push({
				severity: 'error',
				stepId: step.id,
				message: `Step "${step.id}" references missing target step "${target}".`,
			})
		}
	}
}
