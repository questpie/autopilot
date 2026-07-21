import type { EnsureQueryDataOptions, UseSuspenseQueryOptions } from "@tanstack/react-query";

import {
	asAppQueryOptions,
	type AssertExtends,
	type FindResultOf,
} from "@/lib/data/query-arm-helpers";
import { createQueryKeys } from "@/lib/data/query-keys";
import type { AppQueryOptions } from "@/lib/query";

// PROJECT_LIST_LIMIT feeds the {realtime:true} LIVE projects arm, so it MUST stay
// <= the realtime admission cap (maxFindLimit, framework default 100 — questpie
// .../server/.../realtime/admission.ts): a live subscription whose topic.limit
// exceeds the cap is rejected NON-retryably and surface-denies the Space. The plain
// and live project arms share ONE cache key, so they pass IDENTICAL options — this
// cap is also the plain arm's limit.
const PROJECT_LIST_LIMIT = 100;

/**
 * Minimal per-project read shape the directory projection needs. Projects are the
 * space-scoped sibling of channels but carry NO `kind` discriminator (no
 * system_default anchor), so the shape is just the persisted identity fields the
 * derive orders and renders.
 */
export type ProjectDirectoryDoc = { id: string; name: string; slug: string };

/**
 * The bounded live-snapshot shape the project directory reads from the paired find
 * arms (`find` returns `{ docs }`). The plain and live arms of one read carry the
 * same data shape because they hash to one cache entry — only the queryFn differs.
 */
export type ProjectsSnapshot = { docs: readonly ProjectDirectoryDoc[] };

// Pin the hand-narrowed ProjectsSnapshot to the framework's inferred projects find
// result: renaming/removing a field the derive reads (name / slug) drops it from
// `FindResultOf`, so the real result stops being assignable to the Snapshot and this
// fails to compile — surfacing the drift here instead of silently inside the derive
// at runtime.
type _ProjectsSnapshotTracksFind = AssertExtends<
	FindResultOf<AppQueryOptions["collections"]["projects"]["find"]>,
	ProjectsSnapshot
>;

/** A directory view of a project — persisted fields only. */
export type ProjectSummary = {
	id: string;
	name: string;
	slug: string;
};

/**
 * PURE project directory projection (ADR 0022 decompose pattern), the space-scoped
 * mirror of `deriveChannelDirectory`: active projects mapped to `ProjectSummary`,
 * ordered by Slovak-collated name with a slug tiebreak for a stable order. Projects
 * have NO system_default anchor (unlike channels' #general), so there is no
 * anchor-first split — just name then slug. Run client-side over a bounded live
 * snapshot (the Space detail route re-derives it in a `useMemo` off `visibleLive`) so
 * the directory stays LIVE without a second server projection. The plain `directory`
 * arm reuses this same function.
 */
export function deriveProjectDirectory(docs: readonly ProjectDirectoryDoc[]): ProjectSummary[] {
	return docs
		.map((project) => ({
			id: project.id,
			name: project.name,
			slug: project.slug,
		}))
		.sort((a, b) => {
			const byName = a.name.localeCompare(b.name, "sk");
			return byName !== 0 ? byName : a.slug.localeCompare(b.slug, "sk");
		});
}

/**
 * Projects feature reads (ADR 0022 / 0023). Space-scoped bounded live snapshot with
 * paired plain (`visible`) / live (`visibleLive`) arms on ONE cache key, plus the
 * request-scoped `directory` projection reusing the pure derive above. The direct
 * mirror of the channels feature, minus the system_default anchor.
 */
export function createProjectsQueries(q: AppQueryOptions) {
	const keys = createQueryKeys(q);
	// SPACE-SCOPED (projects.read is `{ space: { in: organizationScope.spaceIds } }`),
	// the exact mirror of channelsOptions: feeds BOTH arms, so its limit is the
	// realtime-capped PROJECT_LIST_LIMIT (<= maxFindLimit). Realtime admission never
	// inspects `where` (only operation/limit/relation depth — admission.ts).
	const projectsOptions = (spaceId: string) =>
		({
			where: { space: spaceId, status: "active" },
			orderBy: { name: "asc" },
			limit: PROJECT_LIST_LIMIT,
		}) satisfies Parameters<typeof q.collections.projects.find>[0];

	return {
		/**
		 * Plain bounded snapshot for loader prefetch (ensureQueryData, SSR-safe).
		 * SPACE-SCOPED. `asAppQueryOptions` bridges the duplicated @tanstack/react-query
		 * identity; the `ProjectsSnapshot` annotation is pinned to the real find result
		 * by the FindResultOf guard.
		 */
		visible: (spaceId: string): EnsureQueryDataOptions<ProjectsSnapshot> =>
			asAppQueryOptions<ProjectsSnapshot>(q.collections.projects.find(projectsOptions(spaceId))),
		/**
		 * Live arm of the SAME read: identical options + {realtime:true}. Shares one
		 * cache entry with `visible` (identical key), so the loader static-load hydrates
		 * and the component's useSuspenseQuery upgrades it to a stream. A project created
		 * in this Space arrives on the stream and reconciles by identity into this ONE
		 * entry — no invalidate, no frozen loader read.
		 */
		visibleLive: (spaceId: string): UseSuspenseQueryOptions<ProjectsSnapshot> => ({
			...asAppQueryOptions<ProjectsSnapshot>(
				q.collections.projects.find(projectsOptions(spaceId), { realtime: true }),
			),
			// Open the stream on mount despite the loader-fresh snapshot — see the channels
			// feature for the full staleTime:0 / refetchOnMount rationale.
			staleTime: 0,
			refetchOnMount: "always",
		}),
		/**
		 * Directory projection: active projects by name. Plain request-scoped read
		 * reusing the SAME pure `deriveProjectDirectory` the LIVE route derives
		 * client-side off `visibleLive`, so both paths share one projection.
		 */
		directory: (spaceId: string): EnsureQueryDataOptions<ProjectSummary[]> => {
			const find = q.collections.projects.find(projectsOptions(spaceId));
			const fetchProjects = find.queryFn as unknown as () => Promise<{
				docs: readonly ProjectDirectoryDoc[];
			}>;
			return q.custom.query({
				key: keys.projects.directory(spaceId),
				queryFn: async (): Promise<ProjectSummary[]> =>
					deriveProjectDirectory((await fetchProjects()).docs),
			}) as unknown as EnsureQueryDataOptions<ProjectSummary[]>;
		},
	};
}
