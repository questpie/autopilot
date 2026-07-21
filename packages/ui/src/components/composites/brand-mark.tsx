import type { ComponentProps } from "react";

import { cn } from "@questpie/ui/lib/utils";

export interface BrandMarkProps extends Omit<ComponentProps<"svg">, "children"> {
	size?: number;
}

function BrandMark({ size = 26, className, ...props }: BrandMarkProps) {
	return (
		<svg
			data-slot="company-brand-mark"
			viewBox="0 0 24 24"
			width={size}
			height={size}
			fill="none"
			aria-hidden
			className={cn("shrink-0", className)}
			{...props}
		>
			<path d="M22 10V2H2V22H10" stroke="currentColor" strokeWidth={2} strokeLinecap="square" />
			<path d="M23 13H13V23H23V13Z" style={{ fill: "var(--action)" }} />
		</svg>
	);
}

export { BrandMark };
