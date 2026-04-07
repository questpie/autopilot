import { randomBytes } from 'node:crypto'
import type { Agent, Workflow, WorkflowStep, CompanyScope, ExecutionTarget, Environment, SecretRef, ExternalAction, StepTransition, Provider, CapabilityProfile, ResolvedCapabilities, QueueConfig } from '@questpie/autopilot-spec'
import { slugifyTaskId } from './tasks'
import type { TaskService, TaskRow } from './tasks'
import type { RunService } from './runs'
import type { ActivityService } from './activity'
import type { ArtifactService } from './artifacts'
import type { ChildRollup } from './task-graph'
import { eventBus } from '../events/event-bus'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AuthoredConfig {
	company: CompanyScope
	agents: Map<string, Agent>
	workflows: Map<string, Workflow>
	environments: Map<string, Environment>
	providers: Map<string, Provider>
	capabilityProfiles: Map<string, CapabilityProfile>
	/** Loaded context file content (name → content) from .autopilot/context/ */
	context: Map<string, string>
	defaults: { runtime: string; workflow?: string; task_assignee?: string }
	/** Named queue configs from company scope. Empty record if unset. */
	queues?: Record<string, QueueConfig>
}

export interface IntakeResult {
	task: TaskRow
	runId: string | null
	actions: string[]
}

export interface AdvanceResult {
	task: TaskRow
	runId: string | null
	actions: string[]
}

interface ResolvedTargeting extends ExecutionTarget {
	secret_refs?: SecretRef[]
	actions?: ExternalAction[]
	resolved_capabilities?: ResolvedCapabilities
}

/** Context carried from the source step that caused advancement. */
interface StepContext {
	/** Summary from the run that just completed (the direct source). */
	sourceRunSummary?: string
	/** Human reply text. */
	humanReply?: string
	/** Summaries from all prior completed runs for the task (chronological order). */
	priorRunSummaries?: Array<{ runId: string; summary: string }>
}

/** Default max revisions before escalation. */
const DEFAULT_MAX_REVISIONS = 3

/** Key prefix for revision counters in task metadata. */
const REVISION_KEY_PREFIX = '_revisions:'

// ─── Engine ─────────────────────────────────────────────────────────────────

export class WorkflowEngine {
	private defaultAssignee: string | undefined
	private defaultWorkflow: string | undefined
	private defaultRuntime: string

	/** Injected rollup function — avoids circular dependency with TaskGraphService. */
	private childRollupFn?: (taskId: string, relationType?: string) => Promise<ChildRollup>

	/** Injected dependency check function — avoids circular dependency with TaskRelationService. */
	private checkDependenciesFn?: (taskId: string) => Promise<'met' | 'failed' | 'pending'>

	constructor(
		private config: AuthoredConfig,
		private taskService: TaskService,
		private runService: RunService,
		private activityService?: ActivityService,
		private artifactService?: ArtifactService,
	) {
		this.defaultAssignee = config.defaults.task_assignee
		this.defaultWorkflow = config.defaults.workflow
		this.defaultRuntime = config.defaults.runtime
	}

	/** Wire the child rollup function after construction to avoid circular init. */
	setChildRollupFn(fn: (taskId: string, relationType?: string) => Promise<ChildRollup>): void {
		this.childRollupFn = fn
	}

	/** Wire the dependency check function after construction to avoid circular init. */
	setCheckDependenciesFn(fn: (taskId: string) => Promise<'met' | 'failed' | 'pending'>): void {
		this.checkDependenciesFn = fn
	}

	// ─── Validation ─────────────────────────────────────────────────────

	validate(): string[] {
		const issues: string[] = []

		if (this.defaultAssignee && !this.config.agents.has(this.defaultAssignee)) {
			issues.push(`default_task_assignee "${this.defaultAssignee}" not found in loaded agents`)
		}

		if (this.defaultWorkflow && !this.config.workflows.has(this.defaultWorkflow)) {
			issues.push(`default_workflow "${this.defaultWorkflow}" not found in loaded workflows`)
		}

		for (const [wfId, wf] of this.config.workflows) {
			const stepIds = new Set(wf.steps.map((s) => s.id))

			for (const step of wf.steps) {
				// Agent reference
				if (step.type === 'agent' && step.agent_id && !this.config.agents.has(step.agent_id)) {
					issues.push(`workflow "${wfId}" step "${step.id}" references unknown agent "${step.agent_id}"`)
				}

				// Environment reference
				if (step.targeting?.environment && !this.config.environments.has(step.targeting.environment)) {
					issues.push(`workflow "${wfId}" step "${step.id}" references unknown environment "${step.targeting.environment}"`)
				}

				// Control flow targets
				if (step.next && !stepIds.has(step.next)) {
					issues.push(`workflow "${wfId}" step "${step.id}" has next="${step.next}" which does not exist`)
				}
				if (step.transitions) {
					for (const transition of step.transitions) {
						if (!stepIds.has(transition.goto)) {
							const whenStr = JSON.stringify(transition.when)
							issues.push(`workflow "${wfId}" step "${step.id}" transition ${whenStr} → "${transition.goto}" target does not exist`)
						}
					}
				}
				if (step.on_approve && !stepIds.has(step.on_approve)) {
					issues.push(`workflow "${wfId}" step "${step.id}" on_approve="${step.on_approve}" target does not exist`)
				}
				if (step.on_reply && !stepIds.has(step.on_reply)) {
					issues.push(`workflow "${wfId}" step "${step.id}" on_reply="${step.on_reply}" target does not exist`)
				}
				if (step.on_reject && !stepIds.has(step.on_reject)) {
					issues.push(`workflow "${wfId}" step "${step.id}" on_reject="${step.on_reject}" target does not exist`)
				}
				if (step.on_met && !stepIds.has(step.on_met)) {
					issues.push(`workflow "${wfId}" step "${step.id}" on_met="${step.on_met}" target does not exist`)
				}
				if (step.on_failed && !stepIds.has(step.on_failed)) {
					issues.push(`workflow "${wfId}" step "${step.id}" on_failed="${step.on_failed}" target does not exist`)
				}
				if (step.type === 'wait_for_children' && step.join_policy === 'any_failed' && step.on_failed) {
					issues.push(`workflow "${wfId}" step "${step.id}" on_failed is ignored when join_policy is any_failed — use on_met instead`)
				}

				// Output/transition consistency: validate when-field values against declared output
				if (step.output && step.transitions) {
					const { artifacts, ...outputTags } = step.output
					for (const transition of step.transitions) {
						for (const [field, value] of Object.entries(transition.when)) {
							const tag = outputTags[field] as { description: string; values?: Record<string, string> } | undefined
							if (tag?.values && !tag.values[value]) {
								const validValues = Object.keys(tag.values).join(', ')
								issues.push(
									`workflow "${wfId}" step "${step.id}" transition when.${field}="${value}" is not a declared value (valid: ${validValues})`,
								)
							}
						}
					}
				}
			}
		}

		return issues
	}

