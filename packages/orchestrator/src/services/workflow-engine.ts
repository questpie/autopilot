import type { Agent, Workflow, WorkflowStep, CompanyScope, ExecutionTarget, Environment, SecretRef, ExternalAction, StepTransition, Provider } from '@questpie/autopilot-spec'
import type { TaskService, TaskRow } from './tasks'
import type { RunService } from './runs'
import type { ActivityService } from './activity'
import type { ArtifactService } from './artifacts'
import { eventBus } from '../events/event-bus'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AuthoredConfig {
	company: CompanyScope
	agents: Map<string, Agent>
	workflows: Map<string, Workflow>
	environments: Map<string, Environment>
	providers: Map<string, Provider>
	defaults: { runtime: string; workflow?: string; task_assignee?: string }
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
}

/** Context carried from the source step that caused advancement. */
interface StepContext {
	/** Summary from the run that just completed (the direct source). */
	sourceRunSummary?: string
	/** Human reply text. */
	humanReply?: string
}

// ─── Engine ─────────────────────────────────────────────────────────────────

export class WorkflowEngine {
	private defaultAssignee: string | undefined
	private defaultWorkflow: string | undefined
	private defaultRuntime: string

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
	 * Advance after a run completes.
	 * @param outputs — structured output fields from the completed run (for transition matching)
	 * @param sourceRunId — the run that just completed (direct source for context forwarding)
	 */
	async advance(taskId: string, outputs?: Record<string, string>, sourceRunId?: string): Promise<AdvanceResult | null> {
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

		// Build context from the source run
		const ctx = await this.buildStepContext(sourceRunId)

		const updated = (await this.taskService.get(taskId))!
		const runId = await this.processCurrentStep(updated, actions, ctx)

		const final = runId !== null || actions.includes('done') || actions.includes('approval_needed')
			? (await this.taskService.get(taskId))!
			: updated
		return { task: final, runId, actions }
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
		return this.advanceToTarget(taskId, targetStepId)
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
		return this.advanceToTarget(taskId, targetStepId, undefined, { humanReply: message })
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

				await this.taskService.update(task.id, { status: 'active' })

				const targeting = this.resolveTargeting(step)
				const runtime = step.targeting?.required_runtime ?? this.defaultRuntime

				// Build instructions: [context] + [step instructions] + [human reply] + [output suffix]
				const instructions = await this.buildInstructions(task, step, ctx)

				const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
				await this.runService.create({
					id: runId,
					agent_id: agentId,
					task_id: task.id,
					runtime,
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

		// 1. Source run context — the run that directly caused this advancement
		if (ctx.sourceRunSummary) {
			parts.push(`## Previous Step Output\n\n${ctx.sourceRunSummary}`)
		}

		// 2. Explicit artifact inputs — look up by kind from task's artifact history
		if (step.input?.artifacts?.length && this.artifactService && task.id) {
			const taskArtifacts = await this.artifactService.listForTask(task.id)
			for (const wantedKind of step.input.artifacts) {
				// Find most recent artifact of this kind (last in array)
				const found = [...taskArtifacts].reverse().find((a) => a.kind === wantedKind)
				if (found) {
					parts.push(`## Input: ${found.title}\n\n${found.ref_value}`)
				}
			}
		}

		// 3. Step YAML instructions
		if (step.instructions) {
			parts.push(step.instructions)
		}

		// 4. Human reply
		if (ctx.humanReply) {
			parts.push(`## Human Feedback\n\n${ctx.humanReply}`)
		}

		// 5. Output suffix — auto-generated from step.output declaration
		const suffix = generateOutputSuffix(step)
		if (suffix) {
			parts.push(suffix)
		}

		return parts.join('\n\n')
	}

	/** Build StepContext from a source run that just completed. */
	private async buildStepContext(sourceRunId?: string): Promise<StepContext> {
		if (!sourceRunId) return {}
		const run = await this.runService.get(sourceRunId)
		if (!run || !run.summary) return {}
		return { sourceRunSummary: run.summary }
	}

	// ─── Targeting ──────────────────────────────────────────────────────

	private resolveTargeting(step: WorkflowStep): string | undefined {
		const hasStepTargeting = !!step.targeting
		const hasActions = (step.actions?.length ?? 0) > 0

		if (!hasStepTargeting && !hasActions) return undefined

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

		const hasConstraints = target.required_worker_id || target.required_runtime || tags.length > 0 || target.actions || target.secret_refs
		if (!hasConstraints) return undefined
		return JSON.stringify(target)
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
