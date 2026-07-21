import type { EnsureQueryDataOptions, UseSuspenseQueryOptions } from "@tanstack/react-query";

import {
	asAppQueryOptions,
	type AssertExtends,
	type FindResultOf,
} from "@/lib/data/query-arm-helpers";
import { createQueryKeys } from "@/lib/data/query-keys";
import type { AppQueryOptions } from "@/lib/query";

// SPACE_LIST_LIMIT feeds the {realtime:true} LIVE spaces arm, so it MUST stay <= the
// realtime admission cap (maxFindLimit, framework default 100 — questpie
// .../server/.../realtime/admission.ts). The server rejects a live subscription whose
// topic.limit exceeds the cap with a NON-retryable rejection, which surface-denies the
// whole shell. The plain and live arms share ONE cache key, so they pass IDENTICAL
// options — this cap is also the paired plain arm's limit.
const SPACE_LIST_LIMIT = 100;

/** Minimal per-space read shape the shell projection needs. */
export type ShellSpaceDoc = { id: string; name: string; slug: string; isWholeCompany: boolean };

/**
 * The bounded live-snapshot shape the shell reads from the paired spaces find arms
 * (`find` returns `{ docs }`). The plain and live arms of one read carry the same data
 * shape because they hash to one cache entry — only the queryFn differs.
 */
export type SpacesSnapshot = { docs: readonly ShellSpaceDoc[] };

// Pin the hand-narrowed SpacesSnapshot to the framework's inferred spaces find result:
// renaming/removing a field the shell/directory derives read (isWholeCompany / slug /
// name) drops it from `FindResultOf`, so the real result stops being assignable to the
// Snapshot and this fails to compile — surfacing the drift here instead of at runtime.
type _SpacesSnapshotTracksFind = AssertExtends<
	FindResultOf<AppQueryOptions["collections"]["spaces"]["find"]>,
	SpacesSnapshot
>;

/** A directory/overview view of a space — persisted fields only. */
export type SpaceSummary = {
	id: string;
	name: string;
	slug: string;
	isWholeCompany: boolean;
	description: string | null;
};

/**
 * The per-space fields the directory projection reads. It is exactly the shell's
 * `ShellSpaceDoc` plus the optional `description` — so the SAME bounded live snapshot
 * the shell subscribes to (`visibleLive`, typed `SpacesSnapshot`) feeds this derive
 * unchanged: `ShellSpaceDoc` is assignable here because `description` is optional, and
 * at runtime the full find result carries it.
 */
export type SpaceDirectoryDoc = ShellSpaceDoc & { description?: string | null };

/**
 * PURE directory projection (ADR 0022 decompose pattern): active spaces mapped to
 * `SpaceSummary`, Whole Company first then by Slovak-collated name. Run client-side
 * over a bounded live snapshot (the route re-derives it in a `useMemo` off
 * `visibleLive`) so the directory stays LIVE without a second server projection. The
 * plain `directory` arm reuses this same function for its request-scoped read.
 */
export function deriveSpaceDirectory(docs: readonly SpaceDirectoryDoc[]): SpaceSummary[] {
	return docs
		.map((space) => ({
			id: space.id,
			name: space.name,
			slug: space.slug,
			isWholeCompany: space.isWholeCompany,
			description: space.description ?? null,
		}))
		.sort((a, b) => {
			if (a.isWholeCompany !== b.isWholeCompany) return a.isWholeCompany ? -1 : 1;
			return a.name.localeCompare(b.name, "sk");
		});
}

/**
 * Options for the visible-spaces read. Module-level and q-free (the `satisfies` is a
 * type-only use of `AppQueryOptions`), so the company shell composite can reuse the
 * SAME options object as the paired plain/live arms — the shared-key invariant means
 * the live arm's admission cap governs both arms' options.
 */
export const spacesVisibleOptions = (companyId: string) =>
	({
		where: { company: companyId, status: "active" },
		orderBy: { name: "asc" },
		limit: SPACE_LIST_LIMIT,
	}) satisfies Parameters<AppQueryOptions["collections"]["spaces"]["find"]>[0];

/**
 * Spaces feature reads (ADR 0022 / 0023). Paired plain (`visible`) / live
 * (`visibleLive`) bounded-snapshot arms of the company's active spaces on ONE cache
 * key, plus the request-scoped `directory` projection reusing the pure derive above.
 * The shell composite derives its nav from the same `spacesVisibleOptions` read.
 */
export function createSpacesQueries(q: AppQueryOptions) {
	const keys = createQueryKeys(q);
	return {
		/**
		 * Plain bounded snapshot for loader prefetch (ensureQueryData, SSR-safe).
		 * `asAppQueryOptions` bridges the duplicated @tanstack/react-query identity; the
		 * `SpacesSnapshot` annotation is pinned to the real find result by the FindResultOf
		 * guard.
		 */
		visible: (companyId: string): EnsureQueryDataOptions<SpacesSnapshot> =>
			asAppQueryOptions<SpacesSnapshot>(q.collections.spaces.find(spacesVisibleOptions(companyId))),
		/**
		 * Live arm of the SAME read: identical options + {realtime:true}. Shares one cache
		 * entry with `visible` (identical key), so the loader static-load hydrates and the
		 * component's useSuspenseQuery upgrades it to a stream.
		 */
		visibleLive: (companyId: string): UseSuspenseQueryOptions<SpacesSnapshot> => ({
			...asAppQueryOptions<SpacesSnapshot>(
				q.collections.spaces.find(spacesVisibleOptions(companyId), { realtime: true }),
			),
			// Open the stream on mount despite the loader-fresh snapshot: refetchOnMount
			// "always" short-circuits the isStale gate so the streamed queryFn runs and
			// subscribes; data is present so useSuspenseQuery does NOT re-suspend, and
			// refetchMode:"append" keeps the hydrated snapshot visible. staleTime:Infinity
			// would leave the seeded data non-stale and the stream would never open.
			staleTime: 0,
			refetchOnMount: "always",
		}),
		/**
		 * Directory/overview projection: active spaces, Whole Company first. Plain
		 * request-scoped read for the `$spaceSlug` slug→space resolve. The LIVE directory
		 * route does NOT read this — it derives the SAME projection client-side off
		 * `visibleLive` via `deriveSpaceDirectory`, which this arm reuses so both paths
		 * share one projection.
		 */
		directory: (companyId: string): EnsureQueryDataOptions<SpaceSummary[]> => {
			const find = q.collections.spaces.find(spacesVisibleOptions(companyId));
			const fetchSpaces = find.queryFn as unknown as () => Promise<{
				docs: readonly SpaceDirectoryDoc[];
			}>;
			return q.custom.query({
				key: keys.spaces.directory(companyId),
				queryFn: async (): Promise<SpaceSummary[]> =>
					deriveSpaceDirectory((await fetchSpaces()).docs),
			}) as unknown as EnsureQueryDataOptions<SpaceSummary[]>;
		},
	};
}
