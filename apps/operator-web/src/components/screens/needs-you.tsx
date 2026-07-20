import { StatePanel } from "@questpie/ui";

/**
 * "Potrebuje ťa" surface: decisions and approvals awaiting the human. Human-only
 * and honest — with no agent runs there is nothing to route here, so it shows
 * the intrinsic empty state rather than inventing pending work.
 */
export function NeedsYou() {
	return (
		<div data-testid="screen-needs-you" className="mx-auto w-full max-w-3xl px-4 py-8">
			<header className="mb-6">
				<p className="ui-eyebrow text-xs text-muted-foreground">Potrebuje ťa</p>
				<h1 className="mt-1 text-2xl font-semibold tracking-tight">Nič nečaká na teba</h1>
			</header>
			<StatePanel
				state="empty"
				title="Máš všetko vybavené"
				description="Keď bude Autopilot potrebovať tvoje schválenie alebo rozhodnutie, objaví sa to tu."
			/>
		</div>
	);
}
