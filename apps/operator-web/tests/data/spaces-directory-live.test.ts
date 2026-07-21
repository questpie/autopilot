import { describe, expect, test } from "bun:test";
import { QueryObserver } from "@tanstack/react-query";

import { deriveSpaceDirectory, type SpacesSnapshot } from "@/features/spaces/queries";
import { createAppClient } from "@/lib/client";
import { createAppQueries } from "@/lib/data/app-data-context";
import { createAppQueryOptions } from "@/lib/query";
import { createAppQueryClient } from "@/lib/query-client";

import { installStreamStub, waitFor } from "./realtime-stream-stub";

const BASE_URL = "https://operator.example.test";
const COMPANY_ID = "company-hreben";

// Framework realtime admission cap (DEFAULT_REALTIME_ADMISSION.maxFindLimit). The
// directory's live arm is spaces.visibleLive, so its topic limit must stay within.
const REALTIME_MAX_FIND_LIMIT = 100;

/**
 * ADR 0022 validation surface — the LIVE spaces directory route. It does NOT read
 * a frozen loader projection: it prefetches the PLAIN `spaces.visible` arm and
 * mounts the LIVE `spaces.visibleLive` arm on the IDENTICAL key (one cache entry),
 * then re-runs the PURE `deriveSpaceDirectory` client-side. This test proves that
 * under the PRODUCTION QueryClient (staleTime 60s) the streamFn opens on mount
 * (the staleTime:0 / refetchOnMount:"always" fix) and that a pushed snapshot flows
 * through the derive to the directory shape — so a Space created elsewhere appears
 * live, sorted Whole Company first, with no invalidate and no second projection.
 */
describe("spaces directory is LIVE off visible/visibleLive + a pure derive (ADR 0022)", () => {
	test("mounting the directory live arm opens the stream despite a loader-fresh snapshot", async () => {
		const client = createAppClient({ baseURL: BASE_URL });
		const stub = installStreamStub<SpacesSnapshot>(client);
		const queries = createAppQueries(createAppQueryOptions(client));

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

		// The PRODUCTION client (staleTime 60s) is what makes the mount fetch
		// suppressible — this is the exact bug the live arm's staleTime:0 fixes.
		const queryClient = createAppQueryClient();
		const plain = queries.spaces.visible(COMPANY_ID);
		const live = queries.spaces.visibleLive(COMPANY_ID);
		// Loader's ensureQueryData(spaces.visible): seed the PLAIN arm fresh.
		await queryClient.prefetchQuery({ queryKey: plain.queryKey, queryFn: async () => seeded });
		// Plain and live share ONE cache entry (framework omits {realtime} from the key).
		expect(live.queryKey).toEqual(plain.queryKey);
		expect(queryClient.getQueryData<SpacesSnapshot>(live.queryKey)).toEqual(seeded);

		// Mount the live arm exactly as useSuspenseQuery does: a QueryObserver whose
		// subscribe() runs the shouldFetchOnMount gate.
		const observer = new QueryObserver(queryClient, live);
		const unsubscribe = observer.subscribe(() => {});
		try {
			// The stream subscribed on mount even though the hydrated snapshot is FRESH.
			// This FAILS if staleTime:0 / refetchOnMount:"always" regress on the live arm.
			await waitFor(() => stub.topics.length > 0, "spaces directory stream opened on mount");
			expect(stub.topics[0]?.resource).toBe("spaces");
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

	test("a pushed snapshot flows through deriveSpaceDirectory: new Space appears, Whole Company first", async () => {
		const client = createAppClient({ baseURL: BASE_URL });
		const stub = installStreamStub<SpacesSnapshot>(client);
		const queries = createAppQueries(createAppQueryOptions(client));

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
		// A pushed FULL snapshot the server would stream after a create — unsorted, a
		// non-Whole-Company space carrying a description the live snapshot type omits
		// but the runtime find result includes.
		const pushed: SpacesSnapshot = {
			docs: [
				{ id: "space-marketing", name: "Marketing", slug: "marketing", isWholeCompany: false },
				{
					id: "space-cela",
					name: "Celá spoločnosť",
					slug: "cela-spolocnost",
					isWholeCompany: true,
				},
			],
		};

		const queryClient = createAppQueryClient();
		const plain = queries.spaces.visible(COMPANY_ID);
		const live = queries.spaces.visibleLive(COMPANY_ID);
		await queryClient.prefetchQuery({ queryKey: plain.queryKey, queryFn: async () => seeded });

		const observer = new QueryObserver(queryClient, live);
		const unsubscribe = observer.subscribe(() => {});
		try {
			await waitFor(() => stub.topics.length > 0, "stream opened on mount");

			// The persisted new Space arrives via the stream (create reconciles by
			// identity on the live list — no onMutate) and the replace reducer swaps the
			// whole snapshot into the ONE shared cache entry.
			stub.controller.push(pushed);
			await waitFor(
				() => observer.getCurrentResult().data?.docs.length === pushed.docs.length,
				"observer received the pushed snapshot",
			);

			// The route derives the directory client-side off the live snapshot — the
			// pure projection sorts Whole Company first, then Slovak-collated name.
			const directory = deriveSpaceDirectory(observer.getCurrentResult().data!.docs);
			expect(directory.map((space) => space.slug)).toEqual(["cela-spolocnost", "marketing"]);
			expect(directory[0]?.isWholeCompany).toBe(true);
			// Projection normalizes the absent description to null (never undefined).
			expect(directory[1]?.description).toBeNull();
		} finally {
			unsubscribe();
			stub.controller.close();
		}
	});
});
