import { describe, expect, test } from "bun:test";
import { QueryObserver } from "@tanstack/react-query";

import { createAppClient } from "@/lib/client";
import {
	type AgentsSnapshot,
	createFeatureQueries,
	type SpacesSnapshot,
} from "@/lib/data/feature-queries";
import { createAppQueryOptions } from "@/lib/query";
import { createAppQueryClient } from "@/lib/query-client";

const BASE_URL = "https://operator.example.test";
const COMPANY_ID = "company-hreben";

// Framework realtime admission default (DEFAULT_REALTIME_ADMISSION.maxFindLimit,
// questpie .../server/.../realtime/admission.ts). A live topic whose limit exceeds
// this is rejected NON-retryably, so every {realtime:true} arm's limit must stay
// <= it or the whole shell surface-denies.
const REALTIME_MAX_FIND_LIMIT = 100;

/** A controllable async stream standing in for `client.realtime.stream`. */
type StreamController<T> = {
	iterable: AsyncIterable<T>;
	push: (value: T) => void;
	close: () => void;
};

function createStreamController<T>(): StreamController<T> {
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
async function waitFor(predicate: () => boolean, label: string): Promise<void> {
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
function installStreamStub<T>(client: ReturnType<typeof createAppClient>) {
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

describe("live arms open the realtime stream on mount under the app QueryClient (ADR 0022)", () => {
	test("spaces.visibleLive: mounting opens the stream despite a loader-fresh snapshot, and a pushed snapshot updates the observer", async () => {
		const client = createAppClient({ baseURL: BASE_URL });
		const stub = installStreamStub<SpacesSnapshot>(client);
		const queries = createFeatureQueries(createAppQueryOptions(client));

		const seeded: SpacesSnapshot = {
			docs: [
				{
					id: "space-cela",
					name: "Celá spoločnosť",
					slug: "cela-spolocnost",
					isWholeCompany: true,
				},
			],
		};
		const pushed: SpacesSnapshot = {
			docs: [
				...seeded.docs,
				{ id: "space-novy", name: "Nový priestor", slug: "novy-priestor", isWholeCompany: false },
			],
		};

		// The PRODUCTION client (staleTime 60s) is what makes the mount fetch
		// suppressible — a bare `new QueryClient()` (staleTime 0) could never catch
		// this bug. Seed the PLAIN arm fresh, exactly like the loader's ensureQueryData.
		const queryClient = createAppQueryClient();
		const plain = queries.spaces.visible(COMPANY_ID);
		const live = queries.spaces.visibleLive(COMPANY_ID);
		await queryClient.prefetchQuery({ queryKey: plain.queryKey, queryFn: async () => seeded });
		expect(queryClient.getQueryData<SpacesSnapshot>(live.queryKey)).toEqual(seeded);

		// Mount the live arm exactly as useSuspenseQuery does internally: a
		// QueryObserver whose subscribe() runs the shouldFetchOnMount gate.
		const observer = new QueryObserver(queryClient, live);
		const unsubscribe = observer.subscribe(() => {});
		try {
			// (a) The stream subscribed on mount even though the hydrated snapshot is
			// FRESH. This assertion FAILS if staleTime:0/refetchOnMount:"always" are
			// removed — the arm would inherit the 60s staleTime and never fetch on mount.
			await waitFor(() => stub.topics.length > 0, "spaces stream opened on mount");
			expect(stub.topics.length).toBe(1);
			expect(stub.topics[0]?.resource).toBe("spaces");
			expect(Number(stub.topics[0]?.limit)).toBeLessThanOrEqual(REALTIME_MAX_FIND_LIMIT);

			// Background refetch, not a re-suspend: data stays the hydrated snapshot
			// while the stream opens (streamedQuery refetchMode:"append").
			const opening = observer.getCurrentResult();
			expect(opening.data).toEqual(seeded);
			expect(opening.fetchStatus).toBe("fetching");

			// (b) A pushed full snapshot replaces the entry -> the observer updates.
			stub.controller.push(pushed);
			await waitFor(
				() => observer.getCurrentResult().data?.docs.length === pushed.docs.length,
				"spaces observer received the pushed snapshot",
			);
			expect(observer.getCurrentResult().data).toEqual(pushed);
			expect(queryClient.getQueryData<SpacesSnapshot>(live.queryKey)).toEqual(pushed);
		} finally {
			unsubscribe();
			stub.controller.close();
		}
	});

	test("actors.agentsLive: mounting opens the stream, its topic limit is within the realtime cap, and a pushed snapshot updates the observer", async () => {
		const client = createAppClient({ baseURL: BASE_URL });
		const stub = installStreamStub<AgentsSnapshot>(client);
		const queries = createFeatureQueries(createAppQueryOptions(client));

		const seeded: AgentsSnapshot = { docs: [{ kind: "agent", setupStatus: "pending_setup" }] };
		const pushed: AgentsSnapshot = { docs: [{ kind: "agent", setupStatus: "ready" }] };

		const queryClient = createAppQueryClient();
		const plain = queries.actors.agents(COMPANY_ID);
		const live = queries.actors.agentsLive(COMPANY_ID);
		await queryClient.prefetchQuery({ queryKey: plain.queryKey, queryFn: async () => seeded });

		const observer = new QueryObserver(queryClient, live);
		const unsubscribe = observer.subscribe(() => {});
		try {
			// Same mount-fetch forcing as spaces: the stream opens despite fresh data.
			await waitFor(() => stub.topics.length > 0, "agents stream opened on mount");
			expect(stub.topics[0]?.resource).toBe("actors");

			// The critical-fix guard for the limit: the agents live topic limit must sit
			// within the realtime admission cap. At limit 200 the server rejected the
			// subscription NON-retryably, surface-denying the whole shell. Regressing
			// AGENT_LIST_LIMIT above the cap fails here.
			const limit = Number(stub.topics[0]?.limit);
			expect(limit).toBeGreaterThanOrEqual(1);
			expect(limit).toBeLessThanOrEqual(REALTIME_MAX_FIND_LIMIT);

			// A pushed full snapshot flips autopilot readiness on the observer.
			stub.controller.push(pushed);
			await waitFor(
				() => observer.getCurrentResult().data?.docs[0]?.setupStatus === "ready",
				"agents observer received the pushed snapshot",
			);
			expect(observer.getCurrentResult().data).toEqual(pushed);
		} finally {
			unsubscribe();
			stub.controller.close();
		}
	});
});
