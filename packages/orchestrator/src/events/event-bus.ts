export type AutopilotEvent =
	| { type: 'task_changed'; taskId: string; status: string; assignedTo?: string }
	| { type: 'message'; channel: string; from: string; content: string }
	| { type: 'activity'; agent: string; toolName: string; summary: string }
	| { type: 'pin_changed'; pinId: string; action: 'created' | 'removed' }
	| { type: 'agent_session'; agentId: string; status: 'started' | 'ended'; sessionId: string }
	| { type: 'workflow_advanced'; taskId: string; from: string; to: string }

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
				console.error('[event-bus] listener error:', err)
			}
		}
	}

	get listenerCount(): number {
		return this.listeners.size
	}
}

export const eventBus = new EventBus()
