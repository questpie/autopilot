import type { ComponentProps } from "react";

import type { ActorProjection } from "@questpie/ui/components/composites/actor";
import { ActorMark, type ActorMarkProps } from "@questpie/ui/components/composites/actor-mark";
import { cn } from "@questpie/ui/lib/utils";

export interface ActorStackMember {
	actor: ActorProjection;
	presence?: ActorMarkProps["presence"];
}

export interface ActorStackProps extends Omit<ComponentProps<"div">, "children"> {
	members: readonly ActorStackMember[];
	size?: ActorMarkProps["size"];
}

function ActorStack({ members, size = "sm", className, ...props }: ActorStackProps) {
	return (
		<div
			data-slot="actor-stack"
			className={cn("actor-stack", className)}
			role="group"
			aria-label={members.map(({ actor }) => actor.name).join(", ")}
			{...props}
		>
			{members.map(({ actor, presence }) => (
				<ActorMark key={actor.id} actor={actor} size={size} presence={presence} />
			))}
		</div>
	);
}

export { ActorStack };
