import type { ComponentProps, ReactNode } from "react";

import { cn } from "@questpie/ui/lib/utils";
import { Input } from "@questpie/ui/components/ui/input";

export interface IconInputProps extends ComponentProps<typeof Input> {
	/**
	 * Leading glyph. It is rendered as an absolute, non-interactive INSET element
	 * over a single full-width <Input> — never as a flex sibling. That keeps the
	 * control one continuous box, so focus ring, text selection, and (crucially)
	 * the browser's `-webkit-autofill` background all paint the whole field
	 * uniformly. A leading flex addon leaves its own cell a different colour under
	 * autofill, which reads as a seam splitting the field in two.
	 */
	icon: ReactNode;
}

function IconInput({ icon, className, ...props }: IconInputProps) {
	return (
		<div data-slot="icon-input" className="relative w-full">
			<span
				aria-hidden
				className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground [&>svg]:size-4"
			>
				{icon}
			</span>
			<Input className={cn("pl-9", className)} {...props} />
		</div>
	);
}

export { IconInput };
