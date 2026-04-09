/**
 * Task progress bridge — maintains one editable progress message per task
 * for conversations.
 *
 * Delivery targets:
 * 1. Explicit task_thread bindings — bound conversation delivery
 * 2. Default-chat fallback — for tasks with no bindings, sends to each
 *    conversation_channel provider's default_chat_id
 *
 * Instead of sending a new Telegram/Slack message for every run_completed or
 * task_changed event, this bridge sends ONE message per task and edits it
 * in-place as the task progresses through its workflow.
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

type NormalizedStatus = 'working' | 'plan_ready' | 'waiting_for_review' | 'completed' | 'failed'

interface DeliveryTarget {
	providerId: string
	conversationId: string
	threadId?: string
	bindingId: string
	isDefaultChat: boolean
}

function computeNormalizedStatus(task: {
	status: string
	workflow_id?: string | null
	workflow_step?: string | null
}): NormalizedStatus {
	if (task.status === 'done') return 'completed'
	if (task.status === 'failed') return 'failed'
	if (task.status === 'blocked') return 'waiting_for_review'
	// active — could refine based on workflow step
	return 'working'
}

export class TaskProgressBridge {
	private unsubscribe: (() => void) | null = null

	/** taskId → bindingId → external message ID */
	private messageIdByTask = new Map<string, Map<string, string>>()
	/** taskId → bindingId → session message ID */
	private sessionMsgIdByTask = new Map<string, Map<string, string>>()
	/** Throttle progress updates per task — at most one every PROGRESS_THROTTLE_MS. */
	private lastProgressSent = new Map<string, number>()
	/** Serialize events per task to prevent race conditions. */
	private taskEventChains = new Map<string, Promise<void>>()

	private static readonly PROGRESS_THROTTLE_MS = 3_000
	/** Periodic cleanup timer to prevent memory leaks from orphaned tracking entries. */
	private cleanupTimer: ReturnType<typeof setInterval> | null = null
	/** Max age (ms) for tracking entries before they're considered stale. */
	private static readonly TRACKING_STALE_MS = 60 * 60 * 1000 // 1 hour

	constructor(
		private eventBus: EventBus,
		private authoredConfig: AuthoredConfig,
		private runService: RunService,
		private taskService: TaskService,
		private artifactService: ArtifactService,
		private conversationBindingService: ConversationBindingService,
		private config: { companyRoot: string; orchestratorUrl?: string },
		private secretService?: SecretService,
		private sessionService?: SessionService,
		private sessionMessageService?: SessionMessageService,
	) {}

	start(): void {
		if (this.unsubscribe) return
		this.unsubscribe = this.eventBus.subscribe((event) => {
			this.enqueueEvent(event)
		})
		// Periodic cleanup of stale tracking entries
		this.cleanupTimer = setInterval(() => {
			const staleThreshold = Date.now() - TaskProgressBridge.TRACKING_STALE_MS
			for (const [taskId, lastSent] of this.lastProgressSent) {
				if (lastSent < staleThreshold) {
					this.lastProgressSent.delete(taskId)
					this.messageIdByTask.delete(taskId)
					this.sessionMsgIdByTask.delete(taskId)
				}
			}
		}, 5 * 60 * 1000) // every 5 minutes
		this.cleanupTimer.unref()
		console.log('[task-progress-bridge] started')
	}

	stop(): void {
		if (this.unsubscribe) {
			this.unsubscribe()
			this.unsubscribe = null
		}
		if (this.cleanupTimer) {
			clearInterval(this.cleanupTimer)
			this.cleanupTimer = null
		}
		this.taskEventChains.clear()
	}

	private enqueueEvent(event: AutopilotEvent): void {
		const taskId = this.eventTaskId(event)
		if (!taskId) {
			// Events without a deterministic task ID need async resolution
			this.handleEvent(event).catch((err) => {
				console.error('[task-progress-bridge] unhandled error:', err instanceof Error ? err.message : String(err))
			})
			return
		}

		const previous = this.taskEventChains.get(taskId) ?? Promise.resolve()
		const next = previous
			.catch(() => {})
			.then(() => this.handleEvent(event))

		this.taskEventChains.set(taskId, next)
		next
			.catch((err) => {
				console.error('[task-progress-bridge] unhandled error:', err instanceof Error ? err.message : String(err))
			})
			.finally(() => {
				if (this.taskEventChains.get(taskId) === next) {
					this.taskEventChains.delete(taskId)
				}
			})
	}

	/**
	 * Extract a task ID synchronously when possible (task_changed).
	 * For run-based events we return undefined and resolve async in handleEvent.
	 */
	private eventTaskId(event: AutopilotEvent): string | undefined {
		if (event.type === 'task_changed') return event.taskId
		if (event.type === 'task_created') return event.taskId
		return undefined
	}

	/**
	 * Resolve delivery targets for a task.
	 * Returns task_thread bindings if they exist, otherwise synthetic
	 * default-chat targets for each conversation_channel provider.
	 */
	private async resolveDeliveryTargets(taskId: string): Promise<{
		targets: DeliveryTarget[]
		hasExplicitBindings: boolean
	}> {
		const bindings = await this.conversationBindingService.listForTask(taskId)
		const taskThreadBindings = bindings.filter((b) => b.mode === 'task_thread')

		if (taskThreadBindings.length > 0) {
			return {
				targets: taskThreadBindings.map((b) => ({
					providerId: b.provider_id,
					conversationId: b.external_conversation_id,
					threadId: b.external_thread_id ?? undefined,
					bindingId: b.id,
					isDefaultChat: false,
				})),
				hasExplicitBindings: true,
			}
		}

		// Fallback: default-chat for each conversation_channel provider
		const targets: DeliveryTarget[] = []

		for (const provider of this.authoredConfig.providers.values()) {
			if (provider.kind !== 'conversation_channel') continue
			if (!provider.capabilities.some((c) => c.op === 'notify.send')) continue
			const defaultChatId = provider.config.default_chat_id
			if (typeof defaultChatId !== 'string' || !defaultChatId) continue

			targets.push({
				providerId: provider.id,
				conversationId: defaultChatId,
				bindingId: `default:${provider.id}`,
				isDefaultChat: true,
			})
		}

		return { targets, hasExplicitBindings: false }
	}

	private async handleEvent(event: AutopilotEvent): Promise<void> {
		switch (event.type) {
			case 'run_event':
				await this.handleRunEvent(event)
				break
			case 'run_completed':
				await this.handleRunCompleted(event)
				break
			case 'task_changed':
				await this.handleTaskChanged(event)
				break
			case 'task_created':
				await this.handleTaskCreated(event)
				break
		}
	}

	// ── run_event: throttled progress updates ──────────────────────────────

	private async handleRunEvent(event: { type: 'run_event'; runId: string; eventType: string; summary: string }): Promise<void> {
		if (event.eventType !== 'started' && event.eventType !== 'progress' && event.eventType !== 'tool_use') return

		const run = await this.runService.get(event.runId)
		if (!run?.task_id) return

		const taskId = run.task_id
		const { targets } = await this.resolveDeliveryTargets(taskId)
		if (targets.length === 0) return

		// Throttle check
		const lastSent = this.lastProgressSent.get(taskId) ?? 0
		if (Date.now() - lastSent < TaskProgressBridge.PROGRESS_THROTTLE_MS) return

		const task = await this.taskService.get(taskId)
		if (!task) return

		const status = computeNormalizedStatus(task)
		const baseUrl = this.config.orchestratorUrl

		this.lastProgressSent.set(taskId, Date.now())

		for (const target of targets) {
			await this.sendOrEditProgress(target, task, status, {
				baseUrl,
				summary: event.summary.slice(0, 200) || '\u23f3',
			})
		}
	}

	// ── run_completed: immediate update with summary ───────────────────────

	private async handleRunCompleted(event: { type: 'run_completed'; runId: string; status: string }): Promise<void> {
		const run = await this.runService.get(event.runId)
		if (!run?.task_id) return

		const taskId = run.task_id
		const { targets } = await this.resolveDeliveryTargets(taskId)
		if (targets.length === 0) return

		const task = await this.taskService.get(taskId)
		if (!task) return

		const status = computeNormalizedStatus(task)
		const baseUrl = this.config.orchestratorUrl

		// Look up preview_url artifact
		let previewUrl: string | undefined
		const artifacts = await this.artifactService.listForRun(event.runId)
		const preview = artifacts.find((a) => a.kind === 'preview_url')
		if (preview) previewUrl = preview.ref_value

		const summary = event.status === 'failed'
			? (run.error ?? run.summary ?? 'Run failed.')
			: (run.summary ?? 'Run completed.')

		this.lastProgressSent.set(taskId, Date.now())

		for (const target of targets) {
			await this.sendOrEditProgress(target, task, status, {
				baseUrl,
				summary,
				previewUrl,
			})
		}
	}

	// ── task_changed: immediate status update ──────────────────────────────

	private async handleTaskChanged(event: { type: 'task_changed'; taskId: string; status: string }): Promise<void> {
		const taskId = event.taskId
		const { targets } = await this.resolveDeliveryTargets(taskId)
		if (targets.length === 0) return

		const task = await this.taskService.get(taskId)
		if (!task) return

		const status = computeNormalizedStatus(task)
		const baseUrl = this.config.orchestratorUrl

		this.lastProgressSent.set(taskId, Date.now())

		for (const target of targets) {
			await this.sendOrEditProgress(target, task, status, {
				baseUrl,
				summary: task.title ?? `Task ${taskId} is ${event.status}`,
			})
		}

		// Clean up tracking maps for terminal states
		if (status === 'completed' || status === 'failed') {
			this.messageIdByTask.delete(taskId)
			this.sessionMsgIdByTask.delete(taskId)
			this.lastProgressSent.delete(taskId)
		}
	}

	// ── task_created: initial card ────────────────────────────────────────

	private async handleTaskCreated(event: { type: 'task_created'; taskId: string; title: string }): Promise<void> {
		const taskId = event.taskId

		const task = await this.taskService.get(taskId)
		if (!task) return

		const { targets } = await this.resolveDeliveryTargets(taskId)
		if (targets.length === 0) return

		const status = computeNormalizedStatus(task)
		const baseUrl = this.config.orchestratorUrl

		this.lastProgressSent.set(taskId, Date.now())

		for (const target of targets) {
			await this.sendOrEditProgress(target, task, status, {
				baseUrl,
				summary: task.title,
			})
		}
	}

	// ── Core send/edit logic ───────────────────────────────────────────────

	private async sendOrEditProgress(
		target: DeliveryTarget,
		task: { id: string; title: string; status: string; workflow_id?: string | null; workflow_step?: string | null },
		status: NormalizedStatus,
		opts: { baseUrl?: string; summary: string; previewUrl?: string },
	): Promise<void> {
		const provider = this.authoredConfig.providers.get(target.providerId)
		if (!provider) return
		if (provider.kind !== 'conversation_channel') return
		if (!provider.capabilities.some((c) => c.op === 'notify.send')) return

		const existingMessageId = this.messageIdByTask.get(task.id)?.get(target.bindingId)
		const actions = this.resolveNotificationActions(task)

		const payload: NotificationPayload & {
			normalized_status: string
			workflow_id?: string
			workflow_step?: string
		} = {
			orchestrator_url: opts.baseUrl,
			event_type: 'task_progress',
			severity: status === 'failed' ? 'error' : status === 'waiting_for_review' ? 'warning' : 'info',
			title: task.title,
			summary: opts.summary,
			task_id: task.id,
			task_url: opts.baseUrl ? `${opts.baseUrl}/api/tasks/${task.id}` : undefined,
			preview_url: opts.previewUrl,
			conversation_id: target.conversationId,
			thread_id: target.threadId,
			binding_mode: target.isDefaultChat ? undefined : 'task_thread',
			actions,
			...(existingMessageId ? { edit_message_id: existingMessageId } : {}),
			normalized_status: status,
			workflow_id: task.workflow_id ?? undefined,
			workflow_step: task.workflow_step ?? undefined,
		}

		const runtimeConfig: HandlerRuntimeConfig = { companyRoot: this.config.companyRoot }
		const sendResult = await this.sendToProvider(provider, payload, runtimeConfig)
		const deliveredMessageId = sendResult?.external_id ?? existingMessageId

		// Track the external message ID for edit-in-place
		if (deliveredMessageId) {
			if (!this.messageIdByTask.has(task.id)) {
				this.messageIdByTask.set(task.id, new Map())
			}
			this.messageIdByTask.get(task.id)!.set(target.bindingId, deliveredMessageId)
		}

		// Create or update session message (skip for default-chat fallback to avoid noise)
		if (!target.isDefaultChat) {
			await this.updateSession(
				{ provider_id: target.providerId, external_conversation_id: target.conversationId, external_thread_id: target.threadId, id: target.bindingId },
				task,
				opts.summary,
				deliveredMessageId,
			)
		}
	}

	private async updateSession(
		binding: { provider_id: string; external_conversation_id: string; external_thread_id?: string | null; id: string },
		task: { id: string },
		summary: string,
		deliveredMessageId?: string,
	): Promise<void> {
		if (!this.sessionService || !this.sessionMessageService) return

		const threadId = deliveredMessageId || (binding.external_thread_id ?? undefined)
		if (!threadId) return

		const taskSession = await this.sessionService.findOrCreate({
			provider_id: binding.provider_id,
			external_conversation_id: binding.external_conversation_id,
			external_thread_id: threadId,
			mode: 'task_thread',
			task_id: task.id,
		}).catch((err) => {
			console.warn(`[task-progress-bridge] session creation failed for binding ${binding.id}:`, err instanceof Error ? err.message : String(err))
			return undefined
		})

		if (!taskSession) return

		const existingMsgId = this.sessionMsgIdByTask.get(task.id)?.get(binding.id)

		if (existingMsgId) {
			// Update existing session message in-place
			await this.sessionMessageService.updateDelivery(existingMsgId, {
				content: `[task_progress] ${summary}`.slice(0, 2000),
				external_message_id: deliveredMessageId ?? null,
			})
		} else {
			// Create new session message
			const smsg = await this.sessionMessageService.create({
				session_id: taskSession.id,
				role: 'system',
				content: `[task_progress] ${summary}`.slice(0, 2000),
				metadata: JSON.stringify({
					task_id: task.id,
					notification_type: 'task_progress',
				}),
				external_message_id: deliveredMessageId,
			})
			if (!this.sessionMsgIdByTask.has(task.id)) {
				this.sessionMsgIdByTask.set(task.id, new Map())
			}
			this.sessionMsgIdByTask.get(task.id)!.set(binding.id, smsg.id)
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

		return [
			{ action: 'task.approve', label: 'Approve', style: 'primary', requires_message: false },
			{ action: 'task.reject', label: 'Reject', style: 'danger', requires_message: false },
			{ action: 'task.reply', label: 'Reply', style: 'secondary', requires_message: true },
		]
	}

	private async sendToProvider(
		provider: Provider,
		payload: NotificationPayload,
		runtimeConfig: HandlerRuntimeConfig,
	): Promise<HandlerResult | null> {
		try {
			const result = await invokeProvider(provider, 'notify.send', payload, runtimeConfig, this.secretService)
			if (!result.ok) {
				console.warn(`[task-progress-bridge] provider ${provider.id} failed: ${result.error}`)
			}
			return result
		} catch (err) {
			console.error(
				`[task-progress-bridge] provider ${provider.id} error:`,
				err instanceof Error ? err.message : String(err),
			)
			return null
		}
	}
}
