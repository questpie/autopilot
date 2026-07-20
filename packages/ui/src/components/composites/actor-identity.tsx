import type { ComponentProps } from "react";

import type { ActorProjection } from "@questpie/ui/components/composites/actor";
import { ActorMark, type ActorMarkProps } from "@questpie/ui/components/composites/actor-mark";
import { cn } from "@questpie/ui/lib/utils";

export interface ActorIdentityProps extends Omit<ComponentProps<"div">, "children"> {
	actor: ActorProjection;
	size?: ActorMarkProps["size"];
	presence?: ActorMarkProps["presence"];
	role?: string;
}

function ActorIdentity({
	actor,
	size = "md",
	presence,
	role,
	className,
	...props
}: ActorIdentityProps) {
	return (
		<div
			data-slot="actor-identity"
			data-kind={actor.kind}
			data-size={size}
			className={cn("actor-identity", className)}
			{...props}
		>
			<ActorMark actor={actor} size={size} presence={presence} />
			<span data-slot="actor-name" title={actor.name}>
				{actor.name}
			</span>
			{role ? <span data-slot="actor-role">{role}</span> : null}
		</div>
	);
}

export { ActorIdentity };
