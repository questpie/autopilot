import { createFileRoute, redirect } from "@tanstack/react-router";

import { AiOnboardingStep } from "@/components/screens/onboarding-steps";

export const Route = createFileRoute("/_authenticated/onboarding/ai")({
	beforeLoad: async ({ context }) => {
		// The AI gate belongs to an existing company; without one, resume at the
		// company step. There is no provider surface to configure in this phase.
		const state = await context.queryClient.ensureQueryData(context.queries.onboarding.state());
		if (!state.hasCompany) throw redirect({ to: "/onboarding/company" });
	},
	head: () => ({
		meta: [{ title: "Nastavenie AI — QUESTPIE Autopilot" }],
	}),
	component: AiOnboardingRoute,
});

function AiOnboardingRoute() {
	const navigate = Route.useNavigate();
	return (
		<AiOnboardingStep
			onSkip={() => {
				// Skipping is a pure client navigation — no provider, no write.
				void navigate({ to: "/onboarding/work" });
			}}
		/>
	);
}
