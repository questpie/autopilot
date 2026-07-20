import { CircleAlertIcon, InboxIcon, LockIcon, type LucideIcon, SearchIcon } from "lucide-react";
import type { ReactNode } from "react";

import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@questpie/ui/components/ui/empty";

export type UniversalState = "empty" | "no-results" | "error" | "access";

// Per-state anatomy (board states.css): every universal state is the SAME centered
// medallion + title + hint skeleton — a designed way-forward, never a naked title.
// empty/no-results carry a neutral medallion and a distinct glyph; error/access carry
// the gold caution medallion (.errorstate __ic), never a loud red alert.
const stateContract: Record<
	UniversalState,
	{ icon: LucideIcon; media: "icon" | "icon-attention" }
> = {
	empty: { icon: InboxIcon, media: "icon" },
	"no-results": { icon: SearchIcon, media: "icon" },
	error: { icon: CircleAlertIcon, media: "icon-attention" },
	access: { icon: LockIcon, media: "icon-attention" },
};

function StatePanel({
	state,
	title,
	description,
	action,
}: {
	state: UniversalState;
	title: string;
	description: string;
	action?: ReactNode;
}) {
	const { icon: Icon, media } = stateContract[state];
	const caution = media === "icon-attention";
	return (
		<Empty data-state={state} role={caution ? "alert" : undefined}>
			<EmptyHeader>
				<EmptyMedia variant={media}>
					<Icon aria-hidden />
				</EmptyMedia>
				<EmptyTitle>{title}</EmptyTitle>
				<EmptyDescription>{description}</EmptyDescription>
			</EmptyHeader>
			{action ? <EmptyContent>{action}</EmptyContent> : null}
		</Empty>
	);
}
export { StatePanel };
