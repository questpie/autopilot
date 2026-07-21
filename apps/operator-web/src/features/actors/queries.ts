import type { EnsureQueryDataOptions, UseSuspenseQueryOptions } from "@tanstack/react-query";

import {
	asAppQueryOptions,
	type AssertExtends,
	type FindResultOf,
} from "@/lib/data/query-arm-helpers";
import type { AppQueryOptions } from "@/lib/query";

// AGENT_LIST_LIMIT feeds the {realtime:true} LIVE agents arm, so it MUST stay <= the
// realtime admission cap (maxFindLimit, framework default 100 — questpie
// .../server/.../realtime/admission.ts): a live subscription whose topic.limit
// exceeds the cap is rejected NON-retryably and surface-denies the shell. The plain
// and live agent arms share ONE cache key, so they pass IDENTICAL options.
const AGENT_LIST_LIMIT = 100;

/** Minimal per-agent read shape the shell projection needs. */
export type ShellAgentDoc = { kind: string; setupStatus: string };

/**
 * The bounded live-snapshot shape the shell reads from the paired agents find arms
 * (`find` returns `{ docs }`). The plain and live arms of one read carry the same
 * data shape because they hash to one cache entry — only the queryFn differs.
 */
export type AgentsSnapshot = { docs: readonly ShellAgentDoc[] };

// Pin the hand-narrowed AgentsSnapshot to the framework's inferred actors find result:
// renaming/removing a field the shell derive reads (setupStatus) drops it from
// `FindResultOf`, so the real result stops being assignable to the Snapshot and this
// fails to compile — surfacing the drift here instead of silently at runtime.
type _AgentsSnapshotTracksFind = AssertExtends<
	FindResultOf<AppQueryOptions["collections"]["actors"]["find"]>,
	AgentsSnapshot
>;

/**
 * Options for the agents read (actors with `kind:"agent"` — agents are actors, not a
 * separate collection). Module-level and q-free (the `satisfies` is a type-only use of
 * `AppQueryOptions`), so the company shell composite can reuse the SAME options object
 * as the paired plain/live arms — the shared-key invariant means the live arm's
 * admission cap governs both arms' options.
 */
export const agentsOptions = (companyId: string) =>
	({
		where: { company: companyId, kind: "agent" },
		orderBy: { createdAt: "asc" },
		limit: AGENT_LIST_LIMIT,
	}) satisfies Parameters<AppQueryOptions["collections"]["actors"]["find"]>[0];

/**
 * Actors feature reads (ADR 0022 / 0023). The paired plain (`agents`) / live
 * (`agentsLive`) bounded-snapshot arms of the company's agents on ONE cache key. The
 * shell composite derives `autopilotPending` from these client-side.
 */
export function createActorsQueries(q: AppQueryOptions) {
	return {
		/**
		 * Plain arm for loader prefetch — a raw factory the shell projection derives
		 * from. `asAppQueryOptions` bridges the duplicated @tanstack/react-query identity.
		 */
		agents: (companyId: string): EnsureQueryDataOptions<AgentsSnapshot> =>
			asAppQueryOptions<AgentsSnapshot>(q.collections.actors.find(agentsOptions(companyId))),
		/**
		 * Live arm of the SAME agents read: identical options + {realtime:true}, so it
		 * shares one cache entry with `agents` (identical key).
		 */
		agentsLive: (companyId: string): UseSuspenseQueryOptions<AgentsSnapshot> => ({
			...asAppQueryOptions<AgentsSnapshot>(
				q.collections.actors.find(agentsOptions(companyId), { realtime: true }),
			),
			// Open the stream on mount despite the loader-fresh snapshot — see the channels
			// feature for the full staleTime:0 / refetchOnMount rationale.
			staleTime: 0,
			refetchOnMount: "always",
		}),
	};
}
