import { createFileRoute } from "@tanstack/react-router";

import { StatePanel } from "@questpie/ui";

/** What the Autopilot cannot do until a provider is connected (SPEC 10.4). */
const AI_UNAVAILABLE = [
	"Autopilot nespustí žiadnu úlohu ani beh.",
	"Neodpovie na spomenutia ani neprevezme zadania.",
	"Zostáva v tíme ako člen čakajúci na nastavenie.",
] as const;

export const Route = createFileRoute("/_authenticated/app/$companySlug/settings/ai")({
	loader: async ({ context }) => {
		const shell = await context.queryClient.ensureQueryData(
			context.queries.company.shell(context.company.id),
		);
		return { autopilotPending: shell.autopilotPending };
	},
	head: () => ({
		meta: [{ title: "Nastavenia AI — QUESTPIE Autopilot" }],
	}),
	component: AiSettingsRoute,
});

function AiSettingsRoute() {
	const { autopilotPending } = Route.useLoaderData();
	return (
		<div data-testid="screen-ai-settings" className="mx-auto w-full max-w-3xl px-4 py-8">
			<header className="mb-6">
				<p className="ui-eyebrow text-xs text-muted-foreground">Nastavenia AI</p>
				<h1 className="mt-1 text-2xl font-semibold tracking-tight">Poskytovateľ AI</h1>
			</header>
			{autopilotPending ? (
				<StatePanel
					state="empty"
					title="Autopilot: Vyžaduje nastavenie"
					description="Autopilota rozbehnete až po pripojení poskytovateľa AI. Pripojenie poskytovateľa pribudne v ďalšej fáze — nič nepredstierame."
				/>
			) : null}
			<section
				aria-labelledby="ai-settings-unavailable"
				className="mt-6 rounded-md border border-hairline p-3"
			>
				<h2 id="ai-settings-unavailable" className="text-sm font-medium">
					Kým poskytovateľ chýba
				</h2>
				<ul className="mt-2 grid gap-1 text-sm text-muted-foreground">
					{AI_UNAVAILABLE.map((item) => (
						<li key={item}>{item}</li>
					))}
				</ul>
			</section>
		</div>
	);
}