	// ─── Public API ─────────────────────────────────────────────────────

	async intake(taskId: string): Promise<IntakeResult | null> {
		const task = await this.taskService.get(taskId)
		if (!task) return null

		const actions: string[] = []
		const updates: Record<string, string> = {}

		if (!task.assigned_to && this.defaultAssignee) {
			if (!this.config.agents.has(this.defaultAssignee)) {
				console.warn(`[workflow-engine] default_task_assignee "${this.defaultAssignee}" not found — skipping assignment`)
			} else {
				updates.assigned_to = this.defaultAssignee
				actions.push('assigned')
			}
		}

		const workflowId = task.workflow_id ?? this.defaultWorkflow
		if (workflowId && !task.workflow_id) {
			const workflow = this.config.workflows.get(workflowId)
			if (!workflow) {
				console.warn(`[workflow-engine] default_workflow "${workflowId}" not found — skipping workflow attachment`)
			} else if (workflow.steps.length === 0) {
				console.warn(`[workflow-engine] workflow "${workflowId}" has no steps — skipping`)
			} else {
				updates.workflow_id = workflowId
				updates.workflow_step = workflow.steps[0]!.id
				actions.push('workflow_attached')
			}
		}

		if (Object.keys(updates).length > 0) {
			await this.taskService.update(taskId, updates)
		}

		const updated = (await this.taskService.get(taskId))!
		const runId = await this.processCurrentStep(updated, actions, {})

		const final = runId !== null || actions.includes('done') || actions.includes('approval_needed')
			? (await this.taskService.get(taskId))!
			: updated
		return { task: final, runId, actions }
	}

	/**
	 * Shared task materialization: create task + run workflow intake.
	 * Used by both POST /api/tasks and POST /api/intake/:providerId.
	 */
	async materializeTask(input: {
		title: string
		type: string
		description?: string
		priority?: string
		assigned_to?: string
		workflow_id?: string
		context?: string
		metadata?: string
		queue?: string
		start_after?: string
		scheduled_by?: string
		created_by: string
		/** Optional deterministic ID. If omitted, a random ID is generated. */
		id?: string
	}): Promise<{ task: TaskRow; runId: string | null } | null> {
		const id = input.id ?? slugifyTaskId(input.title)
		const { id: _discardedId, ...rest } = input
		const task = await this.taskService.create({ id, ...rest })
		if (!task) return null

		const result = await this.intake(id)
		return { task: result?.task ?? task, runId: result?.runId ?? null }
	}

