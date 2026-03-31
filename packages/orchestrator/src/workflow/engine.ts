import type { Agent, Task, Workflow, WorkflowStep } from '@questpie/autopilot-spec'
import { compileWorkflow, compileWorkflowStep } from './compiler'
import type {
	CompiledWorkflow,
	CompiledWorkflowFailurePolicy,
	CompiledWorkflowStep,
	CompiledWorkflowValidation,
} from './compiler'

type WorkflowLike = Workflow | CompiledWorkflow

// ─── Result types ───────────────────────────────────────────────────────────

/** The kind of action the workflow engine recommends. */
export type WorkflowAction =
	| 'assign_agent'
	| 'notify_human'
	| 'spawn_workflow'
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
	workflowId?: string
	idempotencyKey?: string
	childTaskId?: string
	modelPolicy?: string
	validationMode?: CompiledWorkflowValidation['mode']
	failureAction?: CompiledWorkflowFailurePolicy['action']
	error?: string
}

// ─── Step resolution ────────────────────────────────────────────────────────

/**
 * Find a workflow step by its id.
 */
export function resolveWorkflowStep(
	workflow: WorkflowLike,
	stepId: string,
): CompiledWorkflowStep | undefined {
	const compiledWorkflow = compileWorkflow(workflow)
	return compiledWorkflow.steps.find((s) => s.id === stepId)
}

// ─── Step type checks ───────────────────────────────────────────────────────

/**
 * Returns true if the step is a human gate (requires human action to proceed).
 */
export function isHumanGate(step: WorkflowStep | CompiledWorkflowStep): boolean {
	const compiledStep = compileWorkflowStep(step)
	return compiledStep.type === 'human_gate' || compiledStep.executor?.kind === 'human'
}

/**
 * Returns true if the step is terminal (workflow ends here).
 */
export function isTerminal(step: WorkflowStep | CompiledWorkflowStep): boolean {
	const compiledStep = compileWorkflowStep(step)
	return compiledStep.type === 'terminal' || compiledStep.terminal === true
}

// ─── Transition helpers ─────────────────────────────────────────────────────

/**
 * Resolve a transition value to a target step id.
 * Transitions can be a plain string (step id) or a record with metadata.
 * When it's a record we look for a `step` key, otherwise return undefined.
 */
