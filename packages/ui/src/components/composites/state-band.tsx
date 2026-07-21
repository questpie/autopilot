import type { ReactNode } from "react";

import { cn } from "@questpie/ui/lib/utils";

export type StateBandTone = "neutral" | "live" | "attention" | "danger";

export interface StateBandProps {
	tone?: StateBandTone;
	label: string;
	meta?: ReactNode;
	action?: ReactNode;
	className?: string;
}

function StateBand({ tone = "neutral", label, meta, action, className }: StateBandProps) {
	return (
		<div
			data-slot="state-band"
			data-tone={tone}
			role="status"
			className={cn(
				"flex min-h-7 items-center gap-2 border-b border-border-subtle px-3 text-xs",
				className,
			)}
		>
			<span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden />
			<strong className="min-w-0 truncate font-medium">{label}</strong>
			{meta ? <span className="ui-type-meta ml-auto shrink-0">{meta}</span> : null}
			{action}
		</div>
	);
}

export { StateBand };
