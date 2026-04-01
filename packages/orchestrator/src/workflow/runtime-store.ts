import { and, desc, eq } from 'drizzle-orm'
import { container } from '../container'
import { dbFactory } from '../db'
import type { AutopilotDb } from '../db'
import { stepRuns, workflowRuns } from '../db/schema'
import type { Task } from '../fs/storage'
import type { CompiledWorkflow, CompiledWorkflowStep } from './compiler'
import type { WorkflowTransitionResult } from './engine'

export type WorkflowRunStatus =
	| 'pending'
	| 'active'
	| 'waiting_human'
	| 'waiting_child'
	| 'blocked'
	| 'completed'
	| 'failed'
	| 'archived'

export type StepRunStatus =
	| 'pending'
	| 'assigned'
	| 'executing'
	| 'waiting_human'
	| 'waiting_validation'
	| 'waiting_child'
	| 'completed'
	| 'blocked'
	| 'failed'
	| 'archived'

export type WorkflowRunRecord = typeof workflowRuns.$inferSelect
export type StepRunRecord = typeof stepRuns.$inferSelect

interface EnsureWorkflowRunOptions {
	task: Task
	workflow: CompiledWorkflow
	triggerSource: string
	status?: WorkflowRunStatus
	currentStepId?: string
	lastEvent?: string
	metadata?: Record<string, unknown>
}

interface EnsureStepRunOptions {
	workflowRunId: string
	task: Task
	step: CompiledWorkflowStep
	status: StepRunStatus
	result?: WorkflowTransitionResult
	inputSnapshot?: Record<string, unknown>
	outputSnapshot?: Record<string, unknown>
	validationSnapshot?: Record<string, unknown>
	failureReason?: string
	childWorkflowId?: string
	childTaskId?: string
	idempotencyKey?: string
	metadata?: Record<string, unknown>
}

interface UpdateStepRunOptions {
	status?: StepRunStatus
	outputSnapshot?: Record<string, unknown>
	validationSnapshot?: Record<string, unknown>
	failureReason?: string | null
	childTaskId?: string | null
	childWorkflowId?: string | null
	metadata?: Record<string, unknown>
	completedAt?: string | null
	archivedAt?: string | null
}

interface UpdateWorkflowRunOptions {
	status?: WorkflowRunStatus
	currentStepId?: string | null
	lastEvent?: string | null
	metadata?: Record<string, unknown>
	completedAt?: string | null
	archivedAt?: string | null
}

const TERMINAL_STEP_STATUSES = new Set<StepRunStatus>([
	'completed',
	'blocked',
	'failed',
	'archived',
])

function safeParseJson<T>(value: string | null, fallback: T): T {
	if (!value) return fallback
	try {
		return JSON.parse(value) as T
	} catch {
		return fallback
	}
}

function toJson(value: unknown): string {
	return JSON.stringify(value ?? {})
}

function sanitizeIdSegment(value: string): string {
	const normalized = value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
	return normalized.slice(0, 48) || 'run'
}

export function buildWorkflowRunId(taskId: string): string {
	return `workflow-run-${sanitizeIdSegment(taskId)}`
}

function buildStepRunId(workflowRunId: string, stepId: string, attempt: number): string {
	return `${workflowRunId}-${sanitizeIdSegment(stepId)}-${attempt}`
}

function resolveExecutorRef(step: CompiledWorkflowStep): string | undefined {
	return (
		step.executor?.agentId ??
		step.executor?.role ??
		step.executor?.gate ??
		step.executor?.workflow ??
		step.executor?.tool
	)
}

function deriveWorkflowRunStatus(result: WorkflowTransitionResult): WorkflowRunStatus {
	switch (result.action) {
		case 'notify_human':
			return 'waiting_human'
		case 'spawn_workflow':
			return 'waiting_child'
		case 'complete':
			return 'completed'
		case 'error':
			return 'failed'
		default:
			return 'active'
	}
}

function deriveStepRunStatus(result: WorkflowTransitionResult): StepRunStatus {
	switch (result.action) {
		case 'assign_agent':
			return 'assigned'
		case 'notify_human':
			return 'waiting_human'
		case 'spawn_workflow':
			return 'waiting_child'
		case 'complete':
			return 'completed'
		case 'error':
			return 'failed'
		case 'no_action':
			return result.validationMode === 'review' ? 'waiting_validation' : 'pending'
		default:
			return 'pending'
	}
}