	/**
	 * Advance after a run completes.
	 * @param outputs — structured output fields from the completed run (for transition matching)
	 * @param sourceRunId — the run that just completed (direct source for context forwarding)
	 */
	async advance(taskId: string, outputs?: Record<string, string>, sourceRunId?: string): Promise<AdvanceResult | null> {
		const task = await this.taskService.get(taskId)
		if (!task || !task.workflow_id || !task.workflow_step) return null

		const currentStep = task.workflow_step
		const workflow = this.config.workflows.get(task.workflow_id)
		if (!workflow) return null

		// ── Empty output detection ──────────────────────────────────────
		if (sourceRunId) {
			const sourceRun = await this.runService.get(sourceRunId)
			if (sourceRun && this.isEmptyOutput(sourceRun.summary)) {
				console.warn(`[workflow-engine] run ${sourceRunId} completed with empty output at step "${currentStep}"`)

				const retryCount = await this.getAndIncrementEmptyRetry(taskId, task.metadata, currentStep)
				if (retryCount <= 1) {
					// First empty output: retry the same step once
					console.warn(`[workflow-engine] retrying step "${currentStep}" (empty output retry ${retryCount}/1)`)
					const actions: string[] = ['empty_output_retry']
					const ctx = await this.buildStepContext(sourceRunId, taskId)
					const updated = (await this.taskService.get(taskId))!
					const runId = await this.processCurrentStep(updated, actions, ctx)
					const final = runId !== null ? (await this.taskService.get(taskId))! : updated
					return { task: final, runId, actions }
				}

				// Exceeded retry: escalate to human or fail
				console.warn(`[workflow-engine] empty output persisted after retry — escalating task "${taskId}"`)
				const humanStep = this.findHumanApprovalStep(workflow)
				if (humanStep) {
					await this.taskService.update(taskId, { workflow_step: humanStep.id, status: 'blocked' })
					const actions = ['empty_output_escalated', 'approval_needed']
					await this.activityService?.log({
						actor: 'workflow-engine',
						type: 'escalation',
						summary: `Step "${currentStep}" produced empty output after retry — escalated to human review`,
						details: JSON.stringify({ task_id: taskId, step_id: currentStep, run_id: sourceRunId }),
					})
					eventBus.emit({ type: 'task_changed', taskId, status: 'blocked' })
					return { task: (await this.taskService.get(taskId))!, runId: null, actions }
				}
				// No human step — fail
				await this.taskService.update(taskId, { status: 'failed' })
				eventBus.emit({ type: 'task_changed', taskId, status: 'failed' })
				return { task: (await this.taskService.get(taskId))!, runId: null, actions: ['empty_output_failed'] }
			}
		}

		// ── Resolve next step ───────────────────────────────────────────
		let nextStep = this.resolveNextStep(workflow, currentStep, outputs)
		if (!nextStep) {
			await this.taskService.update(taskId, { status: 'done', workflow_step: '__done__' })
			return { task: (await this.taskService.get(taskId))!, runId: null, actions: ['done'] }
		}

		// ── Revision loop guard ─────────────────────────────────────────
		if (this.isRevisionLoop(workflow, currentStep, nextStep.id)) {
			const revisionCount = await this.incrementRevisionCount(taskId, task.metadata, currentStep, nextStep.id)
			if (revisionCount > DEFAULT_MAX_REVISIONS) {
				// After N revision attempts, advance forward instead of looping back.
				// The output is "good enough" — continuing to revise won't converge.
				const currentIdx = workflow.steps.findIndex((s) => s.id === currentStep)
				const forwardStep = currentIdx >= 0 ? workflow.steps[currentIdx + 1] : null

				if (forwardStep && forwardStep.id !== nextStep.id) {
					console.warn(
						`[workflow-engine] revision limit exceeded (${revisionCount - 1}/${DEFAULT_MAX_REVISIONS}) for "${currentStep}→${nextStep.id}" — advancing to "${forwardStep.id}"`,
					)
					await this.activityService?.log({
						actor: 'workflow-engine',
						type: 'revision_limit',
						summary: `Revision loop "${currentStep}→${nextStep.id}" exceeded ${DEFAULT_MAX_REVISIONS} — advancing to "${forwardStep.id}"`,
						details: JSON.stringify({ task_id: taskId, from_step: currentStep, to_step: forwardStep.id, revisions: revisionCount - 1 }),
					})
					nextStep = forwardStep
				} else {
					console.warn(
						`[workflow-engine] revision limit exceeded (${revisionCount - 1}/${DEFAULT_MAX_REVISIONS}) for "${currentStep}→${nextStep.id}" — no forward step, continuing loop`,
					)
				}
			}
		}

		const actions: string[] = ['advanced']
		if (outputs) {
			for (const [k, v] of Object.entries(outputs)) {
				actions.push(`${k}:${v}`)
			}
		}

		const stepUpdates: Record<string, string> = { workflow_step: nextStep.id }
		if (nextStep.type === 'agent' && nextStep.agent_id) {
			stepUpdates.assigned_to = nextStep.agent_id
			actions.push('reassigned')
		}
		await this.taskService.update(taskId, stepUpdates)

		// Build context from the source run + full task run history
		const ctx = await this.buildStepContext(sourceRunId, taskId)

		const updated = (await this.taskService.get(taskId))!
		const runId = await this.processCurrentStep(updated, actions, ctx)

		const final = runId !== null || actions.includes('done') || actions.includes('approval_needed')
			? (await this.taskService.get(taskId))!
			: updated
		return { task: final, runId, actions }
	}

	/**
	 * Handle a failed run. Marks the task as failed so child rollups and
	 * future wait_for_children joins can trust the signal.
	 */
	async handleRunFailure(taskId: string, runId: string): Promise<TaskRow | null> {
		const updated = await this.taskService.update(taskId, { status: 'failed' })
		if (!updated) return null

		eventBus.emit({ type: 'task_changed', taskId, status: 'failed' })
		await this.activityService?.log({
			actor: 'workflow-engine',
			type: 'run_failed',
			summary: `Run ${runId} failed — task ${taskId} marked as failed`,
			details: JSON.stringify({ task_id: taskId, run_id: runId }),
		})

		return updated
	}

	async approve(taskId: string, actor?: string): Promise<AdvanceResult | null> {
		const guard = await this.guardApprovalStep(taskId)
		if (!guard) return null

		await this.activityService?.log({
			actor: actor ?? 'system',
			type: 'approval',
			summary: `Approved task ${taskId} at step "${guard.step.id}"`,
			details: JSON.stringify({ task_id: taskId, step_id: guard.step.id, action: 'approved' }),
		})

		await this.taskService.update(taskId, { status: 'active' })
		const targetStepId = guard.step.on_approve
		const ctx = await this.buildStepContext(undefined, taskId)
		return this.advanceToTarget(taskId, targetStepId, undefined, ctx)
	}

