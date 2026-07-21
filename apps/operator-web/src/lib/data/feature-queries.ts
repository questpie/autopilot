import { createActivityQueries } from "@/features/activity/queries";
import { createActorsQueries } from "@/features/actors/queries";
import { createChannelsQueries } from "@/features/channels/queries";
import { createCompaniesQueries, createCompanyQueries } from "@/features/company/queries";
import { createOnboardingQueries } from "@/features/onboarding/queries";
import { createProjectsQueries } from "@/features/projects/queries";
import { createSpacesQueries } from "@/features/spaces/queries";
import { createTeamQueries } from "@/features/team/queries";
import type { AppQueryOptions } from "@/lib/query";

export function createFeatureQueries(q: AppQueryOptions) {
	return {
		companies: createCompaniesQueries(q),
		onboarding: createOnboardingQueries(q),
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
