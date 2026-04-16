/**
 * Notification bridge — connects orchestrator events to outbound providers.
 *
 * Delivers to generic notification_channel providers (event-filter matched).
 * Task-scoped conversation delivery is owned by TaskProgressBridge.
 * Query response delivery is owned by QueryResponseBridge.
 *
 * No retry system yet. Failures are logged, not queued.
 */
import type { AutopilotEvent, EventBus } from '../events/event-bus'
import type { Provider, NotificationPayload, NotificationAction, HandlerResult } from '@questpie/autopilot-spec'
import type { AuthoredConfig } from '../services/workflow-engine'
import type { RunService } from '../services/runs'
import type { TaskService } from '../services/tasks'
import type { ArtifactService } from '../services/artifacts'
import type { ConversationBindingService } from '../services/conversation-bindings'
import type { SecretService } from '../services/secrets'
import type { SessionService } from '../services/sessions'
import type { SessionMessageService } from '../services/session-messages'
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
		private artifactService: ArtifactService,
		private conversationBindingService: ConversationBindingService,
		private config: NotificationBridgeConfig,
		private secretService?: SecretService,
		private sessionService?: SessionService,
		private sessionMessageService?: SessionMessageService,
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
		const payload = await this.buildPayload(event)
		if (!payload) return

		const runtimeConfig: HandlerRuntimeConfig = { companyRoot: this.config.companyRoot }

		// 1. Generic notification_channel delivery (existing behavior)
		const notifProviders = this.getMatchingProviders(event, 'notification_channel')
		for (const provider of notifProviders) {
			await this.sendToProvider(provider, payload, runtimeConfig)
		}

		// Task-scoped conversation delivery (bound + default-chat) is owned by TaskProgressBridge.
		// Query response delivery is owned by QueryResponseBridge.
	}

	private async sendToProvider(
		provider: Provider,
		payload: NotificationPayload,
		runtimeConfig: HandlerRuntimeConfig,
	): Promise<HandlerResult | undefined> {
		const hasNotifySend = provider.capabilities.some((c) => c.op === 'notify.send')
		if (!hasNotifySend) return undefined

		try {
			const result = await invokeProvider(provider, 'notify.send', payload, runtimeConfig, this.secretService)
			if (!result.ok) {
				console.warn(`[notification-bridge] provider ${provider.id} failed: ${result.error}`)
			}
			return result
		} catch (err) {
			console.error(
				`[notification-bridge] provider ${provider.id} error:`,
				err instanceof Error ? err.message : String(err),
			)
			return undefined
		}
	}

	/**
	 * Find providers of a given kind whose event filters match this event.
	 */
	private getMatchingProviders(event: AutopilotEvent, kind: string): Provider[] {
		const result: Provider[] = []

		for (const provider of this.authoredConfig.providers.values()) {
			if (provider.kind !== kind) continue
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

	/** Truncate summary for safe chat delivery. Aggressive when a detail URL exists. */
	private truncateSummary(summary: string, hasDetailUrl: boolean): string {
		const AGGRESSIVE_LIMIT = 500
		const SAFE_LIMIT = 3500

		if (hasDetailUrl && summary.length > AGGRESSIVE_LIMIT) {
			return summary.slice(0, AGGRESSIVE_LIMIT) + '...\n\nSee task/preview for full details.'
		}
		if (summary.length > SAFE_LIMIT) {
			return summary.slice(0, SAFE_LIMIT) + '...'
		}
		return summary
	}

	private async buildPayload(event: AutopilotEvent): Promise<NotificationPayload | null> {
		const baseUrl = this.config.orchestratorUrl

		switch (event.type) {
			case 'run_completed': {
				const run = await this.runService.get(event.runId)
				const failed = event.status === 'failed'

				// Look up preview_url artifact for this run
				const previewUrl = await this.findPreviewUrl(event.runId)

				const rawSummary = run?.summary ?? `Run ${event.runId} ${event.status}`
				const taskUrl = baseUrl && run?.task_id ? `${baseUrl}/api/tasks/${run.task_id}` : undefined
				const hasDetailUrl = !!(previewUrl || taskUrl)

				return {
					orchestrator_url: baseUrl,
					event_type: 'run_completed',
					severity: failed ? 'error' : 'info',
					title: failed ? `Run failed: ${event.runId}` : `Run completed: ${event.runId}`,
					summary: this.truncateSummary(rawSummary, hasDetailUrl),
					run_id: event.runId,
					run_url: baseUrl ? `${baseUrl}/api/runs/${event.runId}` : undefined,
					task_id: run?.task_id ?? undefined,
					task_url: taskUrl,
					agent_id: run?.agent_id ?? undefined,
					preview_url: previewUrl ?? undefined,
				}
			}

			case 'task_changed': {
				if (event.status !== 'blocked' && event.status !== 'needs_approval') return null

				const task = await this.taskService.get(event.taskId)
				const actions = task ? this.resolveNotificationActions(task) : undefined
				const taskUrl = baseUrl ? `${baseUrl}/api/tasks/${event.taskId}` : undefined

				const rawSummary = task?.title ?? `Task ${event.taskId} is ${event.status}`

				return {
					orchestrator_url: baseUrl,
					event_type: 'task_blocked',
					severity: 'warning',
					title: `Task needs attention: ${task?.title ?? event.taskId}`,
					summary: this.truncateSummary(rawSummary, !!taskUrl),
					task_id: event.taskId,
					task_url: taskUrl,
					actions,
				}
			}

			default:
				return null
		}
	}

	/**
	 * Resolve notification actions from real workflow step truth.
	 * Only includes actions when the task is on a human_approval step.
	 */
	private resolveNotificationActions(
		task: { workflow_id?: string | null; workflow_step?: string | null },
	): NotificationAction[] | undefined {
		if (!task.workflow_id || !task.workflow_step) return undefined

		const workflow = this.authoredConfig.workflows.get(task.workflow_id)
		if (!workflow) return undefined

		const step = workflow.steps.find((s) => s.id === task.workflow_step)
		if (!step || step.type !== 'human_approval') return undefined

		const actions: NotificationAction[] = [
			{ action: 'task.approve', label: 'Approve', style: 'primary', requires_message: false },
			{ action: 'task.reject', label: 'Reject', style: 'danger', requires_message: false },
			{ action: 'task.reply', label: 'Reply', style: 'secondary', requires_message: true },
		]

		return actions
	}

	private async findPreviewUrl(runId: string): Promise<string | null> {
		return this.artifactService.resolvePreviewUrl(runId, this.config.orchestratorUrl)
	}
}
