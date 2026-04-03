/**
 * Notification bridge — connects orchestrator events to notification_channel providers.
 *
 * Subscribes to the event bus, matches actionable events against provider
 * event filters, builds a normalized NotificationPayload, and invokes
 * the provider handler via the handler runtime.
 *
 * No retry system yet. Failures are logged, not queued.
 */
import type { AutopilotEvent } from '../events/event-bus'
import type { EventBus } from '../events/event-bus'
import type { Provider, NotificationPayload } from '@questpie/autopilot-spec'
import type { AuthoredConfig } from '../services/workflow-engine'
import type { RunService } from '../services/runs'
import type { TaskService } from '../services/tasks'
import { invokeProvider, type HandlerRuntimeConfig } from './handler-runtime'

export interface NotificationBridgeConfig {
	companyRoot: string
	/** Orchestrator base URL for building links (e.g. "http://localhost:7778"). */
	orchestratorUrl?: string
}

export class NotificationBridge {
	private unsubscribe: (() => void) | null = null

	constructor(
		private eventBus: EventBus,
		private authoredConfig: AuthoredConfig,
		private runService: RunService,
		private taskService: TaskService,
		private config: NotificationBridgeConfig,
	) {}

	start(): void {
		if (this.unsubscribe) return
		this.unsubscribe = this.eventBus.subscribe((event) => {
			this.handleEvent(event).catch((err) => {
				console.error('[notification-bridge] unhandled error:', err instanceof Error ? err.message : String(err))
			})
		})
		console.log('[notification-bridge] started')
	}

	stop(): void {
		if (this.unsubscribe) {
			this.unsubscribe()
			this.unsubscribe = null
		}
	}

	private async handleEvent(event: AutopilotEvent): Promise<void> {
		const providers = this.getMatchingProviders(event)
		if (providers.length === 0) return

		const payload = await this.buildPayload(event)
		if (!payload) return

		const runtimeConfig: HandlerRuntimeConfig = { companyRoot: this.config.companyRoot }

		for (const provider of providers) {
			const hasNotifySend = provider.capabilities.some((c) => c.op === 'notify.send')
			if (!hasNotifySend) continue

			try {
				const result = await invokeProvider(provider, 'notify.send', payload, runtimeConfig)
				if (!result.ok) {
					console.warn(`[notification-bridge] provider ${provider.id} failed: ${result.error}`)
				}
			} catch (err) {
				console.error(
					`[notification-bridge] provider ${provider.id} error:`,
					err instanceof Error ? err.message : String(err),
				)
			}
		}
	}

	/**
	 * Find notification_channel providers whose event filters match this event.
	 */
	private getMatchingProviders(event: AutopilotEvent): Provider[] {
		const result: Provider[] = []

		for (const provider of this.authoredConfig.providers.values()) {
			if (provider.kind !== 'notification_channel') continue
			if (!this.matchesEventFilters(provider, event)) continue
			result.push(provider)
		}

		return result
	}

	/**
	 * Check if an event matches any of the provider's event filters.
	 * If no filters are defined, the provider matches all events.
	 */
	private matchesEventFilters(provider: Provider, event: AutopilotEvent): boolean {
		if (provider.events.length === 0) return true

		for (const filter of provider.events) {
			if (!filter.types.includes(event.type)) continue

			// If statuses filter is set, check it
			if (filter.statuses && filter.statuses.length > 0) {
				const eventStatus = 'status' in event ? event.status : undefined
				if (eventStatus && !filter.statuses.includes(eventStatus)) continue
			}

			return true
		}

		return false
	}

	/**
	 * Build a normalized notification payload from an orchestrator event.
	 * Returns null for non-actionable events.
	 */
	private async buildPayload(event: AutopilotEvent): Promise<NotificationPayload | null> {
		const base = {
			orchestrator_url: this.config.orchestratorUrl,
		}

		switch (event.type) {
			case 'run_completed': {
				const run = await this.runService.get(event.runId)
				const failed = event.status === 'failed'

				return {
					...base,
					event_type: 'run_completed',
					severity: failed ? 'error' : 'info',
					title: failed ? `Run failed: ${event.runId}` : `Run completed: ${event.runId}`,
					summary: run?.summary ?? `Run ${event.runId} ${event.status}`,
					run_id: event.runId,
					task_id: run?.task_id ?? undefined,
					agent_id: run?.agent_id ?? undefined,
				}
			}

			case 'task_changed': {
				// Only notify on blocked/approval-needed status
				if (event.status !== 'blocked' && event.status !== 'needs_approval') return null

				const task = await this.taskService.get(event.taskId)
				return {
					...base,
					event_type: 'task_blocked',
					severity: 'warning',
					title: `Task needs attention: ${task?.title ?? event.taskId}`,
					summary: task?.title ?? `Task ${event.taskId} is ${event.status}`,
					task_id: event.taskId,
				}
			}

			default:
				return null
		}
	}
}
