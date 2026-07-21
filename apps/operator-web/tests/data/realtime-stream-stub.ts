import type { createAppClient } from "@/lib/client";

/**
 * Shared realtime test doubles for the ADR 0022 live-arm tests. A controllable
 * async stream stands in for `client.realtime.stream`, so a test can prove that
 * mounting a `{realtime:true}` arm actually opens the SSE subscription (the stub's
 * `stream` records the call + topic) and then drive full-snapshot pushes through
 * the streamedQuery replace reducer. No network, no timers beyond macrotask polls.
 */

/** A controllable async stream standing in for `client.realtime.stream`. */
export type StreamController<T> = {
	iterable: AsyncIterable<T>;
	push: (value: T) => void;
	close: () => void;
};

export function createStreamController<T>(): StreamController<T> {
	const queued: T[] = [];
	let pending: ((result: IteratorResult<T>) => void) | null = null;
	let closed = false;
	const iterator: AsyncIterator<T> = {
		next(): Promise<IteratorResult<T>> {
			if (queued.length > 0) return Promise.resolve({ value: queued.shift() as T, done: false });
			if (closed) return Promise.resolve({ value: undefined, done: true });
			return new Promise<IteratorResult<T>>((resolve) => {
				pending = resolve;
			});
		},
	};
	const settle = (result: IteratorResult<T>) => {
		const resolve = pending;
		pending = null;
		resolve?.(result);
	};
	return {
		iterable: { [Symbol.asyncIterator]: () => iterator },
		push(value: T) {
			if (pending) settle({ value, done: false });
			else queued.push(value);
		},
		close() {
			closed = true;
			if (pending) settle({ value: undefined, done: true });
		},
	};
}

/** Poll a predicate across macrotasks so async fetch/stream progress can land. */
export async function waitFor(predicate: () => boolean, label: string): Promise<void> {
	for (let attempt = 0; attempt < 100; attempt += 1) {
		if (predicate()) return;
		await new Promise((resolve) => setTimeout(resolve, 2));
	}
	throw new Error(`waitFor timed out: ${label}`);
}

/**
 * Replace `client.realtime` with a stub whose `stream` records every call + topic
 * and yields from one controllable stream. The real client always exposes a
 * realtime API (client/index.ts), so the {realtime:true} find branch is taken and
 * this stub is the only thing `streamRealtimeQuery` iterates — invoking it proves
 * the mount fetch opened the SSE subscription.
 */
export function installStreamStub<T>(client: ReturnType<typeof createAppClient>) {
	const controller = createStreamController<T>();
	const topics: Array<Record<string, unknown>> = [];
	const realtime = {
		stream: (topic: Record<string, unknown>) => {
			topics.push(topic);
			return controller.iterable;
		},
	};
	(client as unknown as { realtime: typeof realtime }).realtime = realtime;
	return { controller, topics };
}
