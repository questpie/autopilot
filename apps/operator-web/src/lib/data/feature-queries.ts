import type { EnsureQueryDataOptions, UseSuspenseQueryOptions } from "@tanstack/react-query";

import type { NavSpace } from "@/lib/navigation/company-nav";
import {
	asAppQueryOptions,
	type AssertExtends,
	type FindResultOf,
	isAccessDenied,
} from "@/lib/data/query-arm-helpers";
import { createQueryKeys } from "@/lib/data/query-keys";
import type { AppQueryOptions } from "@/lib/query";

const COMPANY_LIST_LIMIT = 50;
// SPACE_LIST_LIMIT and AGENT_LIST_LIMIT feed the {realtime:true} LIVE arms, so
// both MUST stay <= the realtime admission cap (maxFindLimit, framework default
// 100 — questpie .../server/.../realtime/admission.ts). The server rejects a live
// subscription whose topic.limit exceeds the cap with a NON-retryable rejection
// (admission.ts: `limit > maxFindLimit`), which surfaces on the shared cache entry
// and surface-denies the whole shell. Because the plain and live arms of one read
// share ONE cache key, they pass IDENTICAL options — so the live arm's cap is also
// the paired plain arm's limit.
const SPACE_LIST_LIMIT = 100;
const AGENT_LIST_LIMIT = 100;
// CHANNEL_LIST_LIMIT feeds the {realtime:true} LIVE channels arm exactly as
// SPACE_LIST_LIMIT feeds spaces, so it MUST stay <= the realtime admission cap
// (maxFindLimit, framework default 100 — questpie .../server/.../realtime/admission.ts):
// a live subscription whose topic.limit exceeds the cap is rejected NON-retryably
// and surface-denies the Space. The plain and live channel arms share ONE cache
// key, so they pass IDENTICAL options — this cap is also the plain arm's limit.
const CHANNEL_LIST_LIMIT = 100;
// PROJECT_LIST_LIMIT feeds the {realtime:true} LIVE projects arm exactly as
// CHANNEL_LIST_LIMIT feeds channels, so it MUST stay <= the realtime admission cap
// (maxFindLimit, framework default 100 — questpie .../server/.../realtime/admission.ts):
// a live subscription whose topic.limit exceeds the cap is rejected NON-retryably
// and surface-denies the Space. The plain and live project arms share ONE cache
// key, so they pass IDENTICAL options — this cap is also the plain arm's limit.
const PROJECT_LIST_LIMIT = 100;
// REST-only reads (roster, activity, shell-composite actor joins) never open a
// realtime topic, so they keep the larger roster page size.
const ACTOR_LIST_LIMIT = 200;
const INVITATION_LIST_LIMIT = 200;
const ACTIVITY_LIST_LIMIT = 200;

/** Minimal read shape the onboarding derivation needs from a visible company. */
export type VisibleCompany = {
	id: string;
	name: string;
	slug: string;
	createdByActor?: string | null;
};

/**
 * Truth-derived onboarding state v1: bootstrap completion IS having a visible
 * company — no persisted wizard stage exists (SPEC 12 has no such write).
 */
export type OnboardingState = {
	hasCompany: boolean;
	companyId: string | null;
	companySlug: string | null;
	companyName: string | null;
	/** The bootstrap owner actor (companies.createdByActor) — drives the roster's role label. */
	ownerActorId: string | null;
};

export function deriveOnboardingState(companies: {
	docs: readonly VisibleCompany[];
}): OnboardingState {
	const first = companies.docs[0] ?? null;
	return {
		hasCompany: first !== null,
		companyId: first?.id ?? null,
		companySlug: first?.slug ?? null,
		companyName: first?.name ?? null,
		ownerActorId: first?.createdByActor ?? null,
	};
}

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

/** Minimal read shapes the shell projection needs. */
export type ShellSpaceDoc = { id: string; name: string; slug: string; isWholeCompany: boolean };
export type ShellAgentDoc = { kind: string; setupStatus: string };

/**
 * The bounded live-snapshot shapes the shell reads from the paired find arms
 * (`find` returns `{ docs }`). The plain and live arms of one read carry the same
 * data shape because they hash to one cache entry — only the queryFn differs.
 */
export type SpacesSnapshot = { docs: readonly ShellSpaceDoc[] };
export type AgentsSnapshot = { docs: readonly ShellAgentDoc[] };

