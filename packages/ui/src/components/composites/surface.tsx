import type { ComponentProps } from "react";

import { Card } from "@questpie/ui/components/ui/card";
import { cn } from "@questpie/ui/lib/utils";

export type SurfaceProps = ComponentProps<typeof Card> & {
	level?: "flat" | "raised" | "overlay";
	interactive?: boolean;
	selected?: boolean;
};

function Surface({ level = "flat", interactive, selected, className, ...props }: SurfaceProps) {
	return (
		<Card
			data-level={level}
			data-interactive={interactive || undefined}
			data-selected={selected || undefined}
			className={cn(
				"rounded-xl shadow-none",
				level === "flat" && "border-border-subtle bg-card",
				level === "raised" && "border-border bg-card shadow-sm",
				level === "overlay" && "border-border bg-popover shadow-md",
				interactive && "transition-colors hover:border-border",
				selected && "border-ring bg-accent",
				className,
			)}
			{...props}
		/>
	);
}

export { Surface };