function nowIso(): string {
	return new Date().toISOString()
}

function isTerminalWorkflowStatus(status: WorkflowRunStatus): boolean {
	return status === 'completed' || status === 'failed' || status === 'archived'
}

export class WorkflowRuntimeStore {
	constructor(private db: AutopilotDb) {}

	async getWorkflowRunByTaskId(taskId: string): Promise<WorkflowRunRecord | undefined> {
		const rows = await this.db
			.select()
			.from(workflowRuns)
			.where(eq(workflowRuns.task_id, taskId))
			.limit(1)
		return rows[0]
	}

	async getWorkflowDefinition(taskId: string): Promise<CompiledWorkflow | null> {
		const run = await this.getWorkflowRunByTaskId(taskId)
		if (!run?.workflow_definition || run.workflow_definition === '{}') return null
		try {
			return JSON.parse(run.workflow_definition) as CompiledWorkflow
		} catch {
			return null
		}
	}

	async listStepRuns(workflowRunId: string): Promise<StepRunRecord[]> {
		return this.db
			.select()
			.from(stepRuns)
			.where(eq(stepRuns.workflow_run_id, workflowRunId))
			.orderBy(stepRuns.step_id, stepRuns.attempt)
	}

	async ensureWorkflowRun(options: EnsureWorkflowRunOptions): Promise<WorkflowRunRecord> {
		const timestamp = nowIso()
		const runId = buildWorkflowRunId(options.task.id)
		const existing = await this.getWorkflowRunByTaskId(options.task.id)
		const nextStatus = options.status ?? 'active'
		const nextMetadata = {
			...safeParseJson(existing?.metadata ?? null, {}),
			...(options.metadata ?? {}),
		}

		if (existing) {
			const shouldClearArchive = !isTerminalWorkflowStatus(nextStatus)
			await this.db
				.update(workflowRuns)
				.set({
					workflow_id: options.workflow.id,
					status: nextStatus,
					current_step_id:
						options.currentStepId ?? options.task.workflow_step ?? existing.current_step_id,
					trigger_source: options.triggerSource,
					parent_task_id: options.task.parent ?? existing.parent_task_id,
					input_snapshot: toJson(options.task.context),
					workflow_definition:
						!existing.workflow_definition || existing.workflow_definition === '{}'
							? toJson(options.workflow)
							: existing.workflow_definition,
					last_event: options.lastEvent ?? existing.last_event,
					stream_id: `workflow-${options.task.id}`,
					updated_at: timestamp,
					completed_at: nextStatus === 'completed' ? (existing.completed_at ?? timestamp) : null,
					archived_at: shouldClearArchive ? null : existing.archived_at,
					metadata: toJson(nextMetadata),
				})
				.where(eq(workflowRuns.id, existing.id))
			return (await this.getWorkflowRunByTaskId(options.task.id)) ?? existing
		}

		const row: WorkflowRunRecord = {
			id: runId,
			task_id: options.task.id,
			workflow_id: options.workflow.id,
			status: nextStatus,
			current_step_id: options.currentStepId ?? options.task.workflow_step ?? null,
			trigger_source: options.triggerSource,
			parent_task_id: options.task.parent ?? null,
			parent_run_id: null,
			input_snapshot: toJson(options.task.context),
			workflow_definition: toJson(options.workflow),
			last_event: options.lastEvent ?? null,
			stream_id: `workflow-${options.task.id}`,
			created_at: timestamp,
			updated_at: timestamp,
			started_at: timestamp,
			completed_at: nextStatus === 'completed' ? timestamp : null,
			archived_at: null,
			metadata: toJson(nextMetadata),
		}

		await this.db.insert(workflowRuns).values(row)
		return row
	}

	private async getLatestStepRun(
		workflowRunId: string,
		stepId: string,
	): Promise<StepRunRecord | undefined> {
		const rows = await this.db
			.select()
			.from(stepRuns)
			.where(and(eq(stepRuns.workflow_run_id, workflowRunId), eq(stepRuns.step_id, stepId)))
			.orderBy(desc(stepRuns.attempt))
			.limit(1)
		return rows[0]
	}

