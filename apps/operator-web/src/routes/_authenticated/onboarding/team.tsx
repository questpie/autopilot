import { createFileRoute, redirect } from "@tanstack/react-router";

import { TeamOnboardingStep } from "@/components/screens/team-roster";

export const Route = createFileRoute("/_authenticated/onboarding/team")({
	beforeLoad: async ({ context }) => {
		// Truth-derived wizard position: the team step needs a company. A session
		// that has not bootstrapped one resumes at the company step.
		const state = await context.queryClient.ensureQueryData(context.queries.onboarding.state());
		if (!state.hasCompany) throw redirect({ to: "/onboarding/company" });
	},
	loader: async ({ context }) => {
		const state = await context.queryClient.ensureQueryData(context.queries.onboarding.state());
		// The guard above guarantees a company; re-narrow for the loader closure.
		if (!state.companyId) throw redirect({ to: "/onboarding/company" });
		const roster = await context.queryClient.ensureQueryData(
			context.queries.team.roster({
				companyId: state.companyId,
				ownerActorId: state.ownerActorId,
			}),
		);
		return { roster, companyId: state.companyId };
	},
	head: () => ({
		meta: [{ title: "Pozvanie tímu — QUESTPIE Autopilot" }],
	}),
	component: TeamOnboardingRoute,
});

function TeamOnboardingRoute() {
	const { roster, companyId } = Route.useLoaderData();
	const { commands } = Route.useRouteContext();
	const navigate = Route.useNavigate();
	return (
		<TeamOnboardingStep
			roster={roster}
			onIssue={(draft) => commands.invitations.issue(companyId, draft)}
			onResend={(invitation) => commands.invitations.resend(invitation.id, invitation.version)}
			onRevoke={(invitation) => commands.invitations.revoke(invitation.id, invitation.version)}
			onContinue={() => {
				void navigate({ to: "/onboarding/ai" });
			}}
		/>
	);
}
