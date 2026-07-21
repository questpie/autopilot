import { describe, expect, test } from "bun:test";
import { QueryObserver } from "@tanstack/react-query";

import { deriveProjectDirectory, type ProjectsSnapshot } from "@/features/projects/queries";
import { createAppClient } from "@/lib/client";
import { createAppQueries } from "@/lib/data/app-data-context";
import { createAppQueryOptions } from "@/lib/query";
import { createAppQueryClient } from "@/lib/query-client";

import { installStreamStub, waitFor } from "./realtime-stream-stub";

const BASE_URL = "https://operator.example.test";
const SPACE_ID = "space-cela";

// Framework realtime admission cap (DEFAULT_REALTIME_ADMISSION.maxFindLimit). The
// directory's live arm is projects.visibleLive, so its topic limit must stay within.
const REALTIME_MAX_FIND_LIMIT = 100;

/**
 * ADR 0022 validation surface — the LIVE project directory in the Space detail route,
 * the exact space-scoped mirror of the channel directory. It does NOT read a frozen
 * loader projection: it prefetches the PLAIN `projects.visible(spaceId)` arm and mounts
 * the LIVE `projects.visibleLive(spaceId)` arm on the IDENTICAL key (one cache entry),
 * then re-runs the PURE `deriveProjectDirectory` client-side. This test proves that
 * under the PRODUCTION QueryClient (staleTime 60s) the streamFn opens on mount (the
 * staleTime:0 / refetchOnMount:"always" fix) and that a pushed snapshot flows through
 * the derive to the directory shape — so a project created in this Space appears live,
 * ordered by name, with no invalidate and no second projection.
 */
describe("project directory is LIVE off visible/visibleLive + a pure derive (ADR 0022)", () => {
	test("mounting the projects live arm opens the stream despite a loader-fresh snapshot", async () => {
		const client = createAppClient({ baseURL: BASE_URL });
		const stub = installStreamStub<ProjectsSnapshot>(client);
		const queries = createAppQueries(createAppQueryOptions(client));

		const seeded: ProjectsSnapshot = {
			docs: [{ id: "project-alfa", name: "Alfa", slug: "alfa" }],
		};

		// The PRODUCTION client (staleTime 60s) is what makes the mount fetch
		// suppressible — this is the exact bug the live arm's staleTime:0 fixes.
		const queryClient = createAppQueryClient();
		const plain = queries.projects.visible(SPACE_ID);
		const live = queries.projects.visibleLive(SPACE_ID);
		// Loader's ensureQueryData(projects.visible): seed the PLAIN arm fresh.
		await queryClient.prefetchQuery({ queryKey: plain.queryKey, queryFn: async () => seeded });
		// Plain and live share ONE cache entry (framework omits {realtime} from the key).
		expect(live.queryKey).toEqual(plain.queryKey);
		expect(queryClient.getQueryData<ProjectsSnapshot>(live.queryKey)).toEqual(seeded);

		// Mount the live arm exactly as useSuspenseQuery does: a QueryObserver whose
		// subscribe() runs the shouldFetchOnMount gate.
		const observer = new QueryObserver(queryClient, live);
		const unsubscribe = observer.subscribe(() => {});
		try {
			// The stream subscribed on mount even though the hydrated snapshot is FRESH.
			// This FAILS if staleTime:0 / refetchOnMount:"always" regress on the live arm.
			await waitFor(() => stub.topics.length > 0, "project directory stream opened on mount");
			expect(stub.topics[0]?.resource).toBe("projects");
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

	test("a pushed snapshot flows through deriveProjectDirectory: new project appears, by name", async () => {
		const client = createAppClient({ baseURL: BASE_URL });
		const stub = installStreamStub<ProjectsSnapshot>(client);
		const queries = createAppQueries(createAppQueryOptions(client));

		const seeded: ProjectsSnapshot = {
			docs: [{ id: "project-alfa", name: "Alfa", slug: "alfa" }],
		};
		// A pushed FULL snapshot the server would stream after a projects.create —
		// unsorted, with a new project whose name sorts ahead of the seeded one.
		const pushed: ProjectsSnapshot = {
			docs: [
				{ id: "project-zeta", name: "Zeta", slug: "zeta" },
				{ id: "project-alfa", name: "Alfa", slug: "alfa" },
				{ id: "project-beta", name: "Beta", slug: "beta" },
			],
		};

		const queryClient = createAppQueryClient();
		const plain = queries.projects.visible(SPACE_ID);
		const live = queries.projects.visibleLive(SPACE_ID);
		await queryClient.prefetchQuery({ queryKey: plain.queryKey, queryFn: async () => seeded });

		const observer = new QueryObserver(queryClient, live);
		const unsubscribe = observer.subscribe(() => {});
		try {
			await waitFor(() => stub.topics.length > 0, "stream opened on mount");

			// The persisted new project arrives via the stream (create reconciles by
			// identity on the live list — no onMutate) and the replace reducer swaps the
			// whole snapshot into the ONE shared cache entry.
			stub.controller.push(pushed);
			await waitFor(
				() => observer.getCurrentResult().data?.docs.length === pushed.docs.length,
				"observer received the pushed snapshot",
			);

			// The route derives the directory client-side off the live snapshot — the
			// pure projection sorts by Slovak name (no system_default anchor for projects).
			const directory = deriveProjectDirectory(observer.getCurrentResult().data!.docs);
			expect(directory.map((project) => project.slug)).toEqual(["alfa", "beta", "zeta"]);
		} finally {
			unsubscribe();
			stub.controller.close();
		}
	});
});

describe("deriveProjectDirectory is a pure, stable projection", () => {
	test("orders active projects by Slovak name, with a slug tiebreak for equal names", () => {
		const docs = [
			{ id: "p-zebra", name: "Zebra", slug: "zebra" },
			{ id: "p-ahoj-b", name: "Ahoj", slug: "ahoj-beta" },
			{ id: "p-ahoj-a", name: "Ahoj", slug: "ahoj-alfa" },
		];
		const directory = deriveProjectDirectory(docs);
		// By name (Ahoj before Zebra); equal names fall back to the slug tiebreak.
		expect(directory.map((project) => project.slug)).toEqual(["ahoj-alfa", "ahoj-beta", "zebra"]);
	});

	test("does not mutate its input (pure projection)", () => {
		const docs = [
			{ id: "p-beta", name: "Beta", slug: "beta" },
			{ id: "p-alfa", name: "Alfa", slug: "alfa" },
		];
		const snapshot = JSON.stringify(docs);
		deriveProjectDirectory(docs);
		// Input array order and contents are untouched — the sort runs on a mapped copy.
		expect(JSON.stringify(docs)).toEqual(snapshot);
	});
});
