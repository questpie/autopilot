import { describe, expect, test } from "bun:test";
import { QueryObserver } from "@tanstack/react-query";

import { createAppClient } from "@/lib/client";
import {
	type ChannelsSnapshot,
	createFeatureQueries,
	deriveChannelDirectory,
} from "@/lib/data/feature-queries";
import { createAppQueryOptions } from "@/lib/query";
import { createAppQueryClient } from "@/lib/query-client";

import { installStreamStub, waitFor } from "./realtime-stream-stub";

const BASE_URL = "https://operator.example.test";
const SPACE_ID = "space-cela";

// Framework realtime admission cap (DEFAULT_REALTIME_ADMISSION.maxFindLimit). The
// directory's live arm is channels.visibleLive, so its topic limit must stay within.
const REALTIME_MAX_FIND_LIMIT = 100;

/**
 * ADR 0022 validation surface — the LIVE channel directory in the Space detail
 * route. It MIRRORS the spaces directory but channels are SPACE-SCOPED: it does NOT
 * read a frozen loader projection, it prefetches the PLAIN `channels.visible(spaceId)`
 * arm and mounts the LIVE `channels.visibleLive(spaceId)` arm on the IDENTICAL key
 * (one cache entry), then re-runs the PURE `deriveChannelDirectory` client-side. This
 * test proves that under the PRODUCTION QueryClient (staleTime 60s) the streamFn opens
 * on mount (the staleTime:0 / refetchOnMount:"always" fix) and that a pushed snapshot
 * flows through the derive to the directory shape — so a channel created in this Space
 * appears live, the #general anchor first, with no invalidate and no second projection.
 */
describe("channel directory is LIVE off visible/visibleLive + a pure derive (ADR 0022)", () => {
	test("mounting the channels live arm opens the stream despite a loader-fresh snapshot", async () => {
		const client = createAppClient({ baseURL: BASE_URL });
		const stub = installStreamStub<ChannelsSnapshot>(client);
		const queries = createFeatureQueries(createAppQueryOptions(client));

		const seeded: ChannelsSnapshot = {
			docs: [{ id: "channel-general", name: "General", slug: "general", kind: "system_default" }],
		};

		// The PRODUCTION client (staleTime 60s) is what makes the mount fetch
		// suppressible — this is the exact bug the live arm's staleTime:0 fixes.
		const queryClient = createAppQueryClient();
		const plain = queries.channels.visible(SPACE_ID);
		const live = queries.channels.visibleLive(SPACE_ID);
		// Loader's ensureQueryData(channels.visible): seed the PLAIN arm fresh.
		await queryClient.prefetchQuery({ queryKey: plain.queryKey, queryFn: async () => seeded });
		// Plain and live share ONE cache entry (framework omits {realtime} from the key).
		expect(live.queryKey).toEqual(plain.queryKey);
		expect(queryClient.getQueryData<ChannelsSnapshot>(live.queryKey)).toEqual(seeded);

		// Mount the live arm exactly as useSuspenseQuery does: a QueryObserver whose
		// subscribe() runs the shouldFetchOnMount gate.
		const observer = new QueryObserver(queryClient, live);
		const unsubscribe = observer.subscribe(() => {});
		try {
			// The stream subscribed on mount even though the hydrated snapshot is FRESH.
			// This FAILS if staleTime:0 / refetchOnMount:"always" regress on the live arm.
			await waitFor(() => stub.topics.length > 0, "channel directory stream opened on mount");
			expect(stub.topics[0]?.resource).toBe("channels");
			expect(Number(stub.topics[0]?.limit)).toBeLessThanOrEqual(REALTIME_MAX_FIND_LIMIT);

			// Background refetch, not a re-suspend: the hydrated snapshot stays visible
			// while the stream opens (streamedQuery refetchMode:"append").
			const opening = observer.getCurrentResult();
			expect(opening.data).toEqual(seeded);
			expect(opening.fetchStatus).toBe("fetching");
		} finally {
			unsubscribe();
			stub.controller.close();
		}
	});

	test("a pushed snapshot flows through deriveChannelDirectory: new channel appears, #general first", async () => {
		const client = createAppClient({ baseURL: BASE_URL });
		const stub = installStreamStub<ChannelsSnapshot>(client);
		const queries = createFeatureQueries(createAppQueryOptions(client));

		const seeded: ChannelsSnapshot = {
			docs: [{ id: "channel-general", name: "General", slug: "general", kind: "system_default" }],
		};
		// A pushed FULL snapshot the server would stream after a channels.create —
		// unsorted, with a new standard channel ahead of the protected #general anchor.
		const pushed: ChannelsSnapshot = {
			docs: [
				{ id: "channel-random", name: "Random", slug: "random", kind: "standard" },
				{ id: "channel-general", name: "General", slug: "general", kind: "system_default" },
			],
		};

		const queryClient = createAppQueryClient();
		const plain = queries.channels.visible(SPACE_ID);
		const live = queries.channels.visibleLive(SPACE_ID);
		await queryClient.prefetchQuery({ queryKey: plain.queryKey, queryFn: async () => seeded });

		const observer = new QueryObserver(queryClient, live);
		const unsubscribe = observer.subscribe(() => {});
		try {
			await waitFor(() => stub.topics.length > 0, "stream opened on mount");

			// The persisted new channel arrives via the stream (create reconciles by
			// identity on the live list — no onMutate) and the replace reducer swaps the
			// whole snapshot into the ONE shared cache entry.
			stub.controller.push(pushed);
			await waitFor(
				() => observer.getCurrentResult().data?.docs.length === pushed.docs.length,
				"observer received the pushed snapshot",
			);

			// The route derives the directory client-side off the live snapshot — the
			// pure projection sorts the #general system_default anchor first, then name.
			const directory = deriveChannelDirectory(observer.getCurrentResult().data!.docs);
			expect(directory.map((channel) => channel.slug)).toEqual(["general", "random"]);
			expect(directory[0]?.isSystemDefault).toBe(true);
			expect(directory[1]?.isSystemDefault).toBe(false);
		} finally {
			unsubscribe();
			stub.controller.close();
		}
	});
});

describe("deriveChannelDirectory is a pure, stable projection", () => {
	test("orders the #general system_default anchor first, then standard channels by Slovak name", () => {
		const docs = [
			{ id: "c-zebra", name: "Zebra", slug: "zebra", kind: "standard" },
			{ id: "c-ahoj", name: "Ahoj", slug: "ahoj", kind: "standard" },
			{ id: "c-general", name: "General", slug: "general", kind: "system_default" },
		];
		const directory = deriveChannelDirectory(docs);
		// #general first regardless of input order; standard channels by Slovak name.
		expect(directory.map((channel) => channel.slug)).toEqual(["general", "ahoj", "zebra"]);
		expect(directory[0]?.isSystemDefault).toBe(true);
		expect(directory.slice(1).every((channel) => !channel.isSystemDefault)).toBe(true);
	});

	test("does not mutate its input (pure projection)", () => {
		const docs = [
			{ id: "c-beta", name: "Beta", slug: "beta", kind: "standard" },
			{ id: "c-general", name: "General", slug: "general", kind: "system_default" },
		];
		const snapshot = JSON.stringify(docs);
		deriveChannelDirectory(docs);
		// Input array order and contents are untouched — the sort runs on a mapped copy.
		expect(JSON.stringify(docs)).toEqual(snapshot);
	});
});
