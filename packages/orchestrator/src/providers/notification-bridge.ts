/**
 * Notification bridge — connects orchestrator events to outbound providers.
 *
 * Handles two delivery paths:
 * 1. Generic notification_channel delivery (event-filter matched)
 * 2. Bound conversation_channel delivery (task-scoped via conversation bindings)
 *
 * No retry system yet. Failures are logged, not queued.
 */
import type { AutopilotEvent } from '../events/event-bus'
import type { EventBus } from '../events/event-bus'
import type { Provider, NotificationPayload, NotificationAction, HandlerResult } from '@questpie/autopilot-spec'
import type { AuthoredConfig } from '../services/workflow-engine'
import type { RunService } from '../services/runs'
import type { TaskService } from '../services/tasks'
import type { ArtifactService } from '../services/artifacts'
import type { ConversationBindingService } from '../services/conversation-bindings'
import type { SessionService } from '../services/sessions'
import type { SecretService } from '../services/secrets'
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

		// 2. Bound conversation_channel delivery (task-scoped outbound)
		const taskBindings = payload.task_id
			? await this.conversationBindingService.listForTask(payload.task_id)
			: []
		if (payload.task_id) {
			await this.deliverToBoundConversations(payload, event, runtimeConfig, taskBindings)
		}

		// 3. Default-chat delivery for conversation_channel providers.
		// Only for task-scoped events with no explicit binding for that provider;
		// query responses are delivered by QueryResponseBridge.
		if (payload && payload.task_id) {
			for (const provider of this.authoredConfig.providers.values()) {
				if (provider.kind !== 'conversation_channel') continue
				if (!provider.capabilities.some((c) => c.op === 'notify.send')) continue
				if (!this.matchesEventFilters(provider, event)) continue
				if (taskBindings.some((binding) => binding.provider_id === provider.id && binding.mode === 'task_thread')) continue

				const defaultChatId = provider.config.default_chat_id
				if (typeof defaultChatId !== 'string' || !defaultChatId) continue

				// Send notification to default chat
				const chatPayload: NotificationPayload = {
					...payload,
					conversation_id: defaultChatId,
				}
				const sendResult = await this.sendToProvider(provider, chatPayload, runtimeConfig)

				// Store system message only if send succeeded
				if (sendResult?.ok && this.sessionService && this.sessionMessageService) {
					const chatSession = await this.sessionService.findOrCreate({
						provider_id: provider.id,
						external_conversation_id: defaultChatId,
						mode: 'query',
					})
					await this.sessionMessageService.create({
						session_id: chatSession.id,
						role: 'system',
						content: `[${payload.event_type}] ${payload.title}: ${payload.summary}`.slice(0, 2000),
						metadata: JSON.stringify({
							task_id: payload.task_id,
							run_id: payload.run_id,
							notification_type: payload.event_type,
						}),
					})
				}
			}
		}
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
	 * For task-scoped events, look up conversation bindings and deliver
	 * to bound conversation_channel providers with conversation context.
	 */
	private async deliverToBoundConversations(
		payload: NotificationPayload,
		event: AutopilotEvent,
		runtimeConfig: HandlerRuntimeConfig,
		bindings?: Awaited<ReturnType<ConversationBindingService['listForTask']>>,
	): Promise<void> {
		const targetBindings = bindings ?? await this.conversationBindingService.listForTask(payload.task_id!)
		for (const binding of targetBindings) {
			// Only task_thread bindings receive task-scoped outbound updates
			if (binding.mode !== 'task_thread') continue

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

			const sendResult = await this.sendToProvider(provider, boundPayload, runtimeConfig)

			// Create task_thread session keyed to the real outbound message identity.
			// The handler's external_id (e.g. Telegram message_id) is the thread anchor —
			// inbound callbacks/replies will carry this as thread_id, so the session must
			// match it. Without this, a chat-level session would claim the entire chat as
			// task_thread, breaking the general-chat = query-first invariant.
			if (this.sessionService && payload.task_id) {
				const threadId = sendResult?.external_id || (binding.external_thread_id ?? undefined)
				if (!threadId) {
					console.debug(`[notification-bridge] skipping task_thread session for binding ${binding.id}: no thread_id available`)
					continue
				}
				const taskSession = await this.sessionService.findOrCreate({
					provider_id: binding.provider_id,
					external_conversation_id: binding.external_conversation_id,
					external_thread_id: threadId,
					mode: 'task_thread',
					task_id: payload.task_id,
				}).catch((err) => {
					console.warn(`[notification-bridge] session creation failed for binding ${binding.id}:`, err instanceof Error ? err.message : String(err))
					return undefined
				})

				// Store system notification as session message
				if (this.sessionMessageService && taskSession) {
					await this.sessionMessageService.create({
						session_id: taskSession.id,
						role: 'system',
						content: `[${payload.event_type}] ${payload.title}: ${payload.summary}`.slice(0, 2000),
						metadata: JSON.stringify({
							task_id: payload.task_id,
							run_id: payload.run_id,
							notification_type: payload.event_type,
						}),
					})
				}
			}
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
				const actions = task ? this.resolveNotificationActions(task) : undefined

				return {
					orchestrator_url: baseUrl,
					event_type: 'task_blocked',
					severity: 'warning',
					title: `Task needs attention: ${task?.title ?? event.taskId}`,
					summary: task?.title ?? `Task ${event.taskId} is ${event.status}`,
					task_id: event.taskId,
					task_url: baseUrl ? `${baseUrl}/api/tasks/${event.taskId}` : undefined,
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
		const artifacts = await this.artifactService.listForRun(runId)
		const preview = artifacts.find((a) => a.kind === 'preview_url')
		return preview?.ref_value ?? null
	}
}