	async ensureStepRun(options: EnsureStepRunOptions): Promise<StepRunRecord> {
		const timestamp = nowIso()
		const existing = await this.getLatestStepRun(options.workflowRunId, options.step.id)
		const result = options.result
		const nextStatus = options.status
		const nextMetadata = {
			...safeParseJson(existing?.metadata ?? null, {}),
			...(options.metadata ?? {}),
		}

		if (existing && !TERMINAL_STEP_STATUSES.has(existing.status as StepRunStatus)) {
			await this.db
				.update(stepRuns)
				.set({
					status: nextStatus,
					executor_kind: options.step.executor?.kind ?? null,
					executor_ref: resolveExecutorRef(options.step) ?? null,
					model_policy: options.step.modelPolicy ?? null,
					validation_mode: options.step.validation.mode,
					input_snapshot: toJson(options.inputSnapshot ?? { context: options.task.context }),
					output_snapshot: toJson(options.outputSnapshot ?? {}),
					validation_snapshot: toJson(options.validationSnapshot ?? {}),
					failure_action: result?.failureAction ?? options.step.failurePolicy.action,
					failure_reason: options.failureReason ?? null,
					child_workflow_id: options.childWorkflowId ?? result?.workflowId ?? null,
					child_task_id: options.childTaskId ?? null,
					idempotency_key: options.idempotencyKey ?? result?.idempotencyKey ?? null,
					updated_at: timestamp,
					completed_at: nextStatus === 'completed' ? timestamp : null,
					metadata: toJson(nextMetadata),
				})
				.where(eq(stepRuns.id, existing.id))
			const updated = await this.getLatestStepRun(options.workflowRunId, options.step.id)
			return updated ?? existing
		}

		const attempt = (existing?.attempt ?? 0) + 1
		const row: StepRunRecord = {
			id: buildStepRunId(options.workflowRunId, options.step.id, attempt),
			workflow_run_id: options.workflowRunId,
			task_id: options.task.id,
			step_id: options.step.id,
			attempt,
			status: nextStatus,
			executor_kind: options.step.executor?.kind ?? null,
			executor_ref: resolveExecutorRef(options.step) ?? null,
			model_policy: options.step.modelPolicy ?? null,
			validation_mode: options.step.validation.mode,
			input_snapshot: toJson(options.inputSnapshot ?? { context: options.task.context }),
			output_snapshot: toJson(options.outputSnapshot ?? {}),
			validation_snapshot: toJson(options.validationSnapshot ?? {}),
			failure_action: result?.failureAction ?? options.step.failurePolicy.action,
			failure_reason: options.failureReason ?? null,
			child_workflow_id: options.childWorkflowId ?? result?.workflowId ?? null,
			child_task_id: options.childTaskId ?? null,
			idempotency_key: options.idempotencyKey ?? result?.idempotencyKey ?? null,
			created_at: timestamp,
			updated_at: timestamp,
			started_at: timestamp,
			completed_at: nextStatus === 'completed' ? timestamp : null,
			archived_at: null,
			metadata: toJson(nextMetadata),
		}

		await this.db.insert(stepRuns).values(row)
		return row
	}

	async updateStepRun(stepRunId: string, updates: UpdateStepRunOptions): Promise<void> {
		const rows = await this.db.select().from(stepRuns).where(eq(stepRuns.id, stepRunId)).limit(1)
		const existing = rows[0]
		if (!existing) return

		await this.db
			.update(stepRuns)
			.set({
				status: updates.status ?? (existing.status as StepRunStatus),
				output_snapshot: updates.outputSnapshot
					? toJson(updates.outputSnapshot)
					: existing.output_snapshot,
				validation_snapshot: updates.validationSnapshot
					? toJson(updates.validationSnapshot)
					: existing.validation_snapshot,
				failure_reason: updates.failureReason ?? existing.failure_reason,
				child_task_id: updates.childTaskId ?? existing.child_task_id,
				child_workflow_id: updates.childWorkflowId ?? existing.child_workflow_id,
				updated_at: nowIso(),
				completed_at:
					updates.completedAt === undefined ? existing.completed_at : updates.completedAt,
				archived_at: updates.archivedAt === undefined ? existing.archived_at : updates.archivedAt,
				metadata: updates.metadata
					? toJson({
							...safeParseJson(existing.metadata, {}),
							...updates.metadata,
						})
					: existing.metadata,
			})
			.where(eq(stepRuns.id, stepRunId))
	}

