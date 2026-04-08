/**
 * Query response bridge — delivers query completion results back to the
 * originating conversation (Telegram, Slack, etc.).
 *
 * When a query run completes:
 * 1. Look up the query by run ID
 * 2. Find the session that owns this query via query.session_id
 * 3. Resolve the conversation_channel provider from the session
 * 4. Send the response via notify.send with conversation routing context
 *
 * This is generic — works with any conversation_channel provider, not just Telegram.
 */
import type { AutopilotEvent, EventBus } from '../events/event-bus'
import type { Provider, NotificationPayload } from '@questpie/autopilot-spec'
import type { AuthoredConfig } from '../services/workflow-engine'
import type { QueryService } from '../services/queries'
import type { RunService } from '../services/runs'
import type { SessionService, SessionRow } from '../services/sessions'
import type { SecretService } from '../services/secrets'
import type { SessionMessageService, SessionMessageRow } from '../services/session-messages'
import { invokeProvider, type HandlerRuntimeConfig } from './handler-runtime'

export interface QueryResponseBridgeConfig {
	companyRoot: string
	orchestratorUrl?: string
}

export class QueryResponseBridge {
	private unsubscribe: (() => void) | null = null
	/**
	 * Track runs where we have already sent a "working" indicator.
	 * Prevents sending multiple "working" messages for the same run.
	 */
	private workingIndicatorSent = new Set<string>()
	/**
	 * Track the external message ID (e.g. Telegram message_id) per run,
	 * so subsequent updates edit the same message instead of sending new ones.
	 */
	private messageIdByRun = new Map<string, string>()
	/** Track the session message ID (internal, for in-place content updates) per run. */
	private sessionMsgIdByRun = new Map<string, string>()
	/**
	 * Serialize delivery events per run. The EventBus is synchronous, but bridge
	 * handlers are async; without this a fast run_completed can race the first
	 * progress send and produce duplicate chat messages.
	 */
	private runEventChains = new Map<string, Promise<void>>()
	/**
	 * Throttle progress updates per run — at most one every PROGRESS_THROTTLE_MS.
	 */
	private lastProgressSent = new Map<string, number>()
	private static readonly PROGRESS_THROTTLE_MS = 3_000
	/** Periodic cleanup timer to prevent memory leaks from orphaned tracking entries. */
	private cleanupTimer: ReturnType<typeof setInterval> | null = null
	/** Max age (ms) for tracking entries before they're considered stale. */
	private static readonly TRACKING_STALE_MS = 60 * 60 * 1000 // 1 hour

	constructor(
		private eventBus: EventBus,
		private authoredConfig: AuthoredConfig,
		private queryService: QueryService,
		private runService: RunService,
		private sessionService: SessionService,
		private config: QueryResponseBridgeConfig,
		private secretService?: SecretService,
		private sessionMessageService?: SessionMessageService,
	) {}

	start(): void {
		if (this.unsubscribe) return
		this.unsubscribe = this.eventBus.subscribe((event) => {
			this.enqueueEvent(event)
		})
		// Periodic cleanup of stale tracking entries (runs that never completed)
		this.cleanupTimer = setInterval(() => {
			const staleThreshold = Date.now() - QueryResponseBridge.TRACKING_STALE_MS
			for (const [runId, lastSent] of this.lastProgressSent) {
				if (lastSent < staleThreshold) {
					this.lastProgressSent.delete(runId)
					this.workingIndicatorSent.delete(runId)
					this.messageIdByRun.delete(runId)
					this.sessionMsgIdByRun.delete(runId)
				}
			}
		}, 5 * 60 * 1000) // every 5 minutes
		this.cleanupTimer.unref()
		console.log('[query-response-bridge] started')
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
		this.runEventChains.clear()
	}

	private enqueueEvent(event: AutopilotEvent): void {
		const runId = this.eventRunId(event)
		if (!runId) {
			this.handleEvent(event).catch((err) => {
				console.error('[query-response-bridge] unhandled error:', err instanceof Error ? err.message : String(err))
			})
			return
		}

		const previous = this.runEventChains.get(runId) ?? Promise.resolve()
		const next = previous
			.catch(() => {})
			.then(() => this.handleEvent(event))

		this.runEventChains.set(runId, next)
		next
			.catch((err) => {
				console.error('[query-response-bridge] unhandled error:', err instanceof Error ? err.message : String(err))
			})
			.finally(() => {
				if (this.runEventChains.get(runId) === next) {
					this.runEventChains.delete(runId)
				}
			})
	}

	private eventRunId(event: AutopilotEvent): string | undefined {
		if (event.type === 'run_event' || event.type === 'run_completed') return event.runId
		return undefined
	}

