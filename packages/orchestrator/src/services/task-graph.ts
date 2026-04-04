import { createHash, randomBytes } from 'node:crypto'
import type { TaskService, TaskRow } from './tasks'
import type { TaskRelationService, TaskRelationRow } from './task-relations'
import type { WorkflowEngine } from './workflow-engine'
import { eventBus } from '../events/event-bus'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ChildCandidate {
	title: string
	description?: string
	type: string
	priority?: string
	assigned_to?: string
	workflow_id?: string
	context?: string
	metadata?: string
	dedupe_key?: string
}

export interface SpawnChildrenInput {
	parent_task_id: string
	children: ChildCandidate[]
	relation_type?: string
	created_by: string
	origin_run_id?: string
}

export interface SpawnedChild {
	task: TaskRow
	relation: TaskRelationRow
	created: boolean
}

export interface SpawnChildrenResult {
	parent_task_id: string
	children: SpawnedChild[]
	created_count: number
	matched_count: number
}

export interface ChildRollup {
	total: number
	active: number
	blocked: number
	done: number
	failed: number
	backlog: number
}

// ─── Service ────────────────────────────────────────────────────────────────

export class TaskGraphService {
	constructor(
		private taskService: TaskService,
		private taskRelationService: TaskRelationService,
		private workflowEngine: WorkflowEngine,
	) {}

	/**
	 * Idempotent child task materialization.
	 *
	 * When dedupe_key is provided:
	 * 1. Child task ID is deterministic: SHA-256(parent_task_id + dedupe_key), prefixed with "task-"
	 * 2. DB unique index (source_task_id, relation_type, dedupe_key) prevents duplicate relations
	 * 3. If the child task already exists by ID, no new task is created
	 *
	 * When dedupe_key is absent, a new child is always created.
	 */
	async spawnChildren(input: SpawnChildrenInput): Promise<SpawnChildrenResult> {
		const { parent_task_id, children, created_by, origin_run_id } = input
		const relationType = input.relation_type ?? 'decomposes_to'

		const parent = await this.taskService.get(parent_task_id)
		if (!parent) {
			throw new Error(`Parent task "${parent_task_id}" not found`)
		}

		const results: SpawnedChild[] = []

		for (const candidate of children) {
			// Fast path: DB-enforced dedup via dedupe_key column
			if (candidate.dedupe_key) {
				const existingRelation = await this.taskRelationService.findByDedupeKey(
					parent_task_id, relationType, candidate.dedupe_key,
				)
				if (existingRelation) {
					const existingTask = await this.taskService.get(existingRelation.target_task_id)
					if (existingTask) {
						results.push({ task: existingTask, relation: existingRelation, created: false })
						continue
					}
				}
			}

			// Deterministic task ID when dedupe_key is present, random otherwise
			const taskId = candidate.dedupe_key
				? deriveChildTaskId(parent_task_id, candidate.dedupe_key)
				: `task-${Date.now()}-${randomHex(6)}`

			// Check if task already exists (covers race between relation lookup and creation)
			const existingTask = candidate.dedupe_key ? await this.taskService.get(taskId) : undefined
			if (existingTask) {
				// Task exists but relation was missing — ensure relation exists
				const relation = await this.ensureRelation({
					taskId, parent_task_id, relationType, dedupeKey: candidate.dedupe_key,
					origin_run_id, created_by,
				})
				if (relation) {
					results.push({ task: existingTask, relation, created: false })
				}
				continue
			}

			// Build child metadata: merge caller-provided metadata with graph context
			const childMeta = {
				...safeParseMeta(candidate.metadata),
				parent_task_id,
				...(candidate.dedupe_key ? { parent_dedupe_key: candidate.dedupe_key } : {}),
			}

			const materialized = await this.workflowEngine.materializeTask({
				title: candidate.title,
				description: candidate.description,
				type: candidate.type,
				priority: candidate.priority,
				assigned_to: candidate.assigned_to,
				workflow_id: candidate.workflow_id,
				context: candidate.context,
				metadata: JSON.stringify(childMeta),
				created_by,
				id: taskId,
			})

			if (!materialized) continue

			const relation = await this.ensureRelation({
				taskId: materialized.task.id, parent_task_id, relationType,
				dedupeKey: candidate.dedupe_key, origin_run_id, created_by,
			})

			if (!relation) continue

			results.push({ task: materialized.task, relation, created: true })
			eventBus.emit({
				type: 'task_relation_created',
				sourceTaskId: parent_task_id,
				targetTaskId: materialized.task.id,
				relationType,
			})
		}

		const createdCount = results.filter((r) => r.created).length
		return {
			parent_task_id,
			children: results,
			created_count: createdCount,
			matched_count: results.length - createdCount,
		}
	}

