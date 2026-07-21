import type { EnsureQueryDataOptions } from "@tanstack/react-query";

import { createQueryKeys } from "@/lib/data/query-keys";
import type { AppQueryOptions } from "@/lib/query";

// REST-only reads (never open a realtime topic), so they keep the larger page size.
const ACTOR_LIST_LIMIT = 200;
const ACTIVITY_LIST_LIMIT = 200;

/** Slovak labels for the verbs F01 actually persists — no verb is invented. */
export const ACTIVITY_VERB_LABELS: Record<string, string> = {
	"company.bootstrapped": "Spoločnosť spustená",
	"space.created": "Priestor vytvorený",
};

export type ActivityEventDoc = {
	id: string;
	verb: string;
	actor: string;
	createdAt: string | Date;
};
export type ActivityRow = {
	id: string;
	/** The acting Actor's name, resolved from the company roster. */
	actorName: string;
	/** Slovak label for the verb; the raw verb when no label is registered. */
	verbLabel: string;
	at: string;
};

export function deriveActivityFeed(input: {
	events: readonly ActivityEventDoc[];
	actors: readonly { id: string; name: string }[];
}): ActivityRow[] {
	const nameById = new Map(input.actors.map((actor) => [actor.id, actor.name]));
	return input.events.map((event) => ({
		id: event.id,
		actorName: nameById.get(event.actor) ?? "Neznámy aktér",
		verbLabel: ACTIVITY_VERB_LABELS[event.verb] ?? event.verb,
		at: new Date(event.createdAt).toISOString(),
	}));
}

/**
 * Activity feature reads (ADR 0022 / 0023). The feed joins persisted activity events
 * to Actor names in one REST-only cache entry, so it remains a `q.custom.query` with
 * a hand-written key rather than a `select` over one collection arm.
 */
export function createActivityQueries(q: AppQueryOptions) {
	const keys = createQueryKeys(q);
	return {
		/** Company activity feed: persisted events joined to Actor names, newest first. */
		feed: (companyId: string): EnsureQueryDataOptions<ActivityRow[]> => {
			const eventsFind = q.collections.activity_events.find({
				where: { company: companyId },
				orderBy: { createdAt: "desc" },
				limit: ACTIVITY_LIST_LIMIT,
			});
			const actorsFind = q.collections.actors.find({
				where: { company: companyId },
				orderBy: { createdAt: "asc" },
				limit: ACTOR_LIST_LIMIT,
			});
			const fetchEvents = eventsFind.queryFn as unknown as () => Promise<{
				docs: readonly ActivityEventDoc[];
			}>;
			const fetchActors = actorsFind.queryFn as unknown as () => Promise<{
				docs: readonly { id: string; name: string }[];
			}>;
			return q.custom.query({
				key: keys.activity.feed(companyId),
				queryFn: async (): Promise<ActivityRow[]> => {
					const [events, actors] = await Promise.all([fetchEvents(), fetchActors()]);
					return deriveActivityFeed({ events: events.docs, actors: actors.docs });
				},
			}) as unknown as EnsureQueryDataOptions<ActivityRow[]>;
		},
	};
}
