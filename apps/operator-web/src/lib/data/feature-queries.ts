import type { EnsureQueryDataOptions, UseSuspenseQueryOptions } from "@tanstack/react-query";

import { createActivityQueries } from "@/features/activity/queries";
import { agentsOptions, createActorsQueries, type ShellAgentDoc } from "@/features/actors/queries";
import { createChannelsQueries } from "@/features/channels/queries";
import { createProjectsQueries } from "@/features/projects/queries";
import {
	createSpacesQueries,
	type ShellSpaceDoc,
	type SpacesSnapshot,
	spacesVisibleOptions,
} from "@/features/spaces/queries";
import { createTeamQueries } from "@/features/team/queries";
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

export function createFeatureQueries(q: AppQueryOptions) {
	const keys = createQueryKeys(q);

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
		team: createTeamQueries(q),
		spaces: createSpacesQueries(q),
		channels: createChannelsQueries(q),
		projects: createProjectsQueries(q),
		actors: createActorsQueries(q),
		activity: createActivityQueries(q),
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