	/**
	 * List child tasks for a parent (via decomposes_to relations by default).
	 */
	async listChildren(parentTaskId: string, relationType?: string): Promise<TaskRow[]> {
		const relations = await this.taskRelationService.listBySource(parentTaskId, relationType ?? 'decomposes_to')
		const tasks: TaskRow[] = []
		for (const rel of relations) {
			const task = await this.taskService.get(rel.target_task_id)
			if (task) tasks.push(task)
		}
		return tasks
	}

	/**
	 * List parent tasks for a child (via decomposes_to relations by default).
	 */
	async listParents(childTaskId: string, relationType?: string): Promise<TaskRow[]> {
		const relations = await this.taskRelationService.listByTarget(childTaskId, relationType ?? 'decomposes_to')
		const tasks: TaskRow[] = []
		for (const rel of relations) {
			const task = await this.taskService.get(rel.source_task_id)
			if (task) tasks.push(task)
		}
		return tasks
	}

	/**
	 * Derive a rollup of child task statuses.
	 * Computed on the fly — no materialized persistence.
	 */
	async childRollup(parentTaskId: string, relationType?: string): Promise<ChildRollup> {
		const children = await this.listChildren(parentTaskId, relationType)
		const counts = { active: 0, blocked: 0, done: 0, failed: 0, backlog: 0 }

		for (const child of children) {
			const key = child.status as keyof typeof counts
			if (key in counts) {
				counts[key]++
			} else {
				counts.backlog++
			}
		}

		return { total: children.length, ...counts }
	}

	// ─── Private ────────────────────────────────────────────────────────

	private async ensureRelation(input: {
		taskId: string
		parent_task_id: string
		relationType: string
		dedupeKey?: string
		origin_run_id?: string
		created_by: string
	}): Promise<TaskRelationRow | undefined> {
		const relationId = input.dedupeKey
			? deriveRelationId(input.parent_task_id, input.taskId, input.relationType)
			: `rel-${Date.now()}-${randomHex(6)}`

		return this.taskRelationService.create({
			id: relationId,
			source_task_id: input.parent_task_id,
			target_task_id: input.taskId,
			relation_type: input.relationType,
			dedupe_key: input.dedupeKey,
			origin_run_id: input.origin_run_id,
			created_by: input.created_by,
		})
	}
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Deterministic child task ID: SHA-256(parent_id \0 dedupe_key), prefixed. */
function deriveChildTaskId(parentTaskId: string, dedupeKey: string): string {
	const hash = createHash('sha256').update(`${parentTaskId}\0${dedupeKey}`).digest('hex')
	return `task-${hash.slice(0, 16)}`
}

/** Deterministic relation ID: SHA-256(source \0 target \0 type), prefixed. */
function deriveRelationId(sourceTaskId: string, targetTaskId: string, relationType: string): string {
	const hash = createHash('sha256').update(`${sourceTaskId}\0${targetTaskId}\0${relationType}`).digest('hex')
	return `rel-${hash.slice(0, 16)}`
}

function randomHex(bytes: number): string {
	return randomBytes(bytes).toString('hex')
}

function safeParseMeta(raw: string | null | undefined): Record<string, unknown> {
	if (!raw) return {}
	try {
		return JSON.parse(raw)
	} catch {
		return {}
	}
}
