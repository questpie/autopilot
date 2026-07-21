import type { EnsureQueryDataOptions } from "@tanstack/react-query";

import { createQueryKeys } from "@/lib/data/query-keys";
import type { AppQueryOptions } from "@/lib/query";

// REST-only reads (never open a realtime topic), so they keep the larger roster page
// size — no realtime admission cap applies.
const ACTOR_LIST_LIMIT = 200;
const INVITATION_LIST_LIMIT = 200;

/** Minimal read shapes the roster derivation needs. */
export type RosterActorDoc = {
	id: string;
	name: string;
	kind: "human" | "agent";
	membershipStatus: string;
	setupStatus: string;
};
export type RosterInvitationDoc = {
	id: string;
	email: string;
	status: string;
	expiresAt: string | Date;
	version: number;
};

export type TeamRosterMember = RosterActorDoc & {
	/** Slovak role label the step renders; null renders nothing. */
	roleLabel: string | null;
	/** True for the dormant agent awaiting AI setup — 'Vyžaduje nastavenie'. */
	pendingSetup: boolean;
};
export type TeamRosterInvitation = {
	id: string;
	email: string;
	status: string;
	/** ISO string — serializable through the SSR loader stream. */
	expiresAt: string;
	version: number;
};
export type TeamRoster = {
	members: TeamRosterMember[];
	invitations: TeamRosterInvitation[];
};

/** Server-truth roster projection: actors + pending invitations, nothing faked. */
export function deriveTeamRoster(input: {
	actors: readonly RosterActorDoc[];
	invitations: readonly RosterInvitationDoc[];
	ownerActorId: string | null;
}): TeamRoster {
	return {
		members: input.actors.map((actor) => ({
			...actor,
			roleLabel: actor.id === input.ownerActorId ? "Vlastník" : null,
			pendingSetup: actor.kind === "agent" && actor.setupStatus === "pending_setup",
		})),
		invitations: input.invitations.map((invitation) => ({
			id: invitation.id,
			email: invitation.email,
			status: invitation.status,
			expiresAt: new Date(invitation.expiresAt).toISOString(),
			version: invitation.version,
		})),
	};
}

/**
 * Team feature reads (ADR 0022 / 0023). A single REST-only roster projection: every
 * actor of a company joined with its pending invitations, derived in one cache entry.
 * A 2-collection join, so it stays a `q.custom.query` with a hand-written key (it
 * cannot be a `select` over one live collection arm — see ADR 0022 amendment).
 */
export function createTeamQueries(q: AppQueryOptions) {
	const keys = createQueryKeys(q);
	return {
		/**
		 * Server-truth team roster for a company. The builders' queryFns ignore their
		 * context argument at runtime; the casts bridge the workspace's duplicated
		 * @tanstack/react-query identity (see lib/data/session.ts).
		 */
		roster: (input: {
			companyId: string;
			ownerActorId: string | null;
		}): EnsureQueryDataOptions<TeamRoster> => {
			const actorsFind = q.collections.actors.find({
				where: { company: input.companyId },
				orderBy: { createdAt: "asc" },
				limit: ACTOR_LIST_LIMIT,
			});
			const invitationsFind = q.collections.actor_invitations.find({
				where: { company: input.companyId, status: "pending" },
				orderBy: { createdAt: "asc" },
				limit: INVITATION_LIST_LIMIT,
			});
			const fetchActors = actorsFind.queryFn as unknown as () => Promise<{
				docs: readonly RosterActorDoc[];
			}>;
			const fetchInvitations = invitationsFind.queryFn as unknown as () => Promise<{
				docs: readonly RosterInvitationDoc[];
			}>;
			return q.custom.query({
				key: keys.team.roster(input.companyId),
				queryFn: async (): Promise<TeamRoster> => {
					const [actors, invitations] = await Promise.all([fetchActors(), fetchInvitations()]);
					return deriveTeamRoster({
						actors: actors.docs,
						invitations: invitations.docs,
						ownerActorId: input.ownerActorId,
					});
				},
			}) as unknown as EnsureQueryDataOptions<TeamRoster>;
		},
	};
}
