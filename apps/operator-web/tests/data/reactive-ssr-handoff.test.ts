import { describe, expect, test } from "bun:test";
import { dehydrate, hashKey, hydrate, QueryClient } from "@tanstack/react-query";

import type { SpacesSnapshot } from "@/features/spaces/queries";
import { createAppClient } from "@/lib/client";
import { createAppQueries } from "@/lib/data/app-data-context";
import { createAppQueryOptions } from "@/lib/query";

const BASE_URL = "https://operator.example.test";
const COMPANY_ID = "company-hreben";

const q = createAppQueryOptions(createAppClient({ baseURL: BASE_URL }));
const queries = createAppQueries(q);

/**
 * The bounded live snapshot a real loader prefetches (plain arm) and the real
 * component reads (live arm). Slovak fixture copy; shape is `SpacesSnapshot`.
 */
const SNAPSHOT: SpacesSnapshot = {
	docs: [
		{ id: "space-cela", name: "Celá spoločnosť", slug: "cela-spolocnost", isWholeCompany: true },
		{ id: "space-marketing", name: "Marketing", slug: "marketing", isWholeCompany: false },
	],
};

/**
 * ADR 0022 load-bearing handoff (smallest real surface): the loader prefetches
 * the PLAIN arm and the component mounts the LIVE arm on the IDENTICAL key, so
 * hydration static-loads the snapshot and the realtime queryFn upgrades that ONE
 * cache entry in place. This is a cache-entry-identity + dehydrate/hydrate
 * round-trip proof — no stream is mocked, because the streaming self-heal is the
 * scenario harness's job; here we prove only that plain and live resolve to one
 * entry and that the SSR round-trip preserves the entry the live arm reads.
 */
describe("spaces static->live SSR handoff shares one cache entry (ADR 0022)", () => {
	test("plain and live arms are ONE key with different queryFns (REST vs realtime)", () => {
		const plain = queries.spaces.visible(COMPANY_ID);
		const live = queries.spaces.visibleLive(COMPANY_ID);

		// Same key: the framework hashes options BEFORE the realtime branch and
		// never puts the {realtime} config into the key (index.ts:638-671), so the
		// two arms hash to a single cache entry.
		expect(live.queryKey).toEqual(plain.queryKey);
		expect(hashKey(live.queryKey)).toBe(hashKey(plain.queryKey));

		// Different queryFns on that one key: the plain REST arm carries no retry;
		// the live arm is the streaming upgrade (retry: realtimeRetry, index.ts:651)
		// — this is the queryFn that upgrades the hydrated snapshot to a stream.
		expect(plain.retry).toBeUndefined();
		expect(typeof live.retry).toBe("function");
		expect(live.queryFn).not.toBe(plain.queryFn);
	});

	test("loader-prefetched plain snapshot is served immediately to the live arm", async () => {
		const client = new QueryClient();
		const plain = queries.spaces.visible(COMPANY_ID);
		const live = queries.spaces.visibleLive(COMPANY_ID);

		// Simulate the loader's `ensureQueryData(spaces.visible)`: a success entry at
		// the plain arm's key. No live server exists in a unit test, so the queryFn
		// stands in for the REST read the loader would have performed.
		await client.prefetchQuery({ queryKey: plain.queryKey, queryFn: async () => SNAPSHOT });

		// Exactly ONE cache entry exists after seeding the plain arm...
		const cache = client.getQueryCache();
		expect(cache.getAll()).toHaveLength(1);

		// ...and the live arm's key resolves to that SAME Query object, not a second
		// entry — the shared-key invariant that makes the handoff possible.
		const plainEntry = cache.find({ queryKey: plain.queryKey, exact: true });
		const liveEntry = cache.find({ queryKey: live.queryKey, exact: true });
		expect(liveEntry).toBe(plainEntry);
		expect(liveEntry?.queryHash).toBe(hashKey(live.queryKey));

		// The component reads the live arm's key and is served the hydrated snapshot
		// synchronously — the static load is delivered before any stream chunk, which
		// is exactly what lets `useSuspenseQuery(visibleLive)` render without a flash.
		expect(client.getQueryData<SpacesSnapshot>(live.queryKey)).toEqual(SNAPSHOT);
	});

	test("dehydrate/hydrate round-trip preserves the entry the live arm reads", async () => {
		// Server request: the loader prefetches the plain arm into the request client.
		const server = new QueryClient();
		const plain = queries.spaces.visible(COMPANY_ID);
		const live = queries.spaces.visibleLive(COMPANY_ID);
		await server.prefetchQuery({ queryKey: plain.queryKey, queryFn: async () => SNAPSHOT });

		// SSR dehydrate (setupRouterSsrQueryIntegration): the success entry is
		// included and carries the exact hash the live arm looks up on the client.
		const dehydrated = dehydrate(server);
		const carried = dehydrated.queries.find((entry) => entry.queryHash === hashKey(live.queryKey));
		expect(carried).toBeDefined();
		expect(carried?.state.data).toEqual(SNAPSHOT);

		// Client hydrate into a fresh QueryClient, then the component mounts the LIVE
		// arm: it reads the hydrated snapshot on the identical key. The SSR static
		// load survives the round-trip and is the value the stream then upgrades.
		const browser = new QueryClient();
		hydrate(browser, dehydrated);
		expect(browser.getQueryData<SpacesSnapshot>(live.queryKey)).toEqual(SNAPSHOT);
		expect(browser.getQueryCache().find({ queryKey: live.queryKey, exact: true })).toBeDefined();
	});
});
