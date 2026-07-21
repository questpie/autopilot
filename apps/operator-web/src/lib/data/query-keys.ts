import type { QueryKey } from "@tanstack/react-query";

import type { AppQueryOptions } from "@/lib/query";

/**
 * Typed query-key factory — the single owner of this app's key vocabulary
 * (ADR 0022). No feature module handwrites a key segment; every `q.custom.query`
 * key and every invalidation target flows from here.
 *
 * Two forms, one framework rule. `@questpie/tanstack-query` prepends the
 * configured `keyPrefix` (`["autopilot-v2"]`) both to its own collection reads
 * AND inside `q.custom.query({ key })` (index.ts:522,1211):
 *
 *   - SEGMENT builders return RAW, un-prefixed parts (`company.shell(id)` =>
 *     `["company","shell",id]`). They feed `q.custom.query({ key })`, which
 *     prepends the prefix itself, so they are behaviour-preserving drop-ins for
 *     the literals previously inlined in feature-queries.ts / session.ts.
 *   - COLLECTION prefixes and consistency-group fan-outs return FULLY-QUALIFIED
 *     keys (via `q.key`), because they are `invalidateQueries` targets that
 *     prefix-match the real `["autopilot-v2", …]` entries in the cache.
 *
 * Consistency-group fan-outs name the reads whose truth spans BOTH namespaces —
 * framework-generated collection reads (`collections.*`) and app projections
 * (`q.custom.query`) — since one prefix cannot span the two. Agents are the
 * `actors` collection with `kind:"agent"` (there is no `agents` collection), so
 * `onAgentChange` fans out over `keys.collection("actors")`; a
 * `keys.collection("agents")` would prefix-match zero cached queries and
 * silently leave the actors read stale.
 */
export function createQueryKeys(q: AppQueryOptions) {
	/** Wrap raw parts into the fully-qualified cache key (adds the shared prefix). */
	const qualify = (parts: QueryKey): QueryKey => q.key(parts);

	// ── Raw segment vocabulary — consumed by q.custom.query({ key }), which
	//    prepends the prefix. These mirror the pre-factory inline literals 1:1.
	const company = {
		shell: (companyId: string): QueryKey => ["company", "shell", companyId],
		resolve: (slug: string): QueryKey => ["company", "resolve", slug],
	};
	const team = {
		roster: (companyId: string): QueryKey => ["team", "roster", companyId],
	};
	const spaces = {
		directory: (companyId: string): QueryKey => ["spaces", "directory", companyId],
	};
	// Channels are SPACE-SCOPED, so the directory projection key is keyed by spaceId
	// (not companyId) — one directory entry per Space.
	const channels = {
		directory: (spaceId: string): QueryKey => ["channels", "directory", spaceId],
	};
	const activity = {
		feed: (companyId: string): QueryKey => ["activity", "feed", companyId],
	};
	const onboarding = {
		state: (): QueryKey => ["onboarding", "state"],
	};
	const session = (): QueryKey => ["auth", "get-session"];

	/**
	 * Fully-qualified collection prefix. `invalidateQueries({ queryKey })` prefix-
	 * matches this against every find/count of the collection regardless of
	 * locale / stage / options (framework key shape index.ts:639-645).
	 */
	const collection = (name: string): QueryKey => qualify(["collections", name]);

	return {
		collection,
		company,
		team,
		spaces,
		channels,
		activity,
		onboarding,
		session,
		/**
		 * A Space changed: refetch the raw spaces collection AND the derived
		 * projections a live snapshot cannot cover (shell nav, spaces directory).
		 */
		onSpaceChange: (companyId: string): QueryKey[] => [
			collection("spaces"),
			qualify(company.shell(companyId)),
			qualify(spaces.directory(companyId)),
		],
		/**
		 * A Channel changed: refetch the raw channels collection AND the derived
		 * channel-directory projection for its Space. Channels are SPACE-SCOPED, so the
		 * directory target is keyed by spaceId. Vocabulary ONLY (ADR 0022) — inc6 owns
		 * the reconciler that fans this out on a channel write; the LIVE directory arm
		 * already reconciles by identity off the stream, so no reconciler exists yet.
		 */
		onChannelChange: (spaceId: string): QueryKey[] => [
			collection("channels"),
			qualify(channels.directory(spaceId)),
		],
		/**
		 * An Agent (an actor with kind:"agent") changed: refetch the actors
		 * collection AND the shell + roster projections. Actors, NOT agents —
		 * see the module note.
		 */
		onAgentChange: (companyId: string): QueryKey[] => [
			collection("actors"),
			qualify(company.shell(companyId)),
			qualify(team.roster(companyId)),
		],
		/**
		 * An activity event landed: refetch the events collection AND the derived
		 * activity-feed projection.
		 */
		onActivityChange: (companyId: string): QueryKey[] => [
			collection("activity_events"),
			qualify(activity.feed(companyId)),
		],
	};
}

export type QueryKeys = ReturnType<typeof createQueryKeys>;
