import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

import { AuthShell } from "@questpie/ui";

/**
 * Public invite entry: an invited visitor lands here from the delivery link.
 * The browser exchanges the raw token through the data layer (the 303 sets the
 * continuation cookie) and then continues to sign-in. SSR renders the shell;
 * the exchange itself is a browser step so the cookie is applied same-origin.
 */
export const Route = createFileRoute("/invite/$token")({
	head: () => ({
		meta: [{ title: "Pozvánka — QUESTPIE Autopilot" }],
	}),
	component: InviteEntryRoute,
});

function InviteEntryRoute() {
	const { token } = Route.useParams();
	const { commands } = Route.useRouteContext();
	const navigate = Route.useNavigate();

	useEffect(() => {
		let active = true;
		void (async () => {
			await commands.invitations.exchange(token);
			if (active) void navigate({ to: "/sign-in", search: { continue: "invitation" } });
		})();
		return () => {
			active = false;
		};
	}, [token, commands, navigate]);

	return (
		<div data-testid="screen-invite-continue">
			<AuthShell
				title="Pokračujeme vo vašej pozvánke"
				description="Overujeme vašu pozvánku a presmerujeme vás na prihlásenie."
			>
				<p className="text-sm text-muted-foreground">Ak sa nič nestane, obnovte stránku.</p>
			</AuthShell>
		</div>
	);
}
