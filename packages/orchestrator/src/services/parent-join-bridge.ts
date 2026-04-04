/**
 * ParentJoinBridge — event-driven parent wake-up for wait_for_children steps.
 *
 * Subscribes to task_changed events. When a child task changes status,
 * looks up parent tasks via decomposes_to relations and re-evaluates
 * any parent currently blocked on a wait_for_children step.
 */
import type { EventBus } from '../events/event-bus'
import type { TaskRelationService } from './task-relations'
import type { WorkflowEngine } from './workflow-engine'

export class ParentJoinBridge {
	private unsubscribe: (() => void) | null = null

	constructor(
		private eventBus: EventBus,
		private taskRelationService: TaskRelationService,
		private workflowEngine: WorkflowEngine,
	) {}

	start(): void {
		if (this.unsubscribe) return
		this.unsubscribe = this.eventBus.subscribe((event) => {
			if (event.type === 'task_changed') {
				this.handleChildChange(event.taskId).catch((err) => {
					console.error('[parent-join-bridge] error:', err instanceof Error ? err.message : String(err))
				})
			}
		})
		console.log('[parent-join-bridge] started')
	}

	stop(): void {
		if (this.unsubscribe) {
			this.unsubscribe()
			this.unsubscribe = null
		}
	}

	private async handleChildChange(childTaskId: string): Promise<void> {
		// Find all parents across any relation type — reevaluateJoin reads the
		// step's join_relation_type to evaluate the correct rollup.
		const parentRelations = await this.taskRelationService.listByTarget(childTaskId)
		if (parentRelations.length === 0) return

		const seen = new Set<string>()
		for (const rel of parentRelations) {
			if (seen.has(rel.source_task_id)) continue
			seen.add(rel.source_task_id)
			await this.workflowEngine.reevaluateJoin(rel.source_task_id)
		}
	}
}
