export interface QueueDelivery<T> {
	readonly messageId: string;
	readonly payload: T;
	readonly deliveryAttempt: number;
}

interface QueuedMessage<T> {
	readonly messageId: string;
	readonly payload: T;
	deliveryAttempt: number;
}

export class ControllableQueueFixture<T> {
	readonly #messages: QueuedMessage<T>[] = [];
	readonly #history: QueueDelivery<T>[] = [];

	constructor(private readonly nextId: () => string) {}

	publish(payload: T): string {
		const messageId = this.nextId();
		this.#messages.push({ messageId, payload, deliveryAttempt: 0 });
		return messageId;
	}

	async deliverNext(handler: (delivery: QueueDelivery<T>) => Promise<void> | void): Promise<void> {
		const message = this.#messages.shift();
		if (!message) throw new Error("No queued message is available for delivery");

		message.deliveryAttempt += 1;
		const delivery = { ...message };
		this.#history.push(delivery);
		await handler(delivery);
	}

	redeliver(messageId: string): void {
		const previous = this.#history.findLast((delivery) => delivery.messageId === messageId);
		if (!previous) throw new Error(`Unknown delivery ${messageId}`);
		this.#messages.unshift({
			messageId: previous.messageId,
			payload: previous.payload,
			deliveryAttempt: previous.deliveryAttempt,
		});
	}

	get pendingCount(): number {
		return this.#messages.length;
	}

	get history(): readonly QueueDelivery<T>[] {
		return this.#history;
	}
}

export class IdempotencyFixture<TResult> {
	readonly #results = new Map<string, TResult>();

	async execute(key: string, operation: () => Promise<TResult> | TResult): Promise<TResult> {
		const existing = this.#results.get(key);
		if (existing !== undefined) return existing;

		const result = await operation();
		this.#results.set(key, result);
		return result;
	}

	get processedKeys(): readonly string[] {
		return [...this.#results.keys()];
	}
}
