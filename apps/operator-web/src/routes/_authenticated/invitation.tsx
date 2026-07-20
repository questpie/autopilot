import { createFileRoute } from "@tanstack/react-router";

import { InvitationAcceptanceScreen } from "@/components/screens/invitation-card";

export const Route = createFileRoute("/_authenticated/invitation")({
	loader: async ({ context }) => {
		// Masked continuation truth for the signed-in visitor; the request-scoped
		// client forwards the challenge cookie to the public seam.
		const challenge = await context.queryClient.ensureQueryData(context.invitationChallenge());
		return { challenge };
	},
	head: () => ({
		meta: [{ title: "Prijatie pozvánky — QUESTPIE Autopilot" }],
	}),
	component: InvitationAcceptanceRoute,
});

function InvitationAcceptanceRoute() {
	const { challenge } = Route.useLoaderData();
	const { commands, queryClient } = Route.useRouteContext();
	const navigate = Route.useNavigate();
	return (
		<InvitationAcceptanceScreen
			challenge={challenge}
			onAccept={(expectedVersion) => commands.invitations.accept(expectedVersion)}
			onAccepted={() => {
				// The invited Actor now exists; drop cached reads so "/" resolves the
				// new company from fresh truth into the shell.
				queryClient.removeQueries();
				void navigate({ to: "/" });
			}}
			onRetry={() => {
				void queryClient.invalidateQueries();
			}}
		/>
	);
}
