import type { LucideIcon } from "lucide-react";

import { Tabs, TabsList, TabsTrigger } from "@questpie/ui/components/ui/tabs";

export type SpaceFacetId = "overview" | "tasks" | "goals" | "channel" | "knowledge" | "dashboards";

export const canonicalSpaceFacetOrder: readonly SpaceFacetId[] = [
	"overview",
	"tasks",
	"goals",
	"channel",
	"knowledge",
	"dashboards",
];

export interface SpaceFacet {
	id: SpaceFacetId;
	label: string;
	icon: LucideIcon;
	count?: number;
	agentAuthored?: boolean;
}

export interface SpaceFacetNavProps {
	facets: readonly SpaceFacet[];
	activeId: SpaceFacetId;
	onChange?: (id: SpaceFacetId) => void;
}

function SpaceFacetNav({ facets, activeId, onChange }: SpaceFacetNavProps) {
	const byId = new Map(facets.map((facet) => [facet.id, facet]));
	const orderedFacets = canonicalSpaceFacetOrder.flatMap((id) => {
		const facet = byId.get(id);
		return facet ? [facet] : [];
	});

	return (
		<Tabs
			className="min-w-0 overflow-hidden"
			value={activeId}
			onValueChange={(value) => onChange?.(String(value) as SpaceFacetId)}
		>
			<TabsList
				data-slot="space-facet-nav"
				variant="line"
				className="w-full justify-start overflow-x-auto px-4"
			>
				{orderedFacets.map((facet) => {
					const Icon = facet.icon;
					return (
						<TabsTrigger
							key={facet.id}
							value={facet.id}
							data-agent-authored={facet.agentAuthored || undefined}
						>
							<Icon data-icon="inline-start" aria-hidden />
							{facet.label}
							{facet.count !== undefined ? (
								<span className="ui-mono text-muted-foreground">{facet.count}</span>
							) : null}
						</TabsTrigger>
					);
				})}
			</TabsList>
		</Tabs>
	);
}
export { SpaceFacetNav };