// Return-type safety the per-arm `as unknown as ...<Snapshot>` casts used to throw
// away: pin each raw arm's hand-narrowed Snapshot to the framework's inferred find
// result. Renaming/removing a field the shell derivations read (isWholeCompany /
// slug / name, setupStatus) drops it from `FindResultOf`, so the real result stops
// being assignable to the Snapshot and these fail to compile — surfacing the drift
// here instead of silently inside `deriveCompanyShell` at runtime.
type _SpacesSnapshotTracksFind = AssertExtends<
	FindResultOf<AppQueryOptions["collections"]["spaces"]["find"]>,
	SpacesSnapshot
>;
type _AgentsSnapshotTracksFind = AssertExtends<
	FindResultOf<AppQueryOptions["collections"]["actors"]["find"]>,
	AgentsSnapshot
>;

/** What the adaptive shell derives from server truth for its one nav config. */
export type CompanyShellProjection = {
	spaces: NavSpace[];
	/** True while any agent (the Autopilot) still awaits provider setup. */
	autopilotPending: boolean;
};

export function deriveCompanyShell(input: {
	spaces: readonly ShellSpaceDoc[];
	agents: readonly ShellAgentDoc[];
}): CompanyShellProjection {
	return {
		spaces: input.spaces.map((space) => ({
			slug: space.slug,
			name: space.name,
			isWholeCompany: space.isWholeCompany,
		})),
		autopilotPending: input.agents.some((agent) => agent.setupStatus === "pending_setup"),
	};
}

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
 * `ShellSpaceDoc` plus the optional `description` — so the SAME bounded live
 * snapshot the shell subscribes to (`spaces.visibleLive`, typed `SpacesSnapshot`)
 * feeds this derive unchanged: `ShellSpaceDoc` is assignable here because
 * `description` is optional, and at runtime the full find result carries it.
 */
export type SpaceDirectoryDoc = ShellSpaceDoc & { description?: string | null };

/**
 * PURE directory projection (ADR 0022 decompose pattern): active spaces mapped to
 * `SpaceSummary`, Whole Company first then by Slovak-collated name. Run this
 * client-side over a bounded live snapshot (the route re-derives it in a `useMemo`
 * off `spaces.visibleLive`), exactly as the shell re-runs `deriveCompanyShell` —
 * so the directory stays LIVE without a second server projection. The plain
 * `spaces.directory` arm reuses this same function for its request-scoped read.
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
 * Minimal per-channel read shape the directory projection needs. `kind` is a
 * select whose runtime value is "system_default" | "standard"; it is typed `string`
 * here for the same reason `ShellAgentDoc.kind` is — the framework's inferred find
 * result for a select is assignable to `string`, so the `ChannelsSnapshot` guard
 * below holds without over-narrowing, and `deriveChannelDirectory` re-narrows it.
 */
export type ChannelDirectoryDoc = { id: string; name: string; slug: string; kind: string };

/**
 * The bounded live-snapshot shape the channel directory reads from the paired find
 * arms (`find` returns `{ docs }`). The plain and live arms of one read carry the
 * same data shape because they hash to one cache entry — only the queryFn differs.
 */
export type ChannelsSnapshot = { docs: readonly ChannelDirectoryDoc[] };

// Pin the hand-narrowed ChannelsSnapshot to the framework's inferred channels find
// result, exactly as the spaces/agents snapshots are pinned: renaming/removing a
// field the derive reads (name / slug / kind) drops it from `FindResultOf`, so the
// real result stops being assignable to the Snapshot and this fails to compile —
// surfacing the drift here instead of silently inside the derive at runtime.
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
 * PURE channel directory projection (ADR 0022 decompose pattern), the space-scoped
 * mirror of `deriveSpaceDirectory`: active channels mapped to `ChannelSummary`, the
 * #general system_default anchor first (as Whole Company is first for spaces), then
 * standard channels by Slovak-collated name with a slug tiebreak for a stable order.
 * Run client-side over a bounded live snapshot (the Space detail route re-derives it
 * in a `useMemo` off `channels.visibleLive`), exactly as the shell re-runs
 * `deriveCompanyShell` — so the directory stays LIVE without a second server
 * projection. The plain `channels.directory` arm reuses this same function.
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
// result, exactly as the channels snapshot is pinned: renaming/removing a field the
// derive reads (name / slug) drops it from `FindResultOf`, so the real result stops
// being assignable to the Snapshot and this fails to compile — surfacing the drift
// here instead of silently inside the derive at runtime.
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
 * snapshot (the Space detail route re-derives it in a `useMemo` off
 * `projects.visibleLive`), exactly as the channel directory re-runs
 * `deriveChannelDirectory` — so the directory stays LIVE without a second server
 * projection. The plain `projects.directory` arm reuses this same function.
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

