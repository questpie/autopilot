import type { Agent, Task, Workflow, WorkflowStep } from '@questpie/autopilot-spec'

// ─── Result types ───────────────────────────────────────────────────────────

/** The kind of action the workflow engine recommends. */
export type WorkflowAction =
	| 'assign_agent'
	| 'notify_human'
	| 'complete'
	| 'no_action'
	| 'error'

/** Result of evaluating a workflow transition. */
export interface WorkflowTransitionResult {
	action: WorkflowAction
	nextStep?: string
	assignTo?: string
	assignRole?: string
	gate?: string
	error?: string
}

// ─── Step resolution ────────────────────────────────────────────────────────

/**
 * Find a workflow step by its id.
 */
export function resolveWorkflowStep(
	workflow: Workflow,
	stepId: string,
): WorkflowStep | undefined {
	return workflow.steps.find((s) => s.id === stepId)
}

// ─── Step type checks ───────────────────────────────────────────────────────

/**
 * Returns true if the step is a human gate (requires human action to proceed).
 */
export function isHumanGate(step: WorkflowStep): boolean {
	return step.type === 'human_gate'
}

/**
 * Returns true if the step is terminal (workflow ends here).
 */
export function isTerminal(step: WorkflowStep): boolean {
	return step.type === 'terminal' || step.terminal === true
}

// ─── Transition helpers ─────────────────────────────────────────────────────

/**
 * Resolve a transition value to a target step id.
 * Transitions can be a plain string (step id) or a record with metadata.
 * When it's a record we look for a `step` key, otherwise return undefined.
 */
function resolveTransitionTarget(
	value: string | Record<string, string>,
): string | undefined {
	if (typeof value === 'string') return value
	if (typeof value === 'object' && 'step' in value) return value.step
	return undefined
}

/**
 * Given a workflow, a current step id, and a transition key (e.g. "done",
 * "approved"), return the id of the next step — or undefined if the
 * transition key doesn't exist on the step.
 */
export function getNextStep(
	workflow: Workflow,
	currentStepId: string,
	transitionKey: string,
): string | undefined {
	const step = resolveWorkflowStep(workflow, currentStepId)
	if (!step) return undefined

	const transition = step.transitions[transitionKey]
	if (transition === undefined) return undefined

	return resolveTransitionTarget(transition)
}

// ─── Agent matching ─────────────────────────────────────────────────────────

/**
 * Find the best agent to assign to a step.
 * Matches by `assigned_to` (exact agent id) first, then `assigned_role`.
 */
export function getAssignee(
	step: WorkflowStep,
	agents: Agent[],
): string | undefined {
	// Explicit assignment by id takes priority
	if (step.assigned_to) {
		const agent = agents.find((a) => a.id === step.assigned_to)
		if (agent) return agent.id
	}

	// Fall back to role-based matching
	if (step.assigned_role) {
		const agent = agents.find((a) => a.role === step.assigned_role)
		if (agent) return agent.id
	}

	return undefined
}

// ─── Review checks ──────────────────────────────────────────────────────────

/**
 * Check whether a step's review requirements are satisfied.
 * If the step has no review block, it's considered satisfied.
 */
export function isReviewSatisfied(
	step: WorkflowStep,
	task: Task,
): boolean {
	if (!step.review) return true

	const minApprovals = step.review.min_approvals ?? 1
	const reviewerRoles = step.review.reviewers_roles ?? []

	// Count approvals from task history that match this step
	const approvals = task.history.filter(
		(h) =>
			h.action === 'approved' &&
			h.step === step.id &&
			(reviewerRoles.length === 0 || reviewerRoles.includes(h.by)),
	)

	return approvals.length >= minApprovals
}

// ─── Core evaluation ────────────────────────────────────────────────────────

/**
 * Determine what the next step should be when transitioning from the current
 * step using the given transition key.
 */
function resolveNextStepResult(
	workflow: Workflow,
	currentStep: WorkflowStep,
	transitionKey: string,
	agents: Agent[],
): WorkflowTransitionResult {
	const nextStepId = getNextStep(workflow, currentStep.id, transitionKey)

	if (!nextStepId) {
		return {
			action: 'error',
			error: `No transition '${transitionKey}' on step '${currentStep.id}'`,
		}
	}

	const nextStep = resolveWorkflowStep(workflow, nextStepId)
	if (!nextStep) {
		return {
			action: 'error',
			error: `Step '${nextStepId}' referenced by transition '${transitionKey}' does not exist`,
		}
	}

	return buildStepResult(nextStep, agents)
}

/**
 * Build the appropriate result for entering a given step.
 */
function buildStepResult(
	step: WorkflowStep,
	agents: Agent[],
): WorkflowTransitionResult {
	if (isTerminal(step)) {
		return { action: 'complete', nextStep: step.id }
	}

	if (isHumanGate(step)) {
		return {
			action: 'notify_human',
			nextStep: step.id,
			gate: step.gate,
		}
	}

	// Agent step
	if (step.type === 'agent') {
		const assignee = getAssignee(step, agents)
		return {
			action: 'assign_agent',
			nextStep: step.id,
			assignTo: assignee,
			assignRole: step.assigned_role,
		}
	}

	// sub_workflow or unknown — no action for now
	return { action: 'no_action', nextStep: step.id }
}