	private async handleEvent(event: AutopilotEvent): Promise<void> {
		if (event.type === 'run_event') {
			await this.handleRunEvent(event)
			return
		}

		if (event.type !== 'run_completed') return

		// Check if this run belongs to a query (any status — it may have been completed already)
		const query = await this.queryService.getByRunIdAnyStatus(event.runId)
		if (!query) return

		// Find the session that owns this query
		if (!query.session_id) {
			console.debug(`[query-response-bridge] query ${query.id} has no session_id — no conversation target`)
			return
		}
		const session = await this.sessionService.get(query.session_id)
		if (!session || session.status === 'closed') {
			console.debug(`[query-response-bridge] session ${query.session_id} is closed/missing — skipping response delivery`)
			return
		}

		// Resolve the provider
		const provider = this.authoredConfig.providers.get(session.provider_id)
		if (!provider) {
			console.warn(`[query-response-bridge] provider ${session.provider_id} not found in authored config`)
			return
		}
		if (provider.kind !== 'conversation_channel') return
		if (!provider.capabilities.some((c) => c.op === 'notify.send')) return

		const assistantMsg = this.sessionMessageService
			? await this.sessionMessageService.findAssistantForQuery(query.id)
			: undefined
		const editMessageId = this.messageIdByRun.get(event.runId) ?? assistantMsg?.external_message_id ?? undefined

		// Build response payload
		const run = await this.runService.get(event.runId)
		const failed = event.status === 'failed'
		const summary = failed
			? (run?.error ?? run?.summary ?? 'Query failed.')
			: (run?.summary ?? 'Query completed.')

		const payload: NotificationPayload = {
			orchestrator_url: this.config.orchestratorUrl,
			event_type: 'query_response',
			severity: failed ? 'error' : 'info',
			title: failed ? 'Query Failed' : '',
			summary,
			conversation_id: session.external_conversation_id,
			thread_id: session.external_thread_id ?? undefined,
			...(editMessageId ? { edit_message_id: editMessageId } : {}),
		}

		const sendResult = await this.sendToProvider(provider, payload)
		const deliveredMessageId = sendResult?.external_id ?? editMessageId

		// Update session resume state from completed run
		let updatedSession: SessionRow | undefined
		if (run) {
			updatedSession = await this.sessionService.updateResumeState(
				session.id,
				run.runtime_session_ref ?? null,
				run.worker_id ?? null,
			)
		}

		// Update or create assistant session message
		const effectiveSession = updatedSession ?? session
		if (this.sessionMessageService && effectiveSession) {
			const existingMsgId = this.sessionMsgIdByRun.get(event.runId) ?? assistantMsg?.id
			if (existingMsgId) {
				await this.sessionMessageService.updateDelivery(existingMsgId, {
					content: summary,
					external_message_id: deliveredMessageId ?? null,
				})
			} else {
				await this.sessionMessageService.create({
					session_id: effectiveSession.id,
					role: 'assistant',
					content: summary,
					query_id: query.id,
					external_message_id: deliveredMessageId,
				})
			}
		}

		// Clean up tracking state for this run
		this.workingIndicatorSent.delete(event.runId)
		this.lastProgressSent.delete(event.runId)
		this.messageIdByRun.delete(event.runId)
		this.sessionMsgIdByRun.delete(event.runId)

		// Drain queued user messages
		if (this.sessionMessageService && effectiveSession) {
			const queued = await this.sessionMessageService.listQueued(effectiveSession.id)
			if (queued.length > 0) {
				this.drainQueue(effectiveSession, queued, query).catch((err) => {
					console.error('[query-response-bridge] queue drain error:', err instanceof Error ? err.message : String(err))
				})
			}
		}
	}