	async reject(taskId: string, reason: string, actor?: string): Promise<AdvanceResult | null> {
		const guard = await this.guardApprovalStep(taskId)
		if (!guard) return null

		await this.activityService?.log({
			actor: actor ?? 'system',
			type: 'rejection',
			summary: `Rejected task ${taskId} at step "${guard.step.id}": ${reason}`,
			details: JSON.stringify({ task_id: taskId, step_id: guard.step.id, action: 'rejected', reason }),
		})

		if (guard.step.on_reject) {
			await this.taskService.update(taskId, { status: 'active' })
			return this.advanceToTarget(taskId, guard.step.on_reject)
		}

		await this.taskService.update(taskId, { status: 'done' })
		eventBus.emit({ type: 'task_changed', taskId, status: 'done' })
		return { task: (await this.taskService.get(taskId))!, runId: null, actions: ['rejected'] }
	}

	async reply(taskId: string, message: string, actor?: string): Promise<AdvanceResult | null> {
		const guard = await this.guardApprovalStep(taskId)
		if (!guard) return null

		await this.activityService?.log({
			actor: actor ?? 'system',
			type: 'reply',
			summary: `Replied to task ${taskId} at step "${guard.step.id}"`,
			details: JSON.stringify({ task_id: taskId, step_id: guard.step.id, action: 'replied', message }),
		})

		await this.taskService.update(taskId, { status: 'active' })
		const targetStepId = guard.step.on_reply
		const ctx = await this.buildStepContext(undefined, taskId)
		return this.advanceToTarget(taskId, targetStepId, undefined, { ...ctx, humanReply: message })
	}

	// ─── Private ────────────────────────────────────────────────────────

	private async guardApprovalStep(taskId: string): Promise<{ task: TaskRow; step: WorkflowStep } | null> {
		const task = await this.taskService.get(taskId)
		if (!task || !task.workflow_id || !task.workflow_step) return null

		const workflow = this.config.workflows.get(task.workflow_id)
		if (!workflow) return null

		const step = workflow.steps.find((s) => s.id === task.workflow_step)
		if (!step || step.type !== 'human_approval') return null

		return { task, step }
	}

	private async advanceToTarget(
		taskId: string,
		targetStepId?: string,
		outputs?: Record<string, string>,
		ctx?: StepContext,
	): Promise<AdvanceResult | null> {
		if (!targetStepId) {
			// Default advance — no source run context for human actions
			return this.advanceWithContext(taskId, outputs, ctx ?? {})
		}

		const task = await this.taskService.get(taskId)
		if (!task || !task.workflow_id) return null

		const workflow = this.config.workflows.get(task.workflow_id)
		if (!workflow) return null

		const targetStep = workflow.steps.find((s) => s.id === targetStepId)
		if (!targetStep) {
			console.warn(`[workflow-engine] target step "${targetStepId}" not found in workflow "${task.workflow_id}"`)
			return this.advanceWithContext(taskId, outputs, ctx ?? {})
		}

		const actions: string[] = ['advanced', `routed:${targetStepId}`]
		if (outputs) {
			for (const [k, v] of Object.entries(outputs)) {
				actions.push(`${k}:${v}`)
			}
		}

		const stepUpdates: Record<string, string> = { workflow_step: targetStep.id }
		if (targetStep.type === 'agent' && targetStep.agent_id) {
			stepUpdates.assigned_to = targetStep.agent_id
			actions.push('reassigned')
		}
		await this.taskService.update(taskId, stepUpdates)

		const updated = (await this.taskService.get(taskId))!
		const runId = await this.processCurrentStep(updated, actions, ctx ?? {})

		const final = runId !== null || actions.includes('done') || actions.includes('approval_needed')
			? (await this.taskService.get(taskId))!
			: updated
		return { task: final, runId, actions }
	}

	/** Like advance() but with pre-built StepContext. */
	private async advanceWithContext(taskId: string, outputs?: Record<string, string>, ctx?: StepContext): Promise<AdvanceResult | null> {
		const task = await this.taskService.get(taskId)
		if (!task || !task.workflow_id || !task.workflow_step) return null

		const workflow = this.config.workflows.get(task.workflow_id)
		if (!workflow) return null

		const nextStep = this.resolveNextStep(workflow, task.workflow_step, outputs)
		if (!nextStep) {
			await this.taskService.update(taskId, { status: 'done', workflow_step: '__done__' })
			return { task: (await this.taskService.get(taskId))!, runId: null, actions: ['done'] }
		}

		const actions: string[] = ['advanced']
		if (outputs) {
			for (const [k, v] of Object.entries(outputs)) {
				actions.push(`${k}:${v}`)
			}
		}

		const stepUpdates: Record<string, string> = { workflow_step: nextStep.id }
		if (nextStep.type === 'agent' && nextStep.agent_id) {
			stepUpdates.assigned_to = nextStep.agent_id
			actions.push('reassigned')
		}
		await this.taskService.update(taskId, stepUpdates)

		const updated = (await this.taskService.get(taskId))!
		const runId = await this.processCurrentStep(updated, actions, ctx ?? {})

		const final = runId !== null || actions.includes('done') || actions.includes('approval_needed')
			? (await this.taskService.get(taskId))!
			: updated
		return { task: final, runId, actions }
	}

