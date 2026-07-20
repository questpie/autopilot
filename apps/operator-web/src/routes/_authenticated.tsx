import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Pathless session guard: every child route requires a signed-in visitor.
 * Anonymous visitors are sent to the sign-in entry carrying the original
 * location, so authentication resumes exactly where they knocked.
 */
export const Route = createFileRoute("/_authenticated")({
	beforeLoad: async ({ context, location }) => {
		const session = await context.queryClient.ensureQueryData(context.session());
		if (!session) {
			throw redirect({ to: "/sign-in", search: { redirect: location.href } });
		}
	},
});
