import { XIcon } from "lucide-react";
import type { ComponentProps } from "react";

import type { ActorProjection } from "@questpie/ui/components/composites/actor";
import { ActorMark } from "@questpie/ui/components/composites/actor-mark";
import { Badge } from "@questpie/ui/components/ui/badge";
import { Button } from "@questpie/ui/components/ui/button";
import { cn } from "@questpie/ui/lib/utils";

export interface ActorChipProps extends Omit<ComponentProps<"div">, "children"> {
	actor: ActorProjection;
	size?: "sm" | "md";
	presence?: "online" | "away" | "offline";
	availability?: "available" | "unavailable" | "suspended";
	pickerMode?: boolean;
	onRemove?: () => void;
	copy?: ActorChipCopy;
}

export interface ActorChipCopy {
	agent: string;
	presence: Record<NonNullable<ActorChipProps["presence"]>, string>;
	availability: Record<NonNullable<ActorChipProps["availability"]>, string>;
	remove: (name: string) => string;
}

const defaultActorChipCopy: ActorChipCopy = {
	agent: "AI aktér",
	presence: { online: "Online", away: "Preč", offline: "Offline" },
	availability: {
		available: "Dostupný",
		unavailable: "Nedostupný",
		suspended: "Pozastavený",
	},
	remove: (name) => `Odobrať ${name}`,
};

function ActorChip({
	actor,
	size = "sm",
	presence,
	availability,
	pickerMode,
	onRemove,
	copy = defaultActorChipCopy,
	className,
	...props
}: ActorChipProps) {
	return (
		<div
			data-slot="actor-chip"
			className={cn("inline-flex max-w-64 items-center gap-1", className)}
			data-kind={actor.kind}
			data-size={size}
			data-availability={availability}
			{...props}
		>
			<Badge
				variant="outline"
				className={cn(
					"actor-chip__surface max-w-56 gap-1.5 bg-background pr-2",
					size === "sm" ? "h-7 text-[length:var(--type-md)]" : "h-8 text-[length:var(--type-lg)]",
				)}
			>
				<ActorMark actor={actor} size={size} presence={presence} />
				<span className="truncate">{actor.name}</span>
				{presence ? <span className="sr-only">{copy.presence[presence]}</span> : null}
				{availability ? <span className="sr-only">{copy.availability[availability]}</span> : null}
				{actor.kind === "agent" ? <span className="sr-only">{copy.agent}</span> : null}
			</Badge>
			{pickerMode && onRemove ? (
				<Button
					className="actor-chip__remove"
					variant="ghost"
					size="icon-xs"
					onClick={onRemove}
					aria-label={copy.remove(actor.name)}
				>
					<XIcon />
				</Button>
			) : null}
		</div>
	);
}

export { ActorChip, defaultActorChipCopy };
