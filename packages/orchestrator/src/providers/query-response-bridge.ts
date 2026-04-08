/**
 * Query response bridge — delivers query completion results back to the
 * originating conversation (Telegram, Slack, etc.).
 *
 * When a query run completes:
 * 1. Look up the query by run ID
 * 2. Find the session that owns this query (session.last_query_id)
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
import type { SessionService } from '../services/sessions'
import type { SecretService } from '../services/secrets'
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
	 * Throttle progress updates per run — at most one every PROGRESS_THROTTLE_MS.
	 */
	private lastProgressSent = new Map<string, number>()
	private static readonly PROGRESS_THROTTLE_MS = 10_000
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
	) {}

	start(): void {
		if (this.unsubscribe) return
		this.unsubscribe = this.eventBus.subscribe((event) => {
			this.handleEvent(event).catch((err) => {
				console.error('[query-response-bridge] unhandled error:', err instanceof Error ? err.message : String(err))
			})
		})
		// Periodic cleanup of stale tracking entries (runs that never completed)
		this.cleanupTimer = setInterval(() => {
			const staleThreshold = Date.now() - QueryResponseBridge.TRACKING_STALE_MS
			for (const [runId, lastSent] of this.lastProgressSent) {
				if (lastSent < staleThreshold) {
					this.lastProgressSent.delete(runId)
					this.workingIndicatorSent.delete(runId)
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
	}

	private async handleEvent(event: AutopilotEvent): Promise<void> {
		if (event.type === 'run_event') {
			await this.handleRunEvent(event)
			return
		}

		if (event.type !== 'run_completed') return

		// Clean up tracking state for this run
		this.workingIndicatorSent.delete(event.runId)
		this.lastProgressSent.delete(event.runId)

		// Check if this run belongs to a query (still status: running at event time)
		const query = await this.queryService.getByRunId(event.runId)
		if (!query) return

		// Find the session that owns this query.
		// Note: if a newer query replaced last_query_id on the session before this one
		// completed, the lookup will miss and the response will not be delivered.
		const session = await this.sessionService.findByLastQuery(query.id)
		if (!session) {
			console.debug(`[query-response-bridge] no session found for query ${query.id} (may have been superseded by a newer query)`)
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
			title: failed ? 'Query Failed' : 'Query Response',
			summary,
			conversation_id: session.external_conversation_id,
			// No thread_id for query sessions — responses go to the main chat
		}

		await this.sendToProvider(provider, payload)
	}

	/**
	 * Handle run_event for progressive response delivery.
	 * - On first progress event: send a "working" indicator to the conversation
	 * - Throttled to avoid spamming the conversation channel
	 */
	private async handleRunEvent(event: { type: 'run_event'; runId: string; eventType: string; summary: string }): Promise<void> {
		// Only send working indicators for progress events
		if (event.eventType !== 'started' && event.eventType !== 'progress') return

		// Already sent working indicator for this run? Skip unless enough time passed for a progress update.
		if (this.workingIndicatorSent.has(event.runId)) {
			// Throttle subsequent progress updates
			const lastSent = this.lastProgressSent.get(event.runId) ?? 0
			if (Date.now() - lastSent < QueryResponseBridge.PROGRESS_THROTTLE_MS) return
		}

		// Check if this run belongs to a query
		const query = await this.queryService.getByRunId(event.runId)
		if (!query) return

		// Find the session that owns this query
		const session = await this.sessionService.findByLastQuery(query.id)
		if (!session) return

		// Resolve the provider
		const provider = this.authoredConfig.providers.get(session.provider_id)
		if (!provider) return
		if (provider.kind !== 'conversation_channel') return
		if (!provider.capabilities.some((c) => c.op === 'notify.send')) return

		const isFirst = !this.workingIndicatorSent.has(event.runId)
		this.workingIndicatorSent.add(event.runId)
		this.lastProgressSent.set(event.runId, Date.now())

		const payload: NotificationPayload = {
			orchestrator_url: this.config.orchestratorUrl,
			event_type: 'query_progress',
			severity: 'info',
			title: isFirst ? 'Working...' : 'Still working...',
			summary: isFirst
				? 'Working on your request...'
				: event.summary.slice(0, 200),
			conversation_id: session.external_conversation_id,
		}

		await this.sendToProvider(provider, payload)
	}

	private async sendToProvider(provider: import('@questpie/autopilot-spec').Provider, payload: NotificationPayload): Promise<void> {
		const runtimeConfig: HandlerRuntimeConfig = { companyRoot: this.config.companyRoot }

		try {
			const result = await invokeProvider(provider, 'notify.send', payload, runtimeConfig, this.secretService)
			if (!result.ok) {
				console.warn(`[query-response-bridge] provider ${provider.id} failed: ${result.error}`)
			}
		} catch (err) {
			console.error(
				`[query-response-bridge] provider ${provider.id} error:`,
				err instanceof Error ? err.message : String(err),
			)
		}
	}
}
