import type { Agent, Workflow, WorkflowStep, Company } from '@questpie/autopilot-spec'
import type { TaskService, TaskRow } from './tasks'
import type { RunService } from './runs'
import { eventBus } from '../events/event-bus'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AuthoredConfig {
	company: Company
	agents: Map<string, Agent>
	workflows: Map<string, Workflow>
}

export interface IntakeResult {
	task: TaskRow
	/** Run created if first step is an agent step. */
	runId: string | null
	/** What happened: assigned, workflow_attached, run_created, approved_needed, done */
	actions: string[]
}

export interface AdvanceResult {
	task: TaskRow
	/** New run created if next step is an agent step. */
	runId: string | null
	/** What happened */
	actions: string[]
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
	) {
		this.defaultAssignee = config.company.settings.default_task_assignee
		this.defaultWorkflow = config.company.settings.default_workflow
		this.defaultRuntime = config.company.settings.default_runtime
	}

	/**
	 * Validate that authored config references are consistent.
	 * Call at startup — logs warnings for missing references.
	 * Returns list of issues found.
	 */
	validate(): string[] {
		const issues: string[] = []

		if (this.defaultAssignee && !this.config.agents.has(this.defaultAssignee)) {
			issues.push(
				`default_task_assignee "${this.defaultAssignee}" not found in loaded agents`,
			)
		}

		if (this.defaultWorkflow && !this.config.workflows.has(this.defaultWorkflow)) {
			issues.push(
				`default_workflow "${this.defaultWorkflow}" not found in loaded workflows`,
			)
		}

		// Validate agent references in workflow steps
		for (const [wfId, wf] of this.config.workflows) {
			for (const step of wf.steps) {
				if (step.type === 'agent' && step.agent_id && !this.config.agents.has(step.agent_id)) {
					issues.push(
						`workflow "${wfId}" step "${step.id}" references unknown agent "${step.agent_id}"`,
					)
				}
			}
		}

		return issues
	}

	/**
	 * Process a newly created task through workflow-driven intake.
	 *
	 * 1. Resolve assigned_to from config if not set
	 * 2. Attach workflow if not set
	 * 3. Set initial workflow_step
	 * 4. Process the first step
	 */
	async intake(taskId: string): Promise<IntakeResult | null> {
		const task = await this.taskService.get(taskId)
		if (!task) return null

		const actions: string[] = []
		const updates: Record<string, string> = {}

		// 1. Resolve default assignee
		if (!task.assigned_to && this.defaultAssignee) {
			if (!this.config.agents.has(this.defaultAssignee)) {
				console.warn(
					`[workflow-engine] default_task_assignee "${this.defaultAssignee}" not found — skipping assignment`,
				)
			} else {
				updates.assigned_to = this.defaultAssignee
				actions.push('assigned')
			}
		}

		// 2. Resolve default workflow
		const workflowId = task.workflow_id ?? this.defaultWorkflow
		if (workflowId && !task.workflow_id) {
			const workflow = this.config.workflows.get(workflowId)
			if (!workflow) {
				console.warn(
					`[workflow-engine] default_workflow "${workflowId}" not found — skipping workflow attachment`,
				)
			} else if (workflow.steps.length === 0) {
				console.warn(
					`[workflow-engine] workflow "${workflowId}" has no steps — skipping`,
				)
			} else {
				updates.workflow_id = workflowId
				updates.workflow_step = workflow.steps[0]!.id
				actions.push('workflow_attached')
			}
		}

		// Apply updates if any
		if (Object.keys(updates).length > 0) {
			await this.taskService.update(taskId, updates)
		}

		// Re-fetch task with updates applied, then process first workflow step
		const updated = (await this.taskService.get(taskId))!
		const runId = await this.processCurrentStep(updated, actions)

		return { task: (await this.taskService.get(taskId))!, runId, actions }
	}

	/**
	 * Advance a task to the next workflow step after a run completes.
	 * Called when a run tied to a task completes successfully.
	 */
	async advance(taskId: string): Promise<AdvanceResult | null> {
		const task = await this.taskService.get(taskId)
		if (!task) return null
		if (!task.workflow_id || !task.workflow_step) return null

		const workflow = this.config.workflows.get(task.workflow_id)
		if (!workflow) return null

		const nextStep = this.getNextStep(workflow, task.workflow_step)
		if (!nextStep) {
			// No more steps — workflow complete, mark task done
			await this.taskService.update(taskId, { status: 'done', workflow_step: '__done__' })
			return { task: (await this.taskService.get(taskId))!, runId: null, actions: ['done'] }
		}

		const actions: string[] = ['advanced']

		// Update workflow step (and ownership if agent step)
		const stepUpdates: Record<string, string> = { workflow_step: nextStep.id }
		if (nextStep.type === 'agent' && nextStep.agent_id) {
			stepUpdates.assigned_to = nextStep.agent_id
			actions.push('reassigned')
		}
		await this.taskService.update(taskId, stepUpdates)

		// Process the new step
		const updated = (await this.taskService.get(taskId))!
		const runId = await this.processCurrentStep(updated, actions)

		return { task: (await this.taskService.get(taskId))!, runId, actions }
	}

	/**
	 * Approve a task's current human_approval step and advance to the next step.
	 */
	async approve(taskId: string): Promise<AdvanceResult | null> {
		const task = await this.taskService.get(taskId)
		if (!task) return null
		if (!task.workflow_id || !task.workflow_step) return null

		const workflow = this.config.workflows.get(task.workflow_id)
		if (!workflow) return null

		const currentStep = workflow.steps.find((s) => s.id === task.workflow_step)
		if (!currentStep || currentStep.type !== 'human_approval') {
			return null // Not on a human_approval step
		}

		// Move task back to active (was blocked)
		await this.taskService.update(taskId, { status: 'active' })

		// Advance to next step
		return this.advance(taskId)
	}

	// ─── Internal ────────────────────────────────────────────────────────────

	/**
	 * Process the current workflow step for a task.
	 * - agent → create run, set task active
	 * - human_approval → set task blocked
	 * - done → set task done
	 */
	private async processCurrentStep(task: TaskRow, actions: string[]): Promise<string | null> {
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

				// Update task to active
				await this.taskService.update(task.id, { status: 'active' })

				// Create a pending run
				const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
				await this.runService.create({
					id: runId,
					agent_id: agentId,
					task_id: task.id,
					runtime: this.defaultRuntime,
					initiated_by: 'workflow-engine',
					instructions: step.instructions,
				})
				actions.push('run_created')

				eventBus.emit({
					type: 'task_changed',
					taskId: task.id,
					status: 'active',
				})

				return runId
			}

			case 'human_approval': {
				await this.taskService.update(task.id, { status: 'blocked' })
				actions.push('approval_needed')

				eventBus.emit({
					type: 'task_changed',
					taskId: task.id,
					status: 'blocked',
				})

				return null
			}

			case 'done': {
				await this.taskService.update(task.id, { status: 'done' })
				actions.push('done')

				eventBus.emit({
					type: 'task_changed',
					taskId: task.id,
					status: 'done',
				})

				return null
			}

			default:
				return null
		}
	}

	/**
	 * Get the next step in a workflow after the given step ID.
	 * Uses explicit `next` field if present, otherwise array order.
	 */
	private getNextStep(workflow: Workflow, currentStepId: string): WorkflowStep | null {
		const currentStep = workflow.steps.find((s) => s.id === currentStepId)
		if (!currentStep) return null

		// Explicit next pointer
		if (currentStep.next) {
			return workflow.steps.find((s) => s.id === currentStep.next) ?? null
		}

		// Array order
		const idx = workflow.steps.findIndex((s) => s.id === currentStepId)
		if (idx === -1 || idx >= workflow.steps.length - 1) return null
		return workflow.steps[idx + 1]!
	}
}
