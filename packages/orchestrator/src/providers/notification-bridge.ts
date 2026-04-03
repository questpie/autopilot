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
import type { ArtifactService } from '../services/artifacts'
import type { ConversationBindingService, ConversationBindingRow } from '../services/conversation-bindings'
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

		// 2. Bound conversation_channel delivery (new: task-scoped outbound)
		if (payload.task_id) {
			await this.deliverToBoundConversations(payload, event, runtimeConfig)
		}
	}

	private async sendToProvider(
		provider: Provider,
		payload: NotificationPayload,
		runtimeConfig: HandlerRuntimeConfig,
	): Promise<void> {
		const hasNotifySend = provider.capabilities.some((c) => c.op === 'notify.send')
		if (!hasNotifySend) return

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

	/**
	 * For task-scoped events, look up conversation bindings and deliver
	 * to bound conversation_channel providers with conversation context.
	 */
	private async deliverToBoundConversations(
		payload: NotificationPayload,
		event: AutopilotEvent,
		runtimeConfig: HandlerRuntimeConfig,
	): Promise<void> {
		const bindings = await this.conversationBindingService.listForTask(payload.task_id!)

		for (const binding of bindings) {
			const provider = this.authoredConfig.providers.get(binding.provider_id)
			if (!provider) continue
			if (provider.kind !== 'conversation_channel') continue
			if (!provider.capabilities.some((c) => c.op === 'notify.send')) continue
			if (!this.matchesEventFilters(provider, event)) continue

			// Enrich payload with conversation routing context
			const boundPayload: NotificationPayload = {
				...payload,
				conversation_id: binding.external_conversation_id,
				thread_id: binding.external_thread_id ?? undefined,
				binding_mode: binding.mode,
			}

			await this.sendToProvider(provider, boundPayload, runtimeConfig)
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

	/**
	 * Build a normalized notification payload from an orchestrator event.
	 * Returns null for non-actionable events.
	 */
	private async buildPayload(event: AutopilotEvent): Promise<NotificationPayload | null> {
		const baseUrl = this.config.orchestratorUrl

		switch (event.type) {
			case 'run_completed': {
				const run = await this.runService.get(event.runId)
				const failed = event.status === 'failed'

				// Look up preview_url artifact for this run
				const previewUrl = await this.findPreviewUrl(event.runId)

				return {
					orchestrator_url: baseUrl,
					event_type: 'run_completed',
					severity: failed ? 'error' : 'info',
					title: failed ? `Run failed: ${event.runId}` : `Run completed: ${event.runId}`,
					summary: run?.summary ?? `Run ${event.runId} ${event.status}`,
					run_id: event.runId,
					run_url: baseUrl ? `${baseUrl}/api/runs/${event.runId}` : undefined,
					task_id: run?.task_id ?? undefined,
					task_url: baseUrl && run?.task_id ? `${baseUrl}/api/tasks/${run.task_id}` : undefined,
					agent_id: run?.agent_id ?? undefined,
					preview_url: previewUrl ?? undefined,
				}
			}

			case 'task_changed': {
				if (event.status !== 'blocked' && event.status !== 'needs_approval') return null

				const task = await this.taskService.get(event.taskId)
				return {
					orchestrator_url: baseUrl,
					event_type: 'task_blocked',
					severity: 'warning',
					title: `Task needs attention: ${task?.title ?? event.taskId}`,
					summary: task?.title ?? `Task ${event.taskId} is ${event.status}`,
					task_id: event.taskId,
					task_url: baseUrl ? `${baseUrl}/api/tasks/${event.taskId}` : undefined,
				}
			}

			default:
				return null
		}
	}

	private async findPreviewUrl(runId: string): Promise<string | null> {
		const artifacts = await this.artifactService.listForRun(runId)
		const preview = artifacts.find((a) => a.kind === 'preview_url')
		return preview?.ref_value ?? null
	}
}
