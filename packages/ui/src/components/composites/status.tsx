import type { ComponentProps } from "react";

import { Badge } from "@questpie/ui/components/ui/badge";
import { cn } from "@questpie/ui/lib/utils";

export type StatusState = "running" | "attention" | "done" | "idle" | "blocked" | "failed";

export interface StatusProps extends Omit<ComponentProps<typeof Badge>, "variant"> {
	state: StatusState;
	label: string;
	elapsed?: string;
	meta?: string;
}

function Status({ state, label, elapsed, meta, className, ...props }: StatusProps) {
	return (
		<Badge
			variant="outline"
			data-status={state}
			className={cn("h-[1.375rem]", className)}
			{...props}
		>
			<span className="size-[0.4375rem] rounded-full bg-current" aria-hidden />
			<span>{label}</span>
			{elapsed ? <span className="font-normal tabular-nums opacity-70">{elapsed}</span> : null}
			{meta ? <span className="font-normal opacity-70">{meta}</span> : null}
		</Badge>
	);
}

export { Status };
