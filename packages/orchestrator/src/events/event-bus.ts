export type AutopilotEvent =
	| { type: 'task_changed'; taskId: string; status: string }
	| { type: 'run_started'; runId: string; agentId: string }
	| { type: 'run_event'; runId: string; eventType: string; summary: string }
	| { type: 'run_completed'; runId: string; status: string }
	| { type: 'worker_registered'; workerId: string }
	| { type: 'worker_offline'; workerId: string }
	| { type: 'message'; channelId: string; fromId: string }
	| { type: 'task_relation_created'; sourceTaskId: string; targetTaskId: string; relationType: string }
	| { type: 'settings_changed' }

export class EventBus {
	private listeners = new Set<(event: AutopilotEvent) => void>()

	subscribe(listener: (event: AutopilotEvent) => void): () => void {
		this.listeners.add(listener)
		return () => {
			this.listeners.delete(listener)
		}
	}

	emit(event: AutopilotEvent): void {
		for (const listener of this.listeners) {
			try {
				listener(event)
			} catch (err) {
				console.error('[event-bus] listener error:', err instanceof Error ? err.message : String(err))
			}
		}
	}

	get listenerCount(): number {
		return this.listeners.size
	}
}

export const eventBus = new EventBus()
