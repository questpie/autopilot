import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Truth-derived resolver: "/" never renders — it forwards to wherever the
 * server truth places the visitor. No session means the sign-in entry; a
 * session with a bootstrapped company lands in that company's shell; a session
 * without one resumes at the company onboarding step. Every branch is derived
 * from the request's own identity, so a fresh cookie jar resumes identically.
 */
export const Route = createFileRoute("/")({
	beforeLoad: async ({ context }) => {
		const session = await context.queryClient.ensureQueryData(context.session());
		if (!session) throw redirect({ to: "/sign-in" });
		const state = await context.queryClient.ensureQueryData(context.queries.onboarding.state());
		if (state.hasCompany && state.companySlug) {
			throw redirect({
				to: "/app/$companySlug/home",
				params: { companySlug: state.companySlug },
			});
		}
		throw redirect({ to: "/onboarding/company" });
	},
});
