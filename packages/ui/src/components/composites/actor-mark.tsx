import type { ComponentProps } from "react";

import type { ActorProjection } from "@questpie/ui/components/composites/actor";
import { Avatar, AvatarFallback, AvatarImage } from "@questpie/ui/components/ui/avatar";
import { cn } from "@questpie/ui/lib/utils";

export interface ActorMarkProps extends Omit<ComponentProps<"span">, "children"> {
	actor: ActorProjection;
	size?: "sm" | "md" | "lg";
	presence?: "online" | "away" | "offline";
}

function initials(name: string) {
	return name
		.split(/\s+/)
		.slice(0, 2)
		.map((part) => part[0])
		.join("");
}

function ActorMark({ actor, size = "md", presence, className, ...props }: ActorMarkProps) {
	const presenceNode = presence ? (
		<span data-slot="actor-presence" data-presence={presence} aria-hidden />
	) : null;

	return (
		<span
			data-slot="actor-mark"
			data-kind={actor.kind}
			data-size={size}
			className={cn("actor-mark", className)}
			aria-hidden
			{...props}
		>
			<Avatar
				size={size === "lg" ? "lg" : size === "sm" ? "sm" : "default"}
				className="size-full data-[size=sm]:size-full data-[size=lg]:size-full"
			>
				{actor.kind === "human" && actor.avatarUrl ? (
					<AvatarImage src={actor.avatarUrl} alt="" />
				) : null}
				<AvatarFallback>{actor.kind === "agent" ? "A" : initials(actor.name)}</AvatarFallback>
			</Avatar>
			{presenceNode}
		</span>
	);
}

export { ActorMark };