	/**
	 * Process the current workflow step for a task.
	 * Builds full instructions: context forwarding + YAML instructions + output suffix.
	 */
	private async processCurrentStep(task: TaskRow, actions: string[], ctx: StepContext): Promise<string | null> {
		if (!task.workflow_id || !task.workflow_step) return null

		const workflow = this.config.workflows.get(task.workflow_id)
		if (!workflow) return null

		const step = workflow.steps.find((s) => s.id === task.workflow_step)
		if (!step) return null

		switch (step.type) {
			case 'agent': {
				const agentId = step.agent_id ?? task.assigned_to
				if (!agentId) {
					console.warn(`[workflow-engine] agent step "${step.id}" has no agent_id and task has no assigned_to`)
					return null
				}

				// Dependency check: all depends_on tasks must be done
				if (this.checkDependenciesFn) {
					const depStatus = await this.checkDependenciesFn(task.id)
					if (depStatus === 'failed') {
						await this.taskService.update(task.id, { status: 'failed' })
						actions.push('dependency_failed')
						eventBus.emit({ type: 'task_changed', taskId: task.id, status: 'failed' })
						console.log(`[workflow-engine] task ${task.id} failed — dependency failed`)
						return null
					}
					if (depStatus === 'pending') {
						await this.taskService.update(task.id, { status: 'blocked' })
						actions.push('blocked_on_dependency')
						eventBus.emit({ type: 'task_changed', taskId: task.id, status: 'blocked' })
						console.log(`[workflow-engine] task ${task.id} blocked — waiting on dependencies`)
						return null
					}
				}

				// Queue concurrency check: if task belongs to a queue, verify capacity
				if (task.queue) {
					const blocked = await this.isQueueBlocked(task)
					if (blocked) {
						// Task must wait — don't create a run yet
						await this.taskService.update(task.id, { status: 'active' })
						actions.push('queued')
						console.log(`[workflow-engine] task ${task.id} queued in "${task.queue}" — waiting for capacity`)
						return null
					}
				}

				// start_after check: if task has a future start_after, don't create run yet
				if (task.start_after && task.start_after > new Date().toISOString()) {
					await this.taskService.update(task.id, { status: 'active' })
					actions.push('deferred_start_after')
					console.log(`[workflow-engine] task ${task.id} deferred — start_after=${task.start_after}`)
					return null
				}

				await this.taskService.update(task.id, { status: 'active' })

				const targeting = this.resolveTargeting(step, agentId)
				const runtime = step.targeting?.required_runtime ?? this.defaultRuntime

				// Resolve agent model/provider/variant from authored config
				const agentConfig = this.config.agents.get(agentId)

				// Build instructions: [context] + [step instructions] + [human reply] + [output suffix]
				const instructions = await this.buildInstructions(task, step, ctx)

				const runId = `run-${Date.now()}-${randomBytes(6).toString('hex')}`
				await this.runService.create({
					id: runId,
					agent_id: agentId,
					task_id: task.id,
					runtime,
					model: agentConfig?.model,
					provider: agentConfig?.provider,
					variant: agentConfig?.variant,
					initiated_by: 'workflow-engine',
					instructions,
					targeting,
				})
				actions.push('run_created')

				eventBus.emit({ type: 'task_changed', taskId: task.id, status: 'active' })
				return runId
			}

			case 'human_approval': {
				await this.taskService.update(task.id, { status: 'blocked' })
				actions.push('approval_needed')
				eventBus.emit({ type: 'task_changed', taskId: task.id, status: 'blocked' })
				return null
			}

			case 'wait_for_children': {
				const met = await this.evaluateJoin(task.id, step)
				if (met === 'met') {
					actions.push('join_met')
					const target = step.on_met
					if (target) return this.routeToStep(task, target, actions)
					// No explicit target — fall through to next step
					return this.routeToNextStep(task, workflow, actions)
				}
				if (met === 'failed') {
					actions.push('join_child_failed')
					if (step.on_failed) return this.routeToStep(task, step.on_failed, actions)
					// No on_failed route — mark parent as failed
					await this.taskService.update(task.id, { status: 'failed' })
					eventBus.emit({ type: 'task_changed', taskId: task.id, status: 'failed' })
					return null
				}
				// Pending — block the parent
				await this.taskService.update(task.id, { status: 'blocked' })
				actions.push('waiting_for_children')
				eventBus.emit({ type: 'task_changed', taskId: task.id, status: 'blocked' })
				return null
			}

			case 'done': {
				await this.taskService.update(task.id, { status: 'done' })
				actions.push('done')
				eventBus.emit({ type: 'task_changed', taskId: task.id, status: 'done' })
				return null
			}

			default:
				return null
		}
	}

	// ─── Queue Management ──────────────────────────────────────────────

	/**
	 * Check if a task's queue has reached its concurrency limit.
	 * Returns true if the task must wait.
	 */
	private async isQueueBlocked(task: { queue: string | null }): Promise<boolean> {
		if (!task.queue) return false

		const queueConfig = (this.config.queues ?? {})[task.queue]
		const maxConcurrent = queueConfig?.max_concurrent ?? 1

		const activeCount = await this.taskService.countActiveInQueue(task.queue)
		return activeCount >= maxConcurrent
	}

	/**
	 * After a run completes for a queued task, check if the next task
	 * in the same queue should be started.
	 */
	async triggerNextInQueue(queueName: string): Promise<void> {
		const queueConfig = (this.config.queues ?? {})[queueName]
		const priorityOrder = queueConfig?.priority_order ?? 'fifo'
		const maxConcurrent = queueConfig?.max_concurrent ?? 1

		const activeCount = await this.taskService.countActiveInQueue(queueName)
		if (activeCount >= maxConcurrent) return

		const next = await this.taskService.findNextInQueue(queueName, priorityOrder)
		if (!next) return

		console.log(`[workflow-engine] queue "${queueName}" has capacity — triggering task ${next.id}`)
		await this.intake(next.id)
	}

	/**
	 * Check all tasks with start_after that has now elapsed and trigger their intake.
	 * Called periodically by a daemon or on-demand.
	 */
	async triggerDeferredTasks(): Promise<number> {
		const deferred = await this.taskService.listDeferredReady()
		let triggered = 0
		for (const task of deferred) {
			const result = await this.intake(task.id)
			if (result?.runId) triggered++
		}
		return triggered
	}