function resolveTransitionTarget(value: string | Record<string, string>): string | undefined {
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
	workflow: WorkflowLike,
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
	step: WorkflowStep | CompiledWorkflowStep,
	agents: Agent[],
): string | undefined {
	const compiledStep = compileWorkflowStep(step)
	const executor = compiledStep.executor

	// Explicit assignment by id takes priority
	if (executor?.agentId) {
		const agent = agents.find((a) => a.id === executor.agentId)
		if (agent) return agent.id
	}

	// Fall back to role-based matching
	if (executor?.role) {
		const agent = agents.find((a) => a.role === executor.role)
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
	step: WorkflowStep | CompiledWorkflowStep,
	task: Task,
	agents: Agent[] = [],
): boolean {
	const compiledStep = compileWorkflowStep(step)
	if (compiledStep.validation.mode !== 'review') return true

	const minApprovals = compiledStep.validation.minApprovals ?? 1
	const reviewerRoles = compiledStep.validation.reviewersRoles

	// Count approvals from task history that match this step
	const approvals = task.history.filter((h) => {
		if (h.action !== 'approved' || h.step !== compiledStep.id) return false
		// If no reviewer_roles specified, any approval counts
		if (reviewerRoles.length === 0) return true
		// Look up the actor's role from the agents list
		const agent = agents.find((a) => a.id === h.by)
		return agent?.role ? reviewerRoles.includes(agent.role) : false
	})

	return approvals.length >= minApprovals
}

// ─── Core evaluation ────────────────────────────────────────────────────────

/**
 * Determine what the next step should be when transitioning from the current
 * step using the given transition key.
 */
function resolveNextStepResult(
	workflow: CompiledWorkflow,
	currentStep: CompiledWorkflowStep,
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
function buildStepResult(step: CompiledWorkflowStep, agents: Agent[]): WorkflowTransitionResult {
	if (isTerminal(step)) {
		return {
			action: 'complete',
			nextStep: step.id,
			modelPolicy: step.modelPolicy,
			validationMode: step.validation.mode,
			failureAction: step.failurePolicy.action,
		}
	}

	if (isHumanGate(step)) {
		return {
			action: 'notify_human',
			nextStep: step.id,
			gate: step.validation.gate ?? step.gate,
			modelPolicy: step.modelPolicy,
			validationMode: step.validation.mode,
			failureAction: step.failurePolicy.action,
		}
	}

	if (step.executor?.kind === 'sub_workflow' && step.spawnWorkflow?.workflow) {
		return {
			action: 'spawn_workflow',
			nextStep: step.id,
			workflowId: step.spawnWorkflow.workflow,
			idempotencyKey: step.spawnWorkflow.idempotencyKey,
			modelPolicy: step.modelPolicy,
			validationMode: step.validation.mode,
			failureAction: step.failurePolicy.action,
		}
	}

	// Agent step
	if (step.type === 'agent') {
		const assignee = getAssignee(step, agents)
		return {
			action: 'assign_agent',
			nextStep: step.id,
			assignTo: assignee,
			assignRole: step.executor?.role ?? step.assigned_role,
			modelPolicy: step.modelPolicy,
			validationMode: step.validation.mode,
			failureAction: step.failurePolicy.action,
		}
	}

	// sub_workflow or unknown — no action for now
	return {
		action: 'no_action',
		nextStep: step.id,
		modelPolicy: step.modelPolicy,
		validationMode: step.validation.mode,
		failureAction: step.failurePolicy.action,
	}
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
	workflow: WorkflowLike,
	task: Task,
	agents: Agent[] = [],
): WorkflowTransitionResult {
	const compiledWorkflow = compileWorkflow(workflow)
	const stepId = task.workflow_step
	if (!stepId) {
		return { action: 'error', error: 'Task has no workflow_step' }
	}

	const step = resolveWorkflowStep(compiledWorkflow, stepId)
	if (!step) {
		return {
			action: 'error',
			error: `Step '${stepId}' not found in workflow '${compiledWorkflow.id}'`,
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

	if (step.executor?.kind === 'sub_workflow' && step.spawnWorkflow?.workflow) {
		return {
			action: 'spawn_workflow',
			nextStep: step.id,
			workflowId: step.spawnWorkflow.workflow,
			idempotencyKey: step.spawnWorkflow.idempotencyKey,
			modelPolicy: step.modelPolicy,
			validationMode: step.validation.mode,
			failureAction: step.failurePolicy.action,
		}
	}

	// Review gate — if review requirements exist and aren't met, wait
	if (step.validation.mode === 'review' && !isReviewSatisfied(step, task, agents)) {
		return {
			action: 'no_action',
			nextStep: step.id,
			modelPolicy: step.modelPolicy,
			validationMode: step.validation.mode,
			failureAction: step.failurePolicy.action,
		}
	}

	// Agent step with auto_execute → assign immediately
	if (step.type === 'agent' && step.auto_execute) {
		return {
			action: 'assign_agent',
			nextStep: step.id,
			assignTo: getAssignee(step, agents),
			assignRole: step.executor?.role ?? step.assigned_role,
			modelPolicy: step.modelPolicy,
			validationMode: step.validation.mode,
			failureAction: step.failurePolicy.action,
		}
	}

	// Agent step without auto_execute → still assign, the scheduler decides
	// when to actually run it
	if (step.type === 'agent') {
		return {
			action: 'assign_agent',
			nextStep: step.id,
			assignTo: getAssignee(step, agents),
			assignRole: step.executor?.role ?? step.assigned_role,
			modelPolicy: step.modelPolicy,
			validationMode: step.validation.mode,
			failureAction: step.failurePolicy.action,
		}
	}

	return {
		action: 'no_action',
		nextStep: step.id,
		modelPolicy: step.modelPolicy,
		validationMode: step.validation.mode,
		failureAction: step.failurePolicy.action,
	}
}

/**
 * Advance the workflow: given the current task state and a transition key
 * (e.g. "done", "approved", "rejected"), compute the result of moving to
 * the next step.
 */
export function advanceWorkflow(
	workflow: WorkflowLike,
	task: Task,
	transitionKey: string,
	agents: Agent[] = [],
): WorkflowTransitionResult {
	const compiledWorkflow = compileWorkflow(workflow)
	const stepId = task.workflow_step
	if (!stepId) {
		return { action: 'error', error: 'Task has no workflow_step' }
	}

	const step = resolveWorkflowStep(compiledWorkflow, stepId)
	if (!step) {
		return {
			action: 'error',
			error: `Step '${stepId}' not found in workflow '${compiledWorkflow.id}'`,
		}
	}

	// Check review requirements before allowing transition
	if (step.validation.mode === 'review' && !isReviewSatisfied(step, task, agents)) {
		return {
			action: 'no_action',
			nextStep: step.id,
			modelPolicy: step.modelPolicy,
			validationMode: step.validation.mode,
			failureAction: step.failurePolicy.action,
			error: 'Review requirements not met',
		}
	}

	return resolveNextStepResult(compiledWorkflow, step, transitionKey, agents)
}

/**
 * Get all available transition keys for a given step.
 */
export function getAvailableTransitions(workflow: WorkflowLike, stepId: string): string[] {
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
export function validateWorkflowGraph(workflow: WorkflowLike): {
	valid: boolean
	errors: string[]
} {
	const compiledWorkflow = compileWorkflow(workflow)
	const errors: string[] = []
	const stepIds = new Set(compiledWorkflow.steps.map((s) => s.id))
	const reachable = new Set<string>()

	// Check transitions point to valid steps
	for (const step of compiledWorkflow.steps) {
		for (const [key, value] of Object.entries(step.transitions)) {
			const target = resolveTransitionTarget(value)
			if (target && !stepIds.has(target)) {
				errors.push(`Step '${step.id}' transition '${key}' references unknown step '${target}'`)
			}
			if (target) reachable.add(target)
		}
	}

	// Check for terminal steps
	const hasTerminal = compiledWorkflow.steps.some((s) => isTerminal(s))
	if (!hasTerminal) {
		errors.push('Workflow has no terminal step')
	}

	// Check reachability (first step is the entry point)
	if (compiledWorkflow.steps.length > 0) {
		const [firstStep] = compiledWorkflow.steps
		if (!firstStep) return { valid: errors.length === 0, errors }
		const firstStepId = firstStep.id
		for (const step of compiledWorkflow.steps) {
			if (step.id !== firstStepId && !reachable.has(step.id)) {
				errors.push(`Step '${step.id}' is unreachable`)
			}
		}
	}

	return { valid: errors.length === 0, errors }
}
