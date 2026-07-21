import { CheckCircle2Icon, FileOutputIcon, SearchCheckIcon } from "lucide-react";

import type { RunProvenanceProjection } from "@questpie/ui/components/ai/run-state";
import { ActorIdentity } from "@questpie/ui/components/composites/actor-identity";
import { Button } from "@questpie/ui/components/ui/button";
import {
	Item,
	ItemActions,
	ItemContent,
	ItemDescription,
	ItemMedia,
	ItemTitle,
} from "@questpie/ui/components/ui/item";

const kindLabels = {
	effect: "Efekt",
	output: "Výstup",
	evidence: "Dôkaz",
} as const;

const kindIcons = {
	effect: CheckCircle2Icon,
	output: FileOutputIcon,
	evidence: SearchCheckIcon,
} as const;

function RunProvenanceList({
	items,
	onOpen,
}: {
	items: readonly RunProvenanceProjection[];
	onOpen: (recordId: string) => void;
}) {
	return (
		<ul aria-label="Proveniencia behu" className="divide-y divide-border-subtle">
			{items.map((item) => {
				const Icon = kindIcons[item.kind];
				return (
					<li key={item.id}>
						<Item
							data-part="run-provenance-record"
							data-record-id={item.id}
							data-reference-id={item.referenceId}
							className="rounded-none px-4 py-3"
						>
							<ItemMedia variant="icon">
								<Icon aria-hidden />
							</ItemMedia>
							<ItemContent className="min-w-0">
								<ItemTitle>
									<span>{item.label}</span>
									<span className="break-all font-mono text-[length:var(--type-xs)] font-normal text-muted-foreground">
										{kindLabels[item.kind]} · {item.referenceId}
									</span>
								</ItemTitle>
								{item.detail ? <ItemDescription>{item.detail}</ItemDescription> : null}
								<div className="flex flex-wrap items-center gap-2 text-[length:var(--type-xs)] text-muted-foreground">
									<ActorIdentity actor={item.actor} size="sm" />
									<time>{item.occurredAt}</time>
								</div>
							</ItemContent>
							<ItemActions>
								<Button variant="ghost" size="sm" onClick={() => onOpen(item.id)}>
									Otvoriť
								</Button>
							</ItemActions>
						</Item>
					</li>
				);
			})}
		</ul>
	);
}

export { RunProvenanceList };