	// ─── Instruction Builder ────────────────────────────────────────────

	/**
	 * Build full instructions for a run:
	 * 1. Source run summary (from the step that directly caused advancement)
	 * 2. Explicit artifact inputs (from step.input.artifacts)
	 * 3. Step YAML instructions
	 * 4. Human reply (if present)
	 * 5. Output suffix (auto-generated from step.output)
	 */
	private async buildInstructions(task: TaskRow, step: WorkflowStep, ctx: StepContext): Promise<string> {
		const parts: string[] = []

		// 1. Prior run history — all completed runs for context continuity
		if (ctx.priorRunSummaries?.length) {
			const historyLines = ctx.priorRunSummaries.map(
				(r) => `- **${r.runId}**: ${r.summary}`,
			)
			parts.push(`## Workflow History\n\n${historyLines.join('\n')}`)
		}

		// 2. Source run context — the run that directly caused this advancement
		if (ctx.sourceRunSummary) {
			parts.push(`## Previous Step Output\n\n${ctx.sourceRunSummary}`)
		}

		// 3. Explicit artifact inputs — look up by kind from task's artifact history
		if (step.input?.artifacts?.length && this.artifactService && task.id) {
			const taskArtifacts = await this.artifactService.listForTask(task.id)
			for (const wantedKind of step.input.artifacts) {
				// Find most recent artifact of this kind (last in array)
				const found = [...taskArtifacts].reverse().find((a) => a.kind === wantedKind)
				if (found) {
					parts.push(`## Input: ${found.title}\n\n${found.ref_value}`)
				} else {
					parts.push(`## Input: ${wantedKind}\n\n> **Warning:** Expected artifact "${wantedKind}" was not found. It may not have been produced by a prior step.`)
				}
			}
		}

		// 4. Step YAML instructions
		if (step.instructions) {
			parts.push(step.instructions)
		}

		// 5. Human reply
		if (ctx.humanReply) {
			parts.push(`## Human Feedback\n\n${ctx.humanReply}`)
		}

		// 6. Output suffix — auto-generated from step.output declaration
		const suffix = generateOutputSuffix(step)
		if (suffix) {
			parts.push(suffix)
		}

		return parts.join('\n\n')
	}

	/** Build StepContext from a source run and/or the task's full run history. */
	private async buildStepContext(sourceRunId?: string, taskId?: string): Promise<StepContext> {
		const ctx: StepContext = {}

		if (sourceRunId) {
			const run = await this.runService.get(sourceRunId)
			if (run?.summary) {
				ctx.sourceRunSummary = run.summary
			}
		}

		if (taskId) {
			const allRuns = await this.runService.list({ task_id: taskId, status: 'completed' })
			const sorted = allRuns
				.filter((r) => r.summary && r.id !== sourceRunId)
				.sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
				.slice(0, 10)
			if (sorted.length > 0) {
				ctx.priorRunSummaries = sorted.map((r) => ({
					runId: r.id,
					summary: r.summary!.length > 500 ? `${r.summary!.slice(0, 497)}...` : r.summary!,
				}))
			}
		}

		return ctx
	}

	// ─── Targeting ──────────────────────────────────────────────────────

	private resolveTargeting(step: WorkflowStep, agentId?: string): string | undefined {
		const hasStepTargeting = !!step.targeting
		const hasActions = (step.actions?.length ?? 0) > 0
		const capabilities = agentId ? this.resolveCapabilities(agentId, step) : undefined

		if (!hasStepTargeting && !hasActions && !capabilities) return undefined

		const tags = [...(step.targeting?.required_worker_tags ?? [])]
		const target: ResolvedTargeting = {
			required_worker_id: step.targeting?.required_worker_id,
			required_runtime: step.targeting?.required_runtime,
			required_worker_tags: tags,
			allow_fallback: step.targeting?.allow_fallback ?? true,
		}

		if (step.targeting?.environment) {
			const env = this.config.environments.get(step.targeting.environment)
			if (env) {
				for (const tag of env.required_tags) {
					if (!tags.includes(tag)) tags.push(tag)
				}
				if (env.secret_refs.length > 0) {
					target.secret_refs = env.secret_refs
				}
			} else {
				console.warn(`[workflow-engine] environment "${step.targeting.environment}" not found`)
			}
		}

		if (hasActions) {
			target.actions = step.actions!
		}

		if (capabilities) {
			target.resolved_capabilities = capabilities
		}

		const hasConstraints = target.required_worker_id || target.required_runtime || tags.length > 0 || target.actions || target.secret_refs || target.resolved_capabilities
		if (!hasConstraints) return undefined
		return JSON.stringify(target)
	}

	// ─── Capability Resolution ─────────────────────────────────────────

