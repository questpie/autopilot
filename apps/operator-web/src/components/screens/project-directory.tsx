import { StatePanel } from "@questpie/ui";

import type { ProjectSummary } from "@/features/projects/queries";

export type ProjectDirectoryProps = {
	projects: readonly ProjectSummary[];
};

/**
 * Project directory: every active project of the Space, ordered by Slovak name.
 * Query-free — the LIVE Space detail route derives `projects` off
 * `projects.visibleLive` and passes them in, so this component just renders the list
 * plus its honest empty state. It mirrors the channel directory, minus the #general
 * anchor concept (projects have no system_default). Projects have no detail route yet,
 * so rows are non-interactive.
 */
export function ProjectDirectory({ projects }: ProjectDirectoryProps) {
	return (
		<section data-testid="screen-project-directory" aria-label="Projekty">
			<header className="mb-4">
				<p className="ui-eyebrow text-xs text-muted-foreground">Projekty</p>
				<h2 className="mt-1 text-lg font-semibold tracking-tight">Projekty priestoru</h2>
			</header>
			{projects.length === 0 ? (
				<StatePanel
					state="empty"
					title="Zatiaľ žiadne projekty"
					description="Projekty tohto priestoru sa zobrazia hneď, ako niektorý vznikne."
				/>
			) : (
				<ul className="grid gap-2">
					{projects.map((project) => (
						<li key={project.id}>
							<div
								data-testid="project-row"
								className="flex w-full items-center justify-between gap-3 rounded-md border border-border-subtle p-3 text-left"
							>
								<span className="font-medium">{project.name}</span>
							</div>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
