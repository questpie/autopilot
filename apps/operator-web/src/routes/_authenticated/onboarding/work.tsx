import { createFileRoute, redirect } from "@tanstack/react-router";

import { WorkOnboardingStep } from "@/components/screens/onboarding-steps";

export const Route = createFileRoute("/_authenticated/onboarding/work")({
	beforeLoad: async ({ context }) => {
		// The final step needs a bootstrapped company; a session without one
		// resumes at the company step.
		const state = await context.queryClient.ensureQueryData(context.queries.onboarding.state());
		if (!state.hasCompany || !state.companySlug) throw redirect({ to: "/onboarding/company" });
	},
	loader: async ({ context }) => {
		const state = await context.queryClient.ensureQueryData(context.queries.onboarding.state());
		// Re-narrow for the loader closure; the guard already proved the company.
		if (!state.companySlug) throw redirect({ to: "/onboarding/company" });
		return { companySlug: state.companySlug };
	},
	head: () => ({
		meta: [{ title: "Pracovný priestor — QUESTPIE Autopilot" }],
	}),
	component: WorkOnboardingRoute,
});

function WorkOnboardingRoute() {
	const { companySlug } = Route.useLoaderData();
	const navigate = Route.useNavigate();
	return (
		<WorkOnboardingStep
			onConfirm={() => {
				// Confirming enters the adaptive shell — a client navigation, no write.
				void navigate({ to: "/app/$companySlug/home", params: { companySlug } });
			}}
		/>
	);
}