	/**
	 * Resolve capability profiles for a run.
	 * Merge rule: agent profiles first, step profiles extend. Deduplicated.
	 * Returns undefined if no profiles are referenced.
	 */
	private resolveCapabilities(agentId: string, step: WorkflowStep): ResolvedCapabilities | undefined {
		const agent = this.config.agents.get(agentId)
		const agentProfileIds = agent?.capability_profiles ?? []
		const stepProfileIds = step.capability_profiles ?? []

		if (agentProfileIds.length === 0 && stepProfileIds.length === 0) return undefined

		// Deduplicate: agent first, step extends (preserves order, first wins)
		const profileIds = [...new Set([...agentProfileIds, ...stepProfileIds])]

		// Merge all referenced profiles into a single resolved set
		const skills = new Set<string>()
		const mcpServers = new Set<string>()
		const context = new Set<string>()
		const prompts: string[] = []

		for (const profileId of profileIds) {
			const profile = this.config.capabilityProfiles.get(profileId)
			if (!profile) {
				console.warn(`[workflow-engine] capability profile "${profileId}" not found`)
				continue
			}
			for (const s of profile.skills) skills.add(s)
			for (const m of profile.mcp_servers) mcpServers.add(m)
			for (const c of profile.context) context.add(c)
			for (const p of profile.prompts) prompts.push(p)
		}

		return {
			skills: [...skills],
			mcp_servers: [...mcpServers],
			context: [...context],
			prompts,
		}
	}

	// ─── Join Evaluation ────────────────────────────────────────────────

	/**
	 * Evaluate the join condition for a wait_for_children step.
	 * Returns 'met' if policy satisfied, 'failed' if child failure detected, 'pending' otherwise.
	 */
	private async evaluateJoin(taskId: string, step: WorkflowStep): Promise<'met' | 'failed' | 'pending'> {
		if (!this.childRollupFn) {
			console.warn('[workflow-engine] wait_for_children requires childRollupFn — treating as pending')
			return 'pending'
		}

		const rollup = await this.childRollupFn(taskId, step.join_relation_type)
		if (rollup.total === 0) return 'pending'

		const policy = step.join_policy ?? 'all_done'

		if (policy === 'all_done') {
			if (rollup.failed > 0) return 'failed'
			if (rollup.done === rollup.total) return 'met'
			return 'pending'
		}

		if (policy === 'any_failed') {
			if (rollup.failed > 0) return 'met'
			return 'pending'
		}

		return 'pending'
	}

	/** Route a task to a specific step by ID. Used by wait_for_children on_met/on_failed. */
	private async routeToStep(task: TaskRow, targetStepId: string, actions: string[]): Promise<string | null> {
		if (!task.workflow_id) return null
		const workflow = this.config.workflows.get(task.workflow_id)
		if (!workflow) return null

		const targetStep = workflow.steps.find((s) => s.id === targetStepId)
		if (!targetStep) return null
		return this.applyStepAndProcess(task, targetStep, actions)
	}

	/** Route a task to the next step in array order. Fallback for on_met without explicit target. */
	private async routeToNextStep(task: TaskRow, workflow: Workflow, actions: string[]): Promise<string | null> {
		const nextStep = this.resolveNextStep(workflow, task.workflow_step!, undefined)
		if (!nextStep) {
			await this.taskService.update(task.id, { status: 'done', workflow_step: '__done__' })
			actions.push('done')
			eventBus.emit({ type: 'task_changed', taskId: task.id, status: 'done' })
			return null
		}
		return this.applyStepAndProcess(task, nextStep, actions)
	}

	/** Update task to target step and process it. Shared by routeToStep/routeToNextStep. */
	private async applyStepAndProcess(task: TaskRow, targetStep: WorkflowStep, actions: string[]): Promise<string | null> {
		const stepUpdates: Record<string, string> = { workflow_step: targetStep.id }
		if (targetStep.type === 'agent' && targetStep.agent_id) {
			stepUpdates.assigned_to = targetStep.agent_id
		}
		await this.taskService.update(task.id, stepUpdates)

		const ctx = await this.buildStepContext(undefined, task.id)
		const updated = (await this.taskService.get(task.id))!
		return this.processCurrentStep(updated, actions, ctx)
	}

	/**
	 * Public re-evaluation of a waiting parent. Called by ParentJoinBridge when a child changes.
	 * Only acts if the task is currently on a wait_for_children step and blocked.
	 */
	async reevaluateJoin(taskId: string): Promise<AdvanceResult | null> {
		const task = await this.taskService.get(taskId)
		if (!task || !task.workflow_id || !task.workflow_step) return null
		if (task.status !== 'blocked') return null

		const workflow = this.config.workflows.get(task.workflow_id)
		if (!workflow) return null

		const step = workflow.steps.find((s) => s.id === task.workflow_step)
		if (!step || step.type !== 'wait_for_children') return null

		const met = await this.evaluateJoin(taskId, step)
		if (met === 'pending') return null

		const actions: string[] = []
		const ctx = await this.buildStepContext(undefined, taskId)
		const runId = await this.processCurrentStep(task, actions, ctx)

		const final = (await this.taskService.get(taskId))!
		return { task: final, runId, actions }
	}

	// ─── Revision Tracking ─────────────────────────────────────────────

	/**
	 * Get the revision count for a specific loop (e.g., "validate-plan→plan").
	 * Stored in task metadata under `_revisions:<from>→<to>`.
	 */
	/**
	 * Increment and persist the revision counter for a loop transition.
	 * Returns the new count.
	 */
	private async incrementRevisionCount(taskId: string, metadata: string | null, fromStep: string, toStep: string): Promise<number> {
		let meta: Record<string, unknown>
		try {
			meta = JSON.parse(metadata || '{}')
		} catch (err) {
			console.debug('[workflow-engine] malformed task metadata JSON:', err instanceof Error ? err.message : String(err))
			meta = {}
		}
		const key = `${REVISION_KEY_PREFIX}${fromStep}→${toStep}`
		const prev = typeof meta[key] === 'number' ? meta[key] : 0
		const newCount = prev + 1
		meta[key] = newCount
		await this.taskService.update(taskId, { metadata: JSON.stringify(meta) })
		return newCount
	}

