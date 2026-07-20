import type { ComponentProps } from "react";

import { cn } from "@questpie/ui/lib/utils";

export interface TechnicalTagProps extends ComponentProps<"span"> {
	tone?: "neutral" | "agent";
}

function TechnicalTag({ tone = "neutral", className, ...props }: TechnicalTagProps) {
	return (
		<span
			data-slot="technical-tag"
			data-tone={tone}
			className={cn(
				"ui-mono inline-flex h-[1.125rem] max-w-40 shrink-0 items-center rounded-[0.375rem] px-1.5 font-medium",
				className,
			)}
			{...props}
		/>
	);
}

export { TechnicalTag };
