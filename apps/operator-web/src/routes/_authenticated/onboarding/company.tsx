import { createFileRoute, redirect } from "@tanstack/react-router";

import { CompanyOnboardingStep } from "@/components/screens/onboarding-steps";

export const Route = createFileRoute("/_authenticated/onboarding/company")({
	beforeLoad: async ({ context }) => {
		// Truth-derived wizard position: the projection is ensured here so the
		// step renders from server truth, never from client-remembered state.
		// Resume-forward — a completed company step never renders again.
		const state = await context.queryClient.ensureQueryData(context.queries.onboarding.state());
		if (state.hasCompany) throw redirect({ to: "/onboarding/team" });
	},
	head: () => ({
		meta: [{ title: "Vytvorenie spoločnosti — QUESTPIE Autopilot" }],
	}),
	component: CompanyOnboardingRoute,
});

function CompanyOnboardingRoute() {
	const { commands, queryClient } = Route.useRouteContext();
	const navigate = Route.useNavigate();
	return (
		<CompanyOnboardingStep
			onSubmit={async (draft) => {
				const outcome = await commands.companies.bootstrap(draft);
				if (outcome.status === "recoverable") return outcome;
				// The projection changed server-side; drop every cached read so the
				// following screens derive fresh truth (ensureQueryData would serve
				// a stale no-company snapshot after a mere invalidate).
				queryClient.removeQueries();
				await navigate({ to: "/onboarding/team" });
				return { status: "created" };
			}}
		/>
	);
}
