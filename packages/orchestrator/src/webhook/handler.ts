/**
 * Generic webhook handler registry.
 *
 * Provides a plugin-style dispatch mechanism: each registered handler
 * declares which webhook IDs it can handle, and the registry routes
 * incoming payloads to the first matching handler.
 */

/** Context passed to every webhook handler. */
export interface WebhookContext {
	companyRoot: string
}

/** Result returned by a webhook handler after processing a payload. */
export interface WebhookResult {
	handled: boolean
	agentId?: string
	response?: unknown
	error?: string
}

/** A single webhook handler plugin. */
export interface WebhookHandler {
	/** Unique identifier for this handler. */
	id: string
	/** Return `true` if this handler should process the given webhook. */
	canHandle(webhookId: string, payload: unknown): boolean
	/** Process the webhook payload. */
	handle(payload: unknown, ctx: WebhookContext): Promise<WebhookResult>
}

/**
 * Registry that holds webhook handlers and dispatches incoming payloads.
 *
 * Use the singleton {@link webhookHandlerRegistry} for global registration.
 */
export class WebhookHandlerRegistry {
	private handlers: WebhookHandler[] = []

	/** Register a webhook handler. */
	register(handler: WebhookHandler): void {
		this.handlers.push(handler)
	}

	/**
	 * Dispatch a webhook payload to the first handler that can handle it.
	 *
	 * Returns `{ handled: false }` if no handler matches.
	 */
	async dispatch(webhookId: string, payload: unknown, ctx: WebhookContext): Promise<WebhookResult> {
		for (const handler of this.handlers) {
			if (handler.canHandle(webhookId, payload)) {
				return handler.handle(payload, ctx)
			}
		}
		return { handled: false, error: `no handler registered for webhook: ${webhookId}` }
	}

	/** List all registered handler IDs. */
	list(): string[] {
		return this.handlers.map((h) => h.id)
	}

	/** Check whether a handler with the given ID is registered. */
	has(id: string): boolean {
		return this.handlers.some((h) => h.id === id)
	}
}

/** Global singleton webhook handler registry. */
export const webhookHandlerRegistry = new WebhookHandlerRegistry()
