/**
 * Generic transport adapter registry.
 *
 * Allows registering transport adapters (Telegram, Slack, etc.) by name
 * and looking them up at runtime.
 */

/** A transport adapter that can send messages and optionally parse incoming payloads. */
export interface TransportAdapter {
	name: string
	send(to: string, content: string, config: Record<string, unknown>): Promise<void>
	formatIncoming?(payload: unknown): { from: string; content: string; channel?: string } | null
}

/**
 * Registry of transport adapters keyed by name.
 *
 * Use the singleton {@link transportRegistry} for global registration.
 */
export class TransportRegistry {
	private adapters = new Map<string, TransportAdapter>()

	/** Register a transport adapter. Overwrites any existing adapter with the same name. */
	register(adapter: TransportAdapter): void {
		this.adapters.set(adapter.name, adapter)
	}

	/** Retrieve an adapter by name. */
	get(name: string): TransportAdapter | undefined {
		return this.adapters.get(name)
	}

	/** List all registered adapter names. */
	list(): string[] {
		return Array.from(this.adapters.keys())
	}

	/** Check whether an adapter with the given name is registered. */
	has(name: string): boolean {
		return this.adapters.has(name)
	}
}

/** Global singleton transport registry. */
export const transportRegistry = new TransportRegistry()