export function createFeatureQueries(q: AppQueryOptions) {
	const keys = createQueryKeys(q);

	// The factory owns each read's options + limit + {realtime} decision. The
	// plain (loader-prefetch) and live (component) arms of one logical read pass
	// the SAME options object, so they hash to ONE query key with different
	// queryFns — the framework computes the key before the realtime branch and
	// never puts the {realtime} config in the key (index.ts:639-647). `satisfies`
	// keeps the literal option types the typed `find` requires.
	const spacesVisibleOptions = (companyId: string) =>
		({
			where: { company: companyId, status: "active" },
			orderBy: { name: "asc" },
			limit: SPACE_LIST_LIMIT,
		}) satisfies Parameters<typeof q.collections.spaces.find>[0];
	// Feeds BOTH the plain `agents` and the live `agentsLive` arm, so its limit is
	// the realtime-capped AGENT_LIST_LIMIT (<= maxFindLimit): the shared-key
	// invariant means the live arm's admission cap governs both arms' options.
	const agentsOptions = (companyId: string) =>
		({
			where: { company: companyId, kind: "agent" },
			orderBy: { createdAt: "asc" },
			limit: AGENT_LIST_LIMIT,
		}) satisfies Parameters<typeof q.collections.actors.find>[0];
	// SPACE-SCOPED (channels.read is `{ space: { in: organizationScope.spaceIds } }`):
	// feeds BOTH the plain `channels.visible` and the live `channels.visibleLive` arm,
	// so its limit is the realtime-capped CHANNEL_LIST_LIMIT (<= maxFindLimit). The
	// realtime admission never inspects `where` (only operation/limit/relation depth —
	// admission.ts), so this space-scoped find is admitted exactly like the spaces arm.
	const channelsOptions = (spaceId: string) =>
		({
			where: { space: spaceId, status: "active" },
			orderBy: { name: "asc" },
			limit: CHANNEL_LIST_LIMIT,
		}) satisfies Parameters<typeof q.collections.channels.find>[0];
	// SPACE-SCOPED (projects.read is `{ space: { in: organizationScope.spaceIds } }`),
	// the exact mirror of channelsOptions: feeds BOTH the plain `projects.visible` and
	// the live `projects.visibleLive` arm, so its limit is the realtime-capped
	// PROJECT_LIST_LIMIT (<= maxFindLimit). Realtime admission never inspects `where`
	// (only operation/limit/relation depth — admission.ts), so this space-scoped find
	// is admitted exactly like the channels arm.
	const projectsOptions = (spaceId: string) =>
		({
			where: { space: spaceId, status: "active" },
			orderBy: { name: "asc" },
			limit: PROJECT_LIST_LIMIT,
		}) satisfies Parameters<typeof q.collections.projects.find>[0];

	const companiesVisible = () =>
		q.collections.companies.find({
			where: { status: "active" },
			orderBy: { name: "asc" },
			limit: COMPANY_LIST_LIMIT,
		});

	return {
		companies: {
			visible: companiesVisible,
		},
		onboarding: {
			/**
			 * Onboarding-state query: same companies.visible read, derived shape,
			 * own cache entry. Casts bridge the workspace's duplicated
			 * @tanstack/react-query identity (see the note in lib/data/session.ts);
			 * the builder's queryFn ignores its context argument at runtime.
			 */
			state: (): EnsureQueryDataOptions<OnboardingState> => {
				const visible = companiesVisible();
				const fetchVisible = visible.queryFn as unknown as () => Promise<{
					docs: readonly VisibleCompany[];
				}>;
				return q.custom.query({
					key: keys.onboarding.state(),
					queryFn: async (): Promise<OnboardingState> => {
						try {
							return deriveOnboardingState(await fetchVisible());
						} catch (error) {
							// A session with no membership is denied the companies read
							// (the access rule answers false -> 403). For onboarding that
							// denial IS the empty projection: no visible company yet.
							// Every other failure stays a failure.
							if (isAccessDenied(error)) return deriveOnboardingState({ docs: [] });
							throw error;
						}
					},
				}) as unknown as EnsureQueryDataOptions<OnboardingState>;
			},
		},
		team: {
			/**
			 * Server-truth team roster for a company: every actor plus pending
			 * invitations. Same duplicated-identity casts as onboarding.state;
			 * the builders' queryFns ignore their context argument at runtime.
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
		},
		spaces: {
			/**
			 * Plain bounded snapshot for loader prefetch (ensureQueryData, SSR-safe).
			 * `asAppQueryOptions` bridges the workspace's duplicated @tanstack/react-query
			 * identity (see lib/data/session.ts); the `SpacesSnapshot` return annotation
			 * narrows the shape, pinned to the real find result by the FindResultOf guard.
			 */
			visible: (companyId: string): EnsureQueryDataOptions<SpacesSnapshot> =>
				asAppQueryOptions<SpacesSnapshot>(
					q.collections.spaces.find(spacesVisibleOptions(companyId)),
				),
			/**
			 * Live arm of the SAME read: identical options + {realtime:true}. Shares
			 * one cache entry with `visible` (identical key), so the loader static-load
			 * hydrates and the component's useSuspenseQuery upgrades it to a stream.
			 */
			visibleLive: (companyId: string): UseSuspenseQueryOptions<SpacesSnapshot> => ({
				...asAppQueryOptions<SpacesSnapshot>(
					q.collections.spaces.find(spacesVisibleOptions(companyId), { realtime: true }),
				),
				// Open the stream on mount even though the loader seeded a FRESH snapshot:
				// refetchOnMount:"always" short-circuits the isStale mount gate (query-core
				// shouldFetchOn), so the streamed queryFn runs and subscribes to realtime.
				// Data is already present -> background refetch, so useSuspenseQuery does NOT
				// re-suspend, and streamedQuery refetchMode:"append" keeps the hydrated
				// snapshot visible. The framework realtime branch sets no staleTime, so
				// without this the arm inherits the app default (60s) and never fetches on
				// mount -> the stream never opens (the whole point of the live arm).
				staleTime: 0,
				refetchOnMount: "always",
			}),
			/**
			 * Directory/overview projection: active spaces, Whole Company first. Plain
			 * request-scoped read for the `$spaceSlug` slug→space resolve (re-runs the
			 * route when the slug changes). The LIVE directory route does NOT read this —
			 * it derives the SAME projection client-side off `spaces.visibleLive` via
			 * `deriveSpaceDirectory` (the ADR decompose pattern), which this arm reuses so
			 * both paths share one projection.
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
		},
		channels: {
			/**
			 * Plain bounded snapshot for loader prefetch (ensureQueryData, SSR-safe).
			 * SPACE-SCOPED — {where:{space,status:"active"}}. Same `asAppQueryOptions`
			 * identity bridge + `ChannelsSnapshot` return annotation as spaces.visible,
			 * pinned to the real find result by the FindResultOf guard.
			 */
			visible: (spaceId: string): EnsureQueryDataOptions<ChannelsSnapshot> =>
				asAppQueryOptions<ChannelsSnapshot>(q.collections.channels.find(channelsOptions(spaceId))),
			/**
			 * Live arm of the SAME read: identical options + {realtime:true}. Shares one
			 * cache entry with `visible` (identical key), so the loader static-load
			 * hydrates and the component's useSuspenseQuery upgrades it to a stream. A
			 * channel created in this Space (the channels.create route) is persisted and
			 * arrives on the stream, reconciling by identity into this ONE entry — no
			 * invalidate, no frozen loader read.
			 */
			visibleLive: (spaceId: string): UseSuspenseQueryOptions<ChannelsSnapshot> => ({
				...asAppQueryOptions<ChannelsSnapshot>(
					q.collections.channels.find(channelsOptions(spaceId), { realtime: true }),
				),
				// Open the stream on mount even though the loader seeded a FRESH snapshot —
				// see spaces.visibleLive for the full staleTime:0 / refetchOnMount rationale.
				staleTime: 0,
				refetchOnMount: "always",
			}),
			/**
			 * Directory projection: active channels, #general first. Plain request-scoped
			 * read reusing the SAME pure `deriveChannelDirectory` the LIVE route derives
			 * client-side off `channels.visibleLive`, so both paths share one projection
			 * (mirrors how spaces.directory reuses deriveSpaceDirectory).
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
		},
		projects: {
			/**
			 * Plain bounded snapshot for loader prefetch (ensureQueryData, SSR-safe).
			 * SPACE-SCOPED — {where:{space,status:"active"}}. The direct mirror of
			 * channels.visible: same `asAppQueryOptions` identity bridge + `ProjectsSnapshot`
			 * return annotation, pinned to the real find result by the FindResultOf guard.
			 */
			visible: (spaceId: string): EnsureQueryDataOptions<ProjectsSnapshot> =>
				asAppQueryOptions<ProjectsSnapshot>(q.collections.projects.find(projectsOptions(spaceId))),
			/**
			 * Live arm of the SAME read: identical options + {realtime:true}. Shares one
			 * cache entry with `visible` (identical key), so the loader static-load hydrates
			 * and the component's useSuspenseQuery upgrades it to a stream. A project created
			 * in this Space (the projects.create route) is persisted and arrives on the
			 * stream, reconciling by identity into this ONE entry — no invalidate, no frozen
			 * loader read.
			 */
			visibleLive: (spaceId: string): UseSuspenseQueryOptions<ProjectsSnapshot> => ({
				...asAppQueryOptions<ProjectsSnapshot>(
					q.collections.projects.find(projectsOptions(spaceId), { realtime: true }),
				),
				// Open the stream on mount even though the loader seeded a FRESH snapshot —
				// see spaces.visibleLive for the full staleTime:0 / refetchOnMount rationale.
				staleTime: 0,
				refetchOnMount: "always",
			}),
			/**
			 * Directory projection: active projects by name. Plain request-scoped read
			 * reusing the SAME pure `deriveProjectDirectory` the LIVE route derives
			 * client-side off `projects.visibleLive`, so both paths share one projection
			 * (mirrors how channels.directory reuses deriveChannelDirectory).
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
		},
		actors: {
			/**
			 * Agents are actors with kind:"agent" (not a collection). Plain arm for
			 * loader prefetch — a raw factory the shell projection derives from. Same
			 * `asAppQueryOptions` identity bridge as spaces.visible.
			 */
			agents: (companyId: string): EnsureQueryDataOptions<AgentsSnapshot> =>
				asAppQueryOptions<AgentsSnapshot>(q.collections.actors.find(agentsOptions(companyId))),
			/**
			 * Live arm of the SAME agents read: identical options + {realtime:true},
			 * so it shares one cache entry with `agents` (identical key).
			 */
			agentsLive: (companyId: string): UseSuspenseQueryOptions<AgentsSnapshot> => ({
				...asAppQueryOptions<AgentsSnapshot>(
					q.collections.actors.find(agentsOptions(companyId), { realtime: true }),
				),
				// Same mount-fetch forcing as spaces.visibleLive: open the stream despite the
				// loader-fresh snapshot (see that arm for the full rationale).
				staleTime: 0,
				refetchOnMount: "always",
			}),
		},
		activity: {
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
		},
		company: {
			/**
			 * Resolve a slug against the visitor's OWN visible companies — null when
			 * it is not in their set (unknown or another tenant's, indistinguishably).
			 * A company-less session is denied the read (403); that denial is also
			 * "not resolvable", so it maps to null here, never to a thrown error.
			 */
			resolve: (slug: string): EnsureQueryDataOptions<VisibleCompany | null> => {
				const visible = companiesVisible();
				const fetchVisible = visible.queryFn as unknown as () => Promise<{
					docs: readonly VisibleCompany[];
				}>;
				return q.custom.query({
					key: keys.company.resolve(slug),
					queryFn: async (): Promise<VisibleCompany | null> => {
						try {
							const companies = await fetchVisible();
							return companies.docs.find((doc) => doc.slug === slug) ?? null;
						} catch (error) {
							if (isAccessDenied(error)) return null;
							throw error;
						}
					},
				}) as unknown as EnsureQueryDataOptions<VisibleCompany | null>;
			},
			/**
			 * Shell projection: active spaces + whether any agent still needs setup,
			 * derived in one cache entry. Same duplicated-identity casts as the
			 * roster; the builders' queryFns ignore their context argument at runtime.
			 */
			shell: (companyId: string): EnsureQueryDataOptions<CompanyShellProjection> => {
				// Derives from the SAME raw options as spaces.visible / actors.agents.
				// The $companySlug shell no longer reads this composite — it subscribes
				// to the live arms and re-runs deriveCompanyShell client-side (see the
				// route). This composite is retained for the settings/ai autopilotPending
				// read, whose q.custom.query has no {realtime} form.
				const spacesFind = q.collections.spaces.find(spacesVisibleOptions(companyId));
				const agentsFind = q.collections.actors.find(agentsOptions(companyId));
				const fetchSpaces = spacesFind.queryFn as unknown as () => Promise<{
					docs: readonly ShellSpaceDoc[];
				}>;
				const fetchAgents = agentsFind.queryFn as unknown as () => Promise<{
					docs: readonly ShellAgentDoc[];
				}>;
				return q.custom.query({
					key: keys.company.shell(companyId),
					queryFn: async (): Promise<CompanyShellProjection> => {
						const [spaces, agents] = await Promise.all([fetchSpaces(), fetchAgents()]);
						return deriveCompanyShell({ spaces: spaces.docs, agents: agents.docs });
					},
				}) as unknown as EnsureQueryDataOptions<CompanyShellProjection>;
			},
		},
	};
}

export type FeatureQueries = ReturnType<typeof createFeatureQueries>;
