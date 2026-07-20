export interface RealtimeFixtureEvent<T> {
	readonly id: number;
	readonly payload: T;
}

export type RealtimeReplay<T> =
	| { readonly kind: "replay"; readonly events: readonly RealtimeFixtureEvent<T>[] }
	| { readonly kind: "gap"; readonly refetchRequired: true; readonly latestEventId: number };

export class RealtimeGapFixture<T> {
	readonly #events: RealtimeFixtureEvent<T>[] = [];
	#nextId = 1;

	constructor(private readonly retention = 10) {
		if (retention < 1) throw new Error("Realtime fixture retention must be positive");
	}

	publish(payload: T): RealtimeFixtureEvent<T> {
		const event = { id: this.#nextId, payload };
		this.#nextId += 1;
		this.#events.push(event);
		if (this.#events.length > this.retention) this.#events.shift();
		return event;
	}

	reconnect(lastEventId: number): RealtimeReplay<T> {
		const earliestAvailable = this.#events[0]?.id ?? this.#nextId;
		const latestEventId = this.#events.at(-1)?.id ?? 0;
		if (lastEventId < earliestAvailable - 1) {
			return { kind: "gap", refetchRequired: true, latestEventId };
		}

		return {
			kind: "replay",
			events: this.#events.filter((event) => event.id > lastEventId),
		};
	}
}
