import { StatePanel } from "@questpie/ui";

export type CompanyHomeProps = {
	/** The persisted company name — never a placeholder. */
	companyName: string;
};

/**
 * Company home inside the adaptive shell. Human-only and honest: the Autopilot
 * stays dormant until a provider is connected, so the home shows the intrinsic
 * empty state rather than inventing activity.
 */
export function CompanyHome({ companyName }: CompanyHomeProps) {
	return (
		<div data-testid="screen-company-home" className="mx-auto w-full max-w-3xl px-4 py-8">
			<header className="mb-6">
				<p className="ui-eyebrow text-xs text-ink-muted">Domov</p>
				<h1 className="mt-1 text-2xl font-semibold tracking-tight">{companyName}</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					Vitajte v pracovnom priestore. Váš tím je pripravený začať.
				</p>
			</header>
			<StatePanel
				state="empty"
				title="Zatiaľ žiadna aktivita"
				description="Autopilot je nečinný, kým nepripojíte poskytovateľa AI. Priestor Whole Company aj kanál #general sú pripravené pre váš tím."
			/>
		</div>
	);
}
