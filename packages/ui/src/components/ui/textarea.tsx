import * as React from "react";

import { cn } from "@questpie/ui/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
	return (
		<textarea
			data-slot="textarea"
			className={cn(
				"flex field-sizing-content min-h-11 w-full rounded-[var(--radius-md)] border border-input bg-card px-3 py-3 text-[0.9375rem] transition-[background-color,border-color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-border-strong focus-visible:ring-3 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
				className,
			)}
			{...props}
		/>
	);
}

export { Textarea };
