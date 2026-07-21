import type { EnsureQueryDataOptions } from "@tanstack/react-query";

import { createActivityQueries } from "@/features/activity/queries";
import { createActorsQueries } from "@/features/actors/queries";
import { createChannelsQueries } from "@/features/channels/queries";
import {
	companiesVisibleOptions,
	createCompaniesQueries,
	createCompanyQueries,
	type VisibleCompany,
} from "@/features/company/queries";
import { createProjectsQueries } from "@/features/projects/queries";
import { createSpacesQueries } from "@/features/spaces/queries";
import { createTeamQueries } from "@/features/team/queries";
import { isAccessDenied } from "@/lib/data/query-arm-helpers";
import { createQueryKeys } from "@/lib/data/query-keys";
import type { AppQueryOptions } from "@/lib/query";

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

export function createFeatureQueries(q: AppQueryOptions) {
	const keys = createQueryKeys(q);

	return {
		companies: createCompaniesQueries(q),
		onboarding: {
			/**
			 * Onboarding-state query: same companies.visible read, derived shape,
			 * own cache entry. Casts bridge the workspace's duplicated
			 * @tanstack/react-query identity (see the note in lib/data/session.ts);
			 * the builder's queryFn ignores its context argument at runtime.
			 */
			state: (): EnsureQueryDataOptions<OnboardingState> => {
				const visible = q.collections.companies.find(companiesVisibleOptions);
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
		company: createCompanyQueries(q),
	};
}

export type FeatureQueries = ReturnType<typeof createFeatureQueries>;
