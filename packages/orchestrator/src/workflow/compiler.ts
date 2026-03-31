import type {
	Workflow,
	WorkflowFailureAction,
	WorkflowFailurePolicy,
	WorkflowStep,
	WorkflowValidation,
	WorkflowValidationRule,
} from '@questpie/autopilot-spec'

export interface CompiledWorkflowExecutor {
	kind: 'agent' | 'human' | 'tool' | 'sub_workflow'
	role?: string
	agentId?: string
	gate?: string
	tool?: string
	workflow?: string
	modelPolicy?: string
}

export interface CompiledWorkflowSpawn {
	workflow: string
	inputMap: Record<string, string>
	resultMap: Record<string, string>
	idempotencyKey?: string
}

export interface CompiledWorkflowValidation {
	mode: WorkflowValidation['mode']
	gate?: string
	tool?: string
	reviewersRoles: string[]
	minApprovals?: number
	onReject?: string
	onRejectMaxRounds?: number
	requiredOutputs: string[]
	rules: WorkflowValidationRule[]
}

export interface CompiledWorkflowFailurePolicy {
	action: WorkflowFailureAction
	maxRetries: number
	modelPolicy?: string
	workflow?: string
	inputMap: Record<string, string>
	idempotencyKey?: string
}

export interface CompiledWorkflowStep extends WorkflowStep {
	instructions: string
	executor?: CompiledWorkflowExecutor
	spawnWorkflow?: CompiledWorkflowSpawn
	validation: CompiledWorkflowValidation
	failurePolicy: CompiledWorkflowFailurePolicy
	modelPolicy?: string
}

export interface CompiledWorkflow extends Omit<Workflow, 'steps'> {
	steps: CompiledWorkflowStep[]
}

function isCompiledStep(step: WorkflowStep | CompiledWorkflowStep): step is CompiledWorkflowStep {
	return (
		'validation' in step &&
		'failurePolicy' in step &&
		'instructions' in step &&
		'spawnWorkflow' in step
	)
}

function normalizeExecutor(step: WorkflowStep): CompiledWorkflowExecutor | undefined {
	if (step.type === 'terminal' || step.terminal === true) return undefined
	const explicitExecutor = step.executor
	if (explicitExecutor) {
		return {
			kind: explicitExecutor.kind,
			role: explicitExecutor.role ?? step.assigned_role,
			agentId: explicitExecutor.agent_id ?? step.assigned_to,
			gate: explicitExecutor.gate ?? step.gate,
			tool: explicitExecutor.tool,
			workflow: explicitExecutor.workflow ?? step.spawn_workflow?.workflow,
			modelPolicy: explicitExecutor.model_policy ?? step.model_policy,
		}
	}
	if (step.type === 'human_gate') {
		return { kind: 'human', gate: step.gate }
	}
	if (step.type === 'sub_workflow') {
		return {
			kind: 'sub_workflow',
			role: step.assigned_role,
			agentId: step.assigned_to,
			workflow: step.spawn_workflow?.workflow,
			modelPolicy: step.model_policy,
		}
	}
	return {
		kind: 'agent',
		role: step.assigned_role,
		agentId: step.assigned_to,
		modelPolicy: step.model_policy,
	}
}

function normalizeSpawnWorkflow(step: WorkflowStep): CompiledWorkflowSpawn | undefined {
	const workflowId = step.spawn_workflow?.workflow ?? step.executor?.workflow
	if (!workflowId) return undefined

	return {
		workflow: workflowId,
		inputMap: step.spawn_workflow?.input_map ?? {},
		resultMap: step.spawn_workflow?.result_map ?? {},
		idempotencyKey: step.spawn_workflow?.idempotency_key,
	}
}

function normalizeValidation(step: WorkflowStep): CompiledWorkflowValidation {
	const validate = step.validate
	const review = step.review
	const mode = validate?.mode ?? (review ? 'review' : step.type === 'human_gate' ? 'human' : 'auto')

	return {
		mode,
		gate: validate?.gate ?? step.gate,
		tool: validate?.tool,
		reviewersRoles: validate?.reviewers_roles ?? review?.reviewers_roles ?? [],
		minApprovals: validate?.min_approvals ?? review?.min_approvals,
		onReject: validate?.on_reject ?? review?.on_reject,
		onRejectMaxRounds: validate?.on_reject_max_rounds ?? review?.on_reject_max_rounds,
		requiredOutputs: validate?.required_outputs ?? [],
		rules: validate?.rules ?? [],
	}
}

function resolveFailureAction(
	onFail: WorkflowStep['on_fail'],
	validation: CompiledWorkflowValidation,
): WorkflowFailureAction {
	if (typeof onFail === 'string') return onFail
	if (onFail?.action) return onFail.action
	if (validation.onReject === 'retry') return 'retry'
	if (validation.onReject === 'escalate') return 'escalate'
	if (validation.onReject === 'spawn_workflow') return 'spawn_workflow'
	if (validation.onReject === 'revise') return 'revise'
	return 'block'
}

function normalizeFailurePolicy(
	step: WorkflowStep,
	validation: CompiledWorkflowValidation,
): CompiledWorkflowFailurePolicy {
	const onFail = step.on_fail
	const failurePolicy = typeof onFail === 'object' ? onFail : undefined

	return {
		action: resolveFailureAction(onFail, validation),
		maxRetries: step.max_retries ?? 0,
		modelPolicy: failurePolicy?.model_policy,
		workflow: failurePolicy?.workflow,
		inputMap: failurePolicy?.input_map ?? {},
		idempotencyKey: failurePolicy?.idempotency_key,
	}
}

export function compileWorkflowStep(
	step: WorkflowStep | CompiledWorkflowStep,
): CompiledWorkflowStep {
	const validation = normalizeValidation(step)

	return {
		...step,
		instructions: step.instructions ?? step.description,
		executor: normalizeExecutor(step),
		spawnWorkflow: normalizeSpawnWorkflow(step),
		validation,
		failurePolicy: normalizeFailurePolicy(step, validation),
		modelPolicy: step.model_policy,
	}
}

export function isCompiledWorkflow(
	workflow: Workflow | CompiledWorkflow,
): workflow is CompiledWorkflow {
	if (workflow.steps.length === 0) return false
	return workflow.steps.every((step) => isCompiledStep(step as WorkflowStep | CompiledWorkflowStep))
}

export function compileWorkflow(workflow: Workflow | CompiledWorkflow): CompiledWorkflow {
	if (isCompiledWorkflow(workflow)) return workflow

	return {
		...workflow,
		steps: workflow.steps.map((step) => compileWorkflowStep(step)),
	}
}