	/**
	 * Check if a transition is a revision loop (goes backward to an earlier step).
	 * A revision loop is when a transition targets a step that appears earlier in the workflow.
	 */
	private isRevisionLoop(workflow: Workflow, fromStepId: string, toStepId: string): boolean {
		const fromIdx = workflow.steps.findIndex((s) => s.id === fromStepId)
		const toIdx = workflow.steps.findIndex((s) => s.id === toStepId)
		return fromIdx !== -1 && toIdx !== -1 && toIdx < fromIdx
	}

	/**
	 * Find the human_approval step in a workflow (for escalation).
	 * Returns the first human_approval step, or null.
	 */
	private findHumanApprovalStep(workflow: Workflow): WorkflowStep | null {
		return workflow.steps.find((s) => s.type === 'human_approval') ?? null
	}

	// ─── Empty Output Detection ─────────────────────────────────────────

	/**
	 * Check if a run summary indicates empty/missing output.
	 */
	private isEmptyOutput(summary?: string | null): boolean {
		if (!summary) return true
		const trimmed = summary.trim()
		if (trimmed === '') return true
		// Common empty-output patterns
		const emptyPatterns = [
			/^completed? with no output$/i,
			/^no output$/i,
			/^empty$/i,
			/^n\/a$/i,
		]
		return emptyPatterns.some((p) => p.test(trimmed))
	}

	/**
	 * Get and increment the empty output retry count for a step.
	 * Stored in task metadata under `_empty_retries:<stepId>`.
	 */
	private async getAndIncrementEmptyRetry(taskId: string, metadata: string | null, stepId: string): Promise<number> {
		let meta: Record<string, unknown>
		try {
			meta = JSON.parse(metadata || '{}')
		} catch (err) {
			console.debug('[workflow-engine] malformed task metadata JSON:', err instanceof Error ? err.message : String(err))
			meta = {}
		}
		const key = `_empty_retries:${stepId}`
		const prev = typeof meta[key] === 'number' ? meta[key] : 0
		const count = prev + 1
		meta[key] = count
		await this.taskService.update(taskId, { metadata: JSON.stringify(meta) })
		return count
	}

	// ─── Step Resolution ────────────────────────────────────────────────

	/**
	 * Resolve the next step by evaluating transitions against structured outputs.
	 * Order: transitions (first match) → explicit next → array order.
	 */
	private resolveNextStep(workflow: Workflow, currentStepId: string, outputs?: Record<string, string>): WorkflowStep | null {
		const currentStep = workflow.steps.find((s) => s.id === currentStepId)
		if (!currentStep) return null

		// Evaluate transition rules in order — first match wins
		if (outputs && currentStep.transitions?.length) {
			for (const transition of currentStep.transitions) {
				if (matchTransition(transition, outputs)) {
					return workflow.steps.find((s) => s.id === transition.goto) ?? null
				}
			}
		}

		if (currentStep.next) {
			return workflow.steps.find((s) => s.id === currentStep.next) ?? null
		}

		const idx = workflow.steps.findIndex((s) => s.id === currentStepId)
		if (idx === -1 || idx >= workflow.steps.length - 1) return null
		return workflow.steps[idx + 1]!
	}
}

// ─── Transition Matching ──────────────────────────────────────────────────

/**
 * Check if a transition rule matches the given outputs.
 * All fields in `when` must match (AND semantics). Values are case-insensitive.
 */
function matchTransition(transition: StepTransition, outputs: Record<string, string>): boolean {
	for (const [field, expectedValue] of Object.entries(transition.when)) {
		const actual = outputs[field]
		if (actual === undefined) return false
		if (actual.toLowerCase() !== expectedValue.toLowerCase()) return false
	}
	return true
}

// ─── Output Suffix Generator ──────────────────────────────────────────────

/**
 * Generate a structured-output instruction suffix from a step's output declaration.
 * Returns null if the step has no output declaration.
 *
 * All tags are generic. `artifact` tags are registered through the artifact system.
 * Transition rules match against any tag's value for routing.
 */
export function generateOutputSuffix(step: WorkflowStep): string | null {
	if (!step.output) return null

	const { artifacts, ...tags } = step.output
	const tagEntries = Object.entries(tags).filter(
		([_, v]) => v && typeof v === 'object' && 'description' in v,
	) as Array<[string, { description: string; values?: Record<string, string> }]>

	if (tagEntries.length === 0 && (!artifacts || artifacts.length === 0)) return null

	const lines: string[] = ['## Required Output Format', '', 'When you are done, provide your result in this exact format:', '', '<AUTOPILOT_RESULT>']

	// All tags — same treatment. Tags with values get VALUE_PLACEHOLDER, others get description.
	for (const [name, def] of tagEntries) {
		if (def.values) {
			lines.push(`  <${name}>${name.toUpperCase()}_VALUE</${name}>`)
		} else {
			lines.push(`  <${name}>${def.description}</${name}>`)
		}
	}
	if (artifacts?.length) {
		for (const art of artifacts) {
			lines.push(`  <artifact kind="${art.kind}" title="${art.title}">`)
			lines.push(`    ${art.description}`)
			lines.push('  </artifact>')
		}
	}

	lines.push('</AUTOPILOT_RESULT>')

	// Append value descriptions for any tag that has constrained values
	for (const [name, def] of tagEntries) {
		if (def.values) {
			lines.push('')
			lines.push(`Where ${name} must be one of:`)
			for (const [value, desc] of Object.entries(def.values)) {
				lines.push(`- ${value} — ${desc}`)
			}
		}
	}

	return lines.join('\n')
}
