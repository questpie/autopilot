import type { ReactNode } from "react";

import { SpaceContext } from "@questpie/ui";

import type { SpaceSummary } from "@/features/spaces/queries";

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
					className="rounded-md border border-border-subtle px-3 py-1.5 text-sm font-medium hover:bg-muted"
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
							className="flex w-full items-center justify-between gap-3 rounded-md border border-border-subtle p-3 text-left hover:bg-muted"
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
	/** The Space body — the LIVE channel + project directories the detail route mounts (SPEC 10.5). */
	children: ReactNode;
};

/**
 * Space overview: the space header with its #general anchor over the Space body.
 * The body is the LIVE channel + project directories the detail route derives off
 * `channels.visibleLive` / `projects.visibleLive` and passes as `children`, so this
 * template stays query-free.
 */
export function SpaceOverview({ space, children }: SpaceOverviewProps) {
	return (
		<div data-testid="screen-space-overview">
			<SpaceContext title={space.name} meta="#general" />
			<div className="mx-auto w-full max-w-3xl px-4 py-8">{children}</div>
		</div>
	);
}
