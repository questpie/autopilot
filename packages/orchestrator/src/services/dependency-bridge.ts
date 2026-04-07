/**
 * DependencyBridge — event-driven dependency wake-up.
 *
 * Subscribes to task_changed events. When a task completes or fails,
 * looks up tasks that depend on it and re-evaluates whether they can proceed.
 */
import type { EventBus } from '../events/event-bus'
import type { TaskRelationService } from './task-relations'
import type { TaskService } from './tasks'
import type { WorkflowEngine } from './workflow-engine'

export class DependencyBridge {
	private unsubscribe: (() => void) | null = null

	constructor(
		private eventBus: EventBus,
		private taskRelationService: TaskRelationService,
		private taskService: TaskService,
		private workflowEngine: WorkflowEngine,
	) {}

	start(): void {
		if (this.unsubscribe) return
		this.unsubscribe = this.eventBus.subscribe((event) => {
			if (event.type === 'task_changed' && (event.status === 'done' || event.status === 'failed')) {
				this.handleDependencyChange(event.taskId).catch((err) => {
					console.error('[dependency-bridge] error:', err instanceof Error ? err.message : String(err))
				})
			}
		})
		console.log('[dependency-bridge] started')
	}

	stop(): void {
		if (this.unsubscribe) {
			this.unsubscribe()
			this.unsubscribe = null
		}
	}

	/**
	 * Check the dependency status for a task.
	 * Returns 'met' if all deps are done, 'failed' if any dep failed, 'pending' otherwise.
	 */
	async checkDependencies(taskId: string): Promise<'met' | 'failed' | 'pending'> {
		const deps = await this.taskRelationService.listDependencies(taskId)
		if (deps.length === 0) return 'met'

		let allDone = true
		for (const dep of deps) {
			const depTask = await this.taskService.get(dep.target_task_id)
			if (!depTask) {
				// Dependency task was deleted — treat as failed to prevent
				// silent progression with missing prerequisites.
				console.warn(`[dependency-bridge] dependency task ${dep.target_task_id} not found (deleted?) — treating as failed`)
				return 'failed'
			}
			if (depTask.status === 'failed') return 'failed'
			if (depTask.status !== 'done') allDone = false
		}

		return allDone ? 'met' : 'pending'
	}

	private async handleDependencyChange(completedTaskId: string): Promise<void> {
		// Find tasks that depend on the completed task
		const dependents = await this.taskRelationService.listDependents(completedTaskId)
		if (dependents.length === 0) return

		const seen = new Set<string>()
		for (const rel of dependents) {
			const dependentTaskId = rel.source_task_id
			if (seen.has(dependentTaskId)) continue
			seen.add(dependentTaskId)

			const task = await this.taskService.get(dependentTaskId)
			if (!task) continue

			// Only re-evaluate blocked tasks
			if (task.status !== 'blocked') continue

			const depStatus = await this.checkDependencies(dependentTaskId)
			if (depStatus === 'met') {
				console.log(`[dependency-bridge] task ${dependentTaskId} dependencies met — triggering intake`)
				await this.workflowEngine.intake(dependentTaskId)
			} else if (depStatus === 'failed') {
				console.log(`[dependency-bridge] task ${dependentTaskId} dependency failed — failing task`)
				await this.taskService.update(dependentTaskId, { status: 'failed' })
				this.eventBus.emit({ type: 'task_changed', taskId: dependentTaskId, status: 'failed' })
			}
		}
	}
}
