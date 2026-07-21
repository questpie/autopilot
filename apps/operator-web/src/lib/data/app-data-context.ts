import { createActivityQueries } from "@/features/activity/queries";
import { createActorsQueries } from "@/features/actors/queries";
import { createChannelsQueries } from "@/features/channels/queries";
import { createCompaniesQueries, createCompanyQueries } from "@/features/company/queries";
import { createOnboardingQueries } from "@/features/onboarding/queries";
import { createProjectsQueries } from "@/features/projects/queries";
import { createSpacesQueries } from "@/features/spaces/queries";
import { createTeamQueries } from "@/features/team/queries";
import { createAppClient } from "@/lib/client";
import { createCompaniesCommands } from "@/lib/data/commands/companies";
import { createInvitationsCommands } from "@/lib/data/commands/invitations";
import { createSpacesCommands } from "@/lib/data/commands/spaces";
import {
	createInvitationChallengeQuery,
	createInvitationExchange,
} from "@/lib/data/invitation-continuation";
import { createSessionQuery } from "@/lib/data/session";
import { createAppQueryOptions, type AppQueryOptions } from "@/lib/query";
import { createAppQueryClient } from "@/lib/query-client";

const REQUEST_IDENTITY_HEADERS = ["authorization", "cookie"] as const;

type DataContextOptions = {
	fetch?: typeof fetch;
};

export function createRequestDataContext(request: Request, options: DataContextOptions = {}) {
	return createDataContext({
		baseURL: new URL(request.url).origin,
		fetch: options.fetch,
		headers: selectRequestIdentityHeaders(request.headers),
	});
}

export function createBrowserDataContext(baseURL: string) {
	return createDataContext({ baseURL });
}

export function selectRequestIdentityHeaders(headers: Headers) {
	const selected: Record<string, string> = {};

	for (const name of REQUEST_IDENTITY_HEADERS) {
		const value = headers.get(name);
		if (value) selected[name] = value;
	}

	return selected;
}

/** Thin ADR-0023 composer preserving the public context.queries feature namespaces. */
export function createAppQueries(q: AppQueryOptions) {
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

function createDataContext({
	baseURL,
	fetch,
	headers,
}: DataContextOptions & { baseURL: string; headers?: Record<string, string> }) {
	const client = createAppClient({ baseURL, fetch, headers });
	const q = createAppQueryOptions(client);

	return {
		queryClient: createAppQueryClient(),
		queries: createAppQueries(q),
		commands: {
			companies: createCompaniesCommands({
				bootstrap: (submission) => client.routes.companies.bootstrap.post(submission),
			}),
			invitations: {
				...createInvitationsCommands({
					issue: (submission) => client.routes.invitations.issue.post(submission),
					resend: (submission) => client.routes.invitations.resend.post(submission),
					revoke: (submission) => client.routes.invitations.revoke.post(submission),
					accept: (submission) => client.routes.invitations.accept.post(submission),
				}),
				exchange: createInvitationExchange(baseURL, fetch),
			},
			spaces: createSpacesCommands({
				create: (submission) => client.routes.spaces.create.post(submission),
			}),
		},
		session: createSessionQuery(q, { baseURL, fetch, headers }),
		invitationChallenge: createInvitationChallengeQuery(q, client),
	};
}

export type AppDataContext = ReturnType<typeof createRequestDataContext>;
