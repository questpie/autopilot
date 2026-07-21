import type { EnsureQueryDataOptions } from "@tanstack/react-query";

import { agentsOptions, type ShellAgentDoc } from "@/features/actors/queries";
import { type ShellSpaceDoc, spacesVisibleOptions } from "@/features/spaces/queries";
import { isAccessDenied } from "@/lib/data/query-arm-helpers";
import { createQueryKeys } from "@/lib/data/query-keys";
import type { NavSpace } from "@/lib/navigation/company-nav";
import type { AppQueryOptions } from "@/lib/query";

const COMPANY_LIST_LIMIT = 50;

/** Minimal read shape the company resolver and onboarding projection need. */
export type VisibleCompany = {
	id: string;
	name: string;
	slug: string;
	createdByActor?: string | null;
};

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

/**
 * Shared visible-company options. Module-level and q-free so companies.visible,
 * company.resolve, and onboarding.state all reuse the identical collection read.
 */
export const companiesVisibleOptions = {
	where: { status: "active" },
	orderBy: { name: "asc" },
	limit: COMPANY_LIST_LIMIT,
} satisfies Parameters<AppQueryOptions["collections"]["companies"]["find"]>[0];

/** The plural companies namespace retained by the public data-context contract. */
export function createCompaniesQueries(q: AppQueryOptions) {
	return {
		visible: () => q.collections.companies.find(companiesVisibleOptions),
	};
}

/**
 * Company feature reads (ADR 0022 / 0023): slug resolution plus the retained
 * REST-only spaces + actors shell composite. The live shell derives the same pure
 * projection client-side from its paired live collection arms.
 */
export function createCompanyQueries(q: AppQueryOptions) {
	const keys = createQueryKeys(q);
	return {
		/**
		 * Resolve a slug against the visitor's OWN visible companies — null when it is
		 * not in their set (unknown or another tenant's, indistinguishably). A
		 * company-less session is denied the read (403); that denial is also "not
		 * resolvable", so it maps to null here, never to a thrown error.
		 */
		resolve: (slug: string): EnsureQueryDataOptions<VisibleCompany | null> => {
			const visible = q.collections.companies.find(companiesVisibleOptions);
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
		 * derived in one cache entry. Same duplicated-identity casts as the roster;
		 * the builders' queryFns ignore their context argument at runtime.
		 */
		shell: (companyId: string): EnsureQueryDataOptions<CompanyShellProjection> => {
			// Derives from the SAME raw options as spaces.visible / actors.agents. The
			// company shell route subscribes to the live arms and re-runs
			// deriveCompanyShell client-side. This composite is retained for the
			// settings/ai autopilotPending read, whose q.custom.query has no realtime form.
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
	};
}