	async updateWorkflowRun(workflowRunId: string, updates: UpdateWorkflowRunOptions): Promise<void> {
		const rows = await this.db
			.select()
			.from(workflowRuns)
			.where(eq(workflowRuns.id, workflowRunId))
			.limit(1)
		const existing = rows[0]
		if (!existing) return

		await this.db
			.update(workflowRuns)
			.set({
				status: updates.status ?? (existing.status as WorkflowRunStatus),
				current_step_id:
					updates.currentStepId === undefined ? existing.current_step_id : updates.currentStepId,
				last_event: updates.lastEvent === undefined ? existing.last_event : updates.lastEvent,
				updated_at: nowIso(),
				completed_at:
					updates.completedAt === undefined ? existing.completed_at : updates.completedAt,
				archived_at: updates.archivedAt === undefined ? existing.archived_at : updates.archivedAt,
				metadata: updates.metadata
					? toJson({
							...safeParseJson(existing.metadata, {}),
							...updates.metadata,
						})
					: existing.metadata,
			})
			.where(eq(workflowRuns.id, workflowRunId))
	}

	async archiveWorkflowRunByTaskId(
		taskId: string,
		reason: string,
		metadata: Record<string, unknown> = {},
	): Promise<WorkflowRunRecord | undefined> {
		const run = await this.getWorkflowRunByTaskId(taskId)
		if (!run) return undefined

		const archivedAt = run.archived_at ?? nowIso()
		await this.updateWorkflowRun(run.id, {
			lastEvent: 'workflow_archived',
			archivedAt,
			metadata: {
				archive_reason: reason,
				...metadata,
			},
		})

		await this.db
			.update(stepRuns)
			.set({
				archived_at: archivedAt,
				updated_at: nowIso(),
			})
			.where(eq(stepRuns.workflow_run_id, run.id))

		return this.getWorkflowRunByTaskId(taskId)
	}

	async recordEvaluation(
		task: Task,
		workflow: CompiledWorkflow,
		step: CompiledWorkflowStep,
		result: WorkflowTransitionResult,
		metadata: Record<string, unknown> = {},
	): Promise<{ workflowRun: WorkflowRunRecord; stepRun: StepRunRecord }> {
		const workflowRun = await this.ensureWorkflowRun({
			task,
			workflow,
			triggerSource: 'task_change',
			status: deriveWorkflowRunStatus(result),
			currentStepId: step.id,
			lastEvent: result.action,
			metadata,
		})

		const stepRun = await this.ensureStepRun({
			workflowRunId: workflowRun.id,
			task,
			step,
			status: deriveStepRunStatus(result),
			result,
			inputSnapshot: {
				taskContext: task.context,
				nextStep: result.nextStep,
			},
			validationSnapshot: {
				mode: result.validationMode ?? step.validation.mode,
				failureAction: result.failureAction ?? step.failurePolicy.action,
			},
			metadata,
		})

		return { workflowRun, stepRun }
	}

	async recordAdvance(
		task: Task,
		workflow: CompiledWorkflow,
		step: CompiledWorkflowStep,
		result: WorkflowTransitionResult,
	): Promise<{ workflowRun: WorkflowRunRecord; stepRun?: StepRunRecord }> {
		const workflowRun = await this.ensureWorkflowRun({
			task,
			workflow,
			triggerSource: 'task_change',
			status: result.action === 'complete' ? 'completed' : 'active',
			currentStepId: result.nextStep ?? step.id,
			lastEvent: result.action === 'complete' ? 'workflow_completed' : 'workflow_advanced',
		})

		const currentStepRun = await this.getLatestStepRun(workflowRun.id, step.id)
		if (currentStepRun) {
			await this.updateStepRun(currentStepRun.id, {
				status: 'completed',
				completedAt: nowIso(),
				validationSnapshot: {
					transition: result.action,
					nextStep: result.nextStep,
				},
			})
		}

		return { workflowRun, stepRun: currentStepRun }
	}
}

export const workflowRuntimeStoreFactory = container.registerAsync(
	'workflowRuntimeStore',
	async (c) => {
		const { db } = await c.resolveAsync([dbFactory])
		return new WorkflowRuntimeStore(db.db)
	},
)
