import type { EnsureQueryDataOptions, UseSuspenseQueryOptions } from "@tanstack/react-query";

import {
	asAppQueryOptions,
	type AssertExtends,
	type FindResultOf,
} from "@/lib/data/query-arm-helpers";
import { createQueryKeys } from "@/lib/data/query-keys";
import type { AppQueryOptions } from "@/lib/query";

// CHANNEL_LIST_LIMIT feeds the {realtime:true} LIVE channels arm, so it MUST stay
// <= the realtime admission cap (maxFindLimit, framework default 100 — questpie
// .../server/.../realtime/admission.ts): a live subscription whose topic.limit
// exceeds the cap is rejected NON-retryably and surface-denies the Space. The plain
// and live channel arms share ONE cache key, so they pass IDENTICAL options — this
// cap is also the plain arm's limit.
const CHANNEL_LIST_LIMIT = 100;

/**
 * Minimal per-channel read shape the directory projection needs. `kind` is a
 * select whose runtime value is "system_default" | "standard"; it is typed `string`
 * here because the framework's inferred find result for a select is assignable to
 * `string`, so the `ChannelsSnapshot` guard below holds without over-narrowing, and
 * `deriveChannelDirectory` re-narrows it.
 */
export type ChannelDirectoryDoc = { id: string; name: string; slug: string; kind: string };

/**
 * The bounded live-snapshot shape the channel directory reads from the paired find
 * arms (`find` returns `{ docs }`). The plain and live arms of one read carry the
 * same data shape because they hash to one cache entry — only the queryFn differs.
 */
export type ChannelsSnapshot = { docs: readonly ChannelDirectoryDoc[] };

// Pin the hand-narrowed ChannelsSnapshot to the framework's inferred channels find
// result: renaming/removing a field the derive reads (name / slug / kind) drops it
// from `FindResultOf`, so the real result stops being assignable to the Snapshot and
// this fails to compile — surfacing the drift here instead of silently inside the
// derive at runtime.
type _ChannelsSnapshotTracksFind = AssertExtends<
	FindResultOf<AppQueryOptions["collections"]["channels"]["find"]>,
	ChannelsSnapshot
>;

/** A directory view of a channel — persisted fields only. */
export type ChannelSummary = {
	id: string;
	name: string;
	slug: string;
	/** True for the seeded, protected per-Space #general anchor (kind:"system_default"). */
	isSystemDefault: boolean;
};

/**
 * PURE channel directory projection (ADR 0022 decompose pattern): active channels
 * mapped to `ChannelSummary`, the #general system_default anchor first, then standard
 * channels by Slovak-collated name with a slug tiebreak for a stable order. Run
 * client-side over a bounded live snapshot (the Space detail route re-derives it in a
 * `useMemo` off `channels.visibleLive`) so the directory stays LIVE without a second
 * server projection. The plain `directory` arm reuses this same function.
 */
export function deriveChannelDirectory(docs: readonly ChannelDirectoryDoc[]): ChannelSummary[] {
	return docs
		.map((channel) => ({
			id: channel.id,
			name: channel.name,
			slug: channel.slug,
			isSystemDefault: channel.kind === "system_default",
		}))
		.sort((a, b) => {
			if (a.isSystemDefault !== b.isSystemDefault) return a.isSystemDefault ? -1 : 1;
			const byName = a.name.localeCompare(b.name, "sk");
			return byName !== 0 ? byName : a.slug.localeCompare(b.slug, "sk");
		});
}

/**
 * Channels feature reads (ADR 0022 / 0023). Space-scoped bounded live snapshot with
 * paired plain (`visible`) / live (`visibleLive`) arms on ONE cache key, plus the
 * request-scoped `directory` projection reusing the pure derive above.
 */
export function createChannelsQueries(q: AppQueryOptions) {
	const keys = createQueryKeys(q);
	// SPACE-SCOPED (channels.read is `{ space: { in: organizationScope.spaceIds } }`):
	// feeds BOTH the plain and live arms, so its limit is the realtime-capped
	// CHANNEL_LIST_LIMIT (<= maxFindLimit). Realtime admission never inspects `where`
	// (only operation/limit/relation depth — admission.ts), so this space-scoped find
	// is admitted exactly like the spaces arm.
	const channelsOptions = (spaceId: string) =>
		({
			where: { space: spaceId, status: "active" },
			orderBy: { name: "asc" },
			limit: CHANNEL_LIST_LIMIT,
		}) satisfies Parameters<typeof q.collections.channels.find>[0];

	return {
		/**
		 * Plain bounded snapshot for loader prefetch (ensureQueryData, SSR-safe).
		 * SPACE-SCOPED. `asAppQueryOptions` bridges the workspace's duplicated
		 * @tanstack/react-query identity; the `ChannelsSnapshot` annotation is pinned to
		 * the real find result by the FindResultOf guard.
		 */
		visible: (spaceId: string): EnsureQueryDataOptions<ChannelsSnapshot> =>
			asAppQueryOptions<ChannelsSnapshot>(q.collections.channels.find(channelsOptions(spaceId))),
		/**
		 * Live arm of the SAME read: identical options + {realtime:true}. Shares one
		 * cache entry with `visible` (identical key), so the loader static-load hydrates
		 * and the component's useSuspenseQuery upgrades it to a stream. A channel created
		 * in this Space arrives on the stream and reconciles by identity into this ONE
		 * entry — no invalidate, no frozen loader read.
		 */
		visibleLive: (spaceId: string): UseSuspenseQueryOptions<ChannelsSnapshot> => ({
			...asAppQueryOptions<ChannelsSnapshot>(
				q.collections.channels.find(channelsOptions(spaceId), { realtime: true }),
			),
			// Open the stream on mount despite the loader-fresh snapshot: refetchOnMount
			// "always" short-circuits the isStale gate so the streamed queryFn runs and
			// subscribes; data is present so useSuspenseQuery does NOT re-suspend, and
			// refetchMode:"append" keeps the hydrated snapshot visible.
			staleTime: 0,
			refetchOnMount: "always",
		}),
		/**
		 * Directory projection: active channels, #general first. Plain request-scoped
		 * read reusing the SAME pure `deriveChannelDirectory` the LIVE route derives
		 * client-side off `visibleLive`, so both paths share one projection.
		 */
		directory: (spaceId: string): EnsureQueryDataOptions<ChannelSummary[]> => {
			const find = q.collections.channels.find(channelsOptions(spaceId));
			const fetchChannels = find.queryFn as unknown as () => Promise<{
				docs: readonly ChannelDirectoryDoc[];
			}>;
			return q.custom.query({
				key: keys.channels.directory(spaceId),
				queryFn: async (): Promise<ChannelSummary[]> =>
					deriveChannelDirectory((await fetchChannels()).docs),
			}) as unknown as EnsureQueryDataOptions<ChannelSummary[]>;
		},
	};
}
