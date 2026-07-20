import { SpaceContext, StatePanel } from "@questpie/ui";

import type { SpaceSummary } from "@/lib/data/feature-queries";

export type SpaceDirectoryProps = {
	spaces: readonly SpaceSummary[];
	onOpenSpace: (slug: string) => void;
	onCreate: () => void;
};

/** Space directory (F01): every active space, Whole Company first, plus create. */
export function SpaceDirectory({ spaces, onOpenSpace, onCreate }: SpaceDirectoryProps) {
	return (
		<div data-testid="screen-space-directory" className="mx-auto w-full max-w-3xl px-4 py-8">
			<header className="mb-6 flex items-center justify-between gap-3">
				<div>
					<p className="ui-eyebrow text-xs text-muted-foreground">Priestory</p>
					<h1 className="mt-1 text-2xl font-semibold tracking-tight">Všetky priestory</h1>
				</div>
				<button
					type="button"
					onClick={onCreate}
					className="rounded-md border border-hairline px-3 py-1.5 text-sm font-medium hover:bg-muted"
				>
					Nový priestor
				</button>
			</header>
			<ul className="grid gap-2">
				{spaces.map((space) => (
					<li key={space.id}>
						<button
							type="button"
							onClick={() => onOpenSpace(space.slug)}
							className="flex w-full items-center justify-between gap-3 rounded-md border border-hairline p-3 text-left hover:bg-muted"
						>
							<span className="font-medium">{space.name}</span>
							{space.isWholeCompany ? (
								<span className="text-xs text-muted-foreground">Predvolený priestor</span>
							) : null}
						</button>
					</li>
				))}
			</ul>
		</div>
	);
}

export type SpaceOverviewProps = {
	space: SpaceSummary;
};

/** Space overview: the space header and its default #general channel (SPEC 10.5). */
export function SpaceOverview({ space }: SpaceOverviewProps) {
	return (
		<div data-testid="screen-space-overview">
			<SpaceContext title={space.name} meta="#general" />
			<div className="mx-auto w-full max-w-3xl px-4 py-8">
				<p className="text-sm text-muted-foreground">
					Predvolený kanál <span className="font-medium text-foreground">#general</span> je
					pripravený pre rozhovory v tomto priestore.
				</p>
				<div className="mt-6">
					<StatePanel
						state="empty"
						title="Priestor je pripravený"
						description="Tímový obsah tohto priestoru pribudne, hneď ako v ňom začnete pracovať."
					/>
				</div>
			</div>
		</div>
	);
}
