import { createFileRoute } from "@tanstack/react-router";

import { CompanyTeam } from "@/components/screens/company-team";

export const Route = createFileRoute("/_authenticated/app/$companySlug/team")({
	loader: async ({ context }) => {
		const state = await context.queryClient.ensureQueryData(context.queries.onboarding.state());
		const roster = await context.queryClient.ensureQueryData(
			context.queries.team.roster({
				companyId: context.company.id,
				ownerActorId: state.ownerActorId,
			}),
		);
		return { roster };
	},
	head: () => ({
		meta: [{ title: "Tím — QUESTPIE Autopilot" }],
	}),
	component: CompanyTeamRoute,
});

function CompanyTeamRoute() {
	const { roster } = Route.useLoaderData();
	return <CompanyTeam roster={roster} />;
}
