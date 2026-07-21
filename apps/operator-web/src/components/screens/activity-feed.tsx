import { StatePanel } from "@questpie/ui";

import type { ActivityRow } from "@/features/activity/queries";

export type ActivityFeedProps = {
	rows: readonly ActivityRow[];
};

/**
 * Company activity surface (F01-P04): the persisted event log, each row
 * attributed to the Actor who caused it. Human-only and honest — no agent runs
 * or presence are invented; an empty company shows the intrinsic empty state.
 */
export function ActivityFeed({ rows }: ActivityFeedProps) {
	return (
		<div data-testid="screen-company-activity" className="mx-auto w-full max-w-3xl px-4 py-8">
			<header className="mb-6">
				<p className="ui-eyebrow text-xs text-muted-foreground">Aktivita</p>
				<h1 className="mt-1 text-2xl font-semibold tracking-tight">Aktivita spoločnosti</h1>
			</header>
			{rows.length === 0 ? (
				<StatePanel
					state="empty"
					title="Zatiaľ žiadna aktivita"
					description="Udalosti vášho tímu sa objavia tu, hneď ako začnete pracovať."
				/>
			) : (
				<ul className="grid gap-2">
					{rows.map((row) => (
						<li
							key={row.id}
							className="flex items-baseline gap-2 rounded-md border border-border-subtle p-3 text-sm"
						>
							<span className="font-medium">{row.actorName}</span>
							<span className="text-muted-foreground">{row.verbLabel}</span>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