/**
 * Given a workflow, a task (which carries `workflow_step`), and a list of
 * available agents, evaluate what should happen next.
 *
 * The function is pure — it only inspects data and returns a decision.
 *
 * Logic:
 * 1. Resolve the task's current workflow step.
 * 2. If the step is terminal → complete.
 * 3. If the step is a human_gate → notify_human.
 * 4. If the step has a review requirement that isn't met → no_action (waiting).
 * 5. If the step is an agent step and `auto_execute` is true → assign_agent.
 * 6. Otherwise, determine the default transition:
 *    - If there's exactly one transition, use it.
 *    - If there's a "done" transition, use it.
 *    - Otherwise → no_action (ambiguous).
 */
export function evaluateTransition(
	workflow: Workflow,
	task: Task,
	agents: Agent[] = [],
): WorkflowTransitionResult {
	const stepId = task.workflow_step
	if (!stepId) {
		return { action: 'error', error: 'Task has no workflow_step' }
	}

	const step = resolveWorkflowStep(workflow, stepId)
	if (!step) {
		return {
			action: 'error',
			error: `Step '${stepId}' not found in workflow '${workflow.id}'`,
		}
	}

	// Terminal → done
	if (isTerminal(step)) {
		return { action: 'complete', nextStep: step.id }
	}

	// Human gate → surface to human
	if (isHumanGate(step)) {
		return {
			action: 'notify_human',
			nextStep: step.id,
			gate: step.gate,
		}
	}

	// Review gate — if review requirements exist and aren't met, wait
	if (step.review && !isReviewSatisfied(step, task)) {
		return { action: 'no_action', nextStep: step.id }
	}

	// Agent step with auto_execute → assign immediately
	if (step.type === 'agent' && step.auto_execute) {
		return {
			action: 'assign_agent',
			nextStep: step.id,
			assignTo: getAssignee(step, agents),
			assignRole: step.assigned_role,
		}
	}

	// Agent step without auto_execute → still assign, the scheduler decides
	// when to actually run it
	if (step.type === 'agent') {
		return {
			action: 'assign_agent',
			nextStep: step.id,
			assignTo: getAssignee(step, agents),
			assignRole: step.assigned_role,
		}
	}

	return { action: 'no_action', nextStep: step.id }
}

/**
 * Advance the workflow: given the current task state and a transition key
 * (e.g. "done", "approved", "rejected"), compute the result of moving to
 * the next step.
 */
export function advanceWorkflow(
	workflow: Workflow,
	task: Task,
	transitionKey: string,
	agents: Agent[] = [],
): WorkflowTransitionResult {
	const stepId = task.workflow_step
	if (!stepId) {
		return { action: 'error', error: 'Task has no workflow_step' }
	}

	const step = resolveWorkflowStep(workflow, stepId)
	if (!step) {
		return {
			action: 'error',
			error: `Step '${stepId}' not found in workflow '${workflow.id}'`,
		}
	}

	// Check review requirements before allowing transition
	if (step.review && !isReviewSatisfied(step, task)) {
		return {
			action: 'no_action',
			nextStep: step.id,
			error: 'Review requirements not met',
		}
	}

	return resolveNextStepResult(workflow, step, transitionKey, agents)
}

/**
 * Get all available transition keys for a given step.
 */
export function getAvailableTransitions(
	workflow: Workflow,
	stepId: string,
): string[] {
	const step = resolveWorkflowStep(workflow, stepId)
	if (!step) return []
	return Object.keys(step.transitions)
}

/**
 * Validate that a workflow's step graph is well-formed:
 * - All transition targets reference existing steps
 * - At least one terminal step exists
 * - No orphan steps (every non-first step is reachable)
 */
export function validateWorkflowGraph(
	workflow: Workflow,
): { valid: boolean; errors: string[] } {
	const errors: string[] = []
	const stepIds = new Set(workflow.steps.map((s) => s.id))
	const reachable = new Set<string>()

	// Check transitions point to valid steps
	for (const step of workflow.steps) {
		for (const [key, value] of Object.entries(step.transitions)) {
			const target = resolveTransitionTarget(value)
			if (target && !stepIds.has(target)) {
				errors.push(
					`Step '${step.id}' transition '${key}' references unknown step '${target}'`,
				)
			}
			if (target) reachable.add(target)
		}
	}

	// Check for terminal steps
	const hasTerminal = workflow.steps.some((s) => isTerminal(s))
	if (!hasTerminal) {
		errors.push('Workflow has no terminal step')
	}

	// Check reachability (first step is the entry point)
	if (workflow.steps.length > 0) {
		const firstStepId = workflow.steps[0]!.id
		for (const step of workflow.steps) {
			if (step.id !== firstStepId && !reachable.has(step.id)) {
				errors.push(`Step '${step.id}' is unreachable`)
			}
		}
	}

	return { valid: errors.length === 0, errors }
}
