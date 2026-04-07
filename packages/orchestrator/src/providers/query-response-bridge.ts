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
		console.log('[query-response-bridge] started')
	}

	stop(): void {
		if (this.unsubscribe) {
			this.unsubscribe()
			this.unsubscribe = null
		}
	}

	private async handleEvent(event: AutopilotEvent): Promise<void> {
		if (event.type !== 'run_completed') return

		// Check if this run belongs to a query (still status: running at event time)
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
