import { logger } from '../logger'

export type AutopilotEvent =
	| { type: 'task_changed'; taskId: string; status: string; assignedTo?: string }
	| { type: 'message'; channel: string; from: string; content: string }
	| { type: 'activity'; agent: string; toolName: string; summary: string }
	| { type: 'pin_changed'; pinId: string; action: 'created' | 'removed' | 'updated' }
	| { type: 'agent_session'; agentId: string; status: 'started' | 'ended'; sessionId: string }
	| { type: 'agent_typing'; agentId: string; status: 'started' | 'stopped'; sessionId: string }
	| { type: 'user_typing'; channelId: string; userId: string; actorType: 'human' }
	| { type: 'workflow_advanced'; taskId: string; from: string; to: string }
	| { type: 'channel_created'; channelId: string; name: string }
	| { type: 'channel_deleted'; channelId: string }
	| { type: 'channel_member_changed'; channelId: string; actorId: string; action: 'added' | 'removed' }
	| { type: 'settings_changed' }
	| { type: 'file_locked'; path: string; lockedBy: string }
	| { type: 'file_unlocked'; path: string }
	| { type: 'knowledge_changed'; path: string; action: 'created' | 'updated' }
	| { type: 'artifact_changed'; artifactId: string; action: 'registered' | 'updated' }
	| { type: 'validation_error'; file: string; error: string }
	| { type: 'notification_new'; notificationId: string; userId: string; notificationType: string; priority: string; title: string; message: string; url?: string }

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
				logger.error('event-bus', 'listener error', { error: err instanceof Error ? err.message : String(err) })
			}
		}
	}

	get listenerCount(): number {
		return this.listeners.size
	}
}

export const eventBus = new EventBus()