	/**
	 * Handle run_event for progressive response delivery.
	 * - On first progress event: send a "working" indicator to the conversation
	 * - Throttled to avoid spamming the conversation channel
	 */
	private async handleRunEvent(event: { type: 'run_event'; runId: string; eventType: string; summary: string }): Promise<void> {
		// Only send working indicators for progress and tool_use events
		if (event.eventType !== 'started' && event.eventType !== 'progress' && event.eventType !== 'tool_use') return

		// Check if this run belongs to a query
		const query = await this.queryService.getByRunIdAnyStatus(event.runId)
		if (!query) return

		// Find the session that owns this query
		if (!query.session_id) return
		const session = await this.sessionService.get(query.session_id)
		if (!session || session.status === 'closed') return

		// Resolve the provider
		const provider = this.authoredConfig.providers.get(session.provider_id)
		if (!provider) return
		if (provider.kind !== 'conversation_channel') return
		if (!provider.capabilities.some((c) => c.op === 'notify.send')) return

		const assistantMsg = this.sessionMessageService
			? await this.sessionMessageService.findAssistantForQuery(query.id)
			: undefined
		const existingMessageId = this.messageIdByRun.get(event.runId) ?? assistantMsg?.external_message_id ?? undefined
		const hasWorkingIndicator = this.workingIndicatorSent.has(event.runId) || !!assistantMsg

		// Already sent working indicator for this run? Skip unless enough time passed for a progress update.
		if (hasWorkingIndicator) {
			const lastSent = this.lastProgressSent.get(event.runId) ?? 0
			if (Date.now() - lastSent < QueryResponseBridge.PROGRESS_THROTTLE_MS) return
		}

		const isFirst = !hasWorkingIndicator
		this.workingIndicatorSent.add(event.runId)
		this.lastProgressSent.set(event.runId, Date.now())

		const payload: NotificationPayload = {
			orchestrator_url: this.config.orchestratorUrl,
			event_type: 'query_progress',
			severity: 'info',
			title: '',
			summary: isFirst
				? '\u23f3'
				: event.summary.slice(0, 200) || '\u23f3',
			conversation_id: session.external_conversation_id,
			thread_id: session.external_thread_id ?? undefined,
			...(existingMessageId ? { edit_message_id: existingMessageId } : {}),
		}

		const result = await this.sendToProvider(provider, payload)
		// Capture the external message ID from the first send so we can edit it later
		const deliveredMessageId = result?.external_id ?? existingMessageId
		if (deliveredMessageId) this.messageIdByRun.set(event.runId, deliveredMessageId)

		// Create/update session message for progress tracking
		if (this.sessionMessageService && session && isFirst) {
			const smsg = await this.sessionMessageService.create({
				session_id: session.id,
				role: 'assistant',
				content: '\u23f3',
				query_id: query.id,
				external_message_id: deliveredMessageId,
			})
			this.sessionMsgIdByRun.set(event.runId, smsg.id)
		} else if (this.sessionMessageService && !isFirst) {
			const existingMsgId = this.sessionMsgIdByRun.get(event.runId) ?? assistantMsg?.id
			if (existingMsgId) {
				await this.sessionMessageService.updateDelivery(existingMsgId, {
					content: event.summary.slice(0, 200) || '\u23f3',
					external_message_id: deliveredMessageId ?? null,
				})
				this.sessionMsgIdByRun.set(event.runId, existingMsgId)
			}
		}
	}

	private async drainQueue(
		session: SessionRow,
		queued: SessionMessageRow[],
		previousQuery: import('../services/queries').QueryRow,
	): Promise<void> {
		if (!this.sessionMessageService) return

		const { randomBytes } = await import('node:crypto')

		// Batch queued messages into one prompt
		const batchedPrompt = queued.map((m) => m.content).join('\n')

		// Get system notifications since the previous query
		const systemMsgs = await this.sessionMessageService.listSystemSince(
			session.id,
			previousQuery.created_at,
		)

		const hasResume = !!session.runtime_session_ref
		const { buildQueryInstructions } = await import('../services/queries')
		const instructions = buildQueryInstructions(batchedPrompt, {
			sessionMessages: systemMsgs,
			allowMutation: false,
			hasResume,
		})

		const agentId = previousQuery.agent_id
		const initiator = previousQuery.created_by

		// Carry forward runtime config from previous run
		let runtime = this.authoredConfig.defaults.runtime
		let model: string | undefined
		let provider: string | undefined
		let variant: string | undefined
		let targeting: string | undefined

		if (previousQuery.run_id) {
			const prevRun = await this.runService.get(previousQuery.run_id)
			if (prevRun) {
				runtime = prevRun.runtime
				model = prevRun.model ?? undefined
				provider = prevRun.provider ?? undefined
				variant = prevRun.variant ?? undefined
				targeting = prevRun.targeting ?? undefined
			}
		}

		const newQuery = await this.queryService.create({
			prompt: batchedPrompt,
			agent_id: agentId,
			allow_repo_mutation: false,
			session_id: session.id,
			created_by: initiator,
		})

		const runId = `run-${Date.now()}-${randomBytes(6).toString('hex')}`
		await this.runService.create({
			id: runId,
			agent_id: agentId,
			runtime,
			model,
			provider,
			variant,
			initiated_by: initiator,
			instructions,
			runtime_session_ref: session.runtime_session_ref ?? undefined,
			preferred_worker_id: session.preferred_worker_id ?? undefined,
			targeting,
		})

		await this.queryService.linkRun(newQuery.id, runId)

		await this.sessionMessageService.markConsumed(
			queued.map((m) => m.id),
			newQuery.id,
		)
	}

	private async sendToProvider(provider: import('@questpie/autopilot-spec').Provider, payload: NotificationPayload): Promise<import('@questpie/autopilot-spec').HandlerResult | null> {
		const runtimeConfig: HandlerRuntimeConfig = { companyRoot: this.config.companyRoot }

		try {
			const result = await invokeProvider(provider, 'notify.send', payload, runtimeConfig, this.secretService)
			if (!result.ok) {
				console.warn(`[query-response-bridge] provider ${provider.id} failed: ${result.error}`)
			}
			return result
		} catch (err) {
			console.error(
				`[query-response-bridge] provider ${provider.id} error:`,
				err instanceof Error ? err.message : String(err),
			)
			return null
		}
	}
}
