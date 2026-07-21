import type { ComponentProps } from "react";

import { Surface } from "@questpie/ui/components/composites/surface";
import { CardContent, CardFooter, CardHeader } from "@questpie/ui/components/ui/card";
import { cn } from "@questpie/ui/lib/utils";

function WorkBlock({ className, ...props }: ComponentProps<typeof Surface>) {
	return (
		<Surface
			level="flat"
			data-slot="work-block"
			className={cn(
				"w-full max-w-2xl gap-0! overflow-hidden rounded-[var(--radius-md)] py-0!",
				className,
			)}
			{...props}
		/>
	);
}

function WorkBlockHeader({ className, ...props }: ComponentProps<typeof CardHeader>) {
	return (
		<CardHeader
			data-slot="work-block-header"
			// Board .approval__head .ic (primitives.css:61): 14px caution glyph.
			className={cn(
				"flex min-h-11 flex-row items-center gap-2 border-b border-border-subtle px-3 py-2 text-[length:var(--type-md)] text-muted-foreground [&_svg:not([class*='size-'])]:size-[var(--icon-banner)]",
				className,
			)}
			{...props}
		/>
	);
}

function WorkBlockContent({ className, ...props }: ComponentProps<typeof CardContent>) {
	return <CardContent data-slot="work-block-content" className={cn("p-0", className)} {...props} />;
}

function WorkBlockRow({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="work-block-row"
			// Board run-context row glyphs (.run__fail .ic, primitives.css:49): 15px.
			className={cn(
				"flex min-h-9 min-w-0 items-center gap-3 px-3 py-2 text-[length:var(--type-md)] not-last:border-b not-last:border-border-subtle [&_svg:not([class*='size-'])]:size-[var(--icon-control)]",
				className,
			)}
			{...props}
		/>
	);
}

function WorkBlockFooter({ className, ...props }: ComponentProps<typeof CardFooter>) {
	return (
		<CardFooter
			data-slot="work-block-footer"
			className={cn(
				"min-h-9 justify-between gap-2 border-t border-border-subtle px-3 py-1.5",
				className,
			)}
			{...props}
		/>
	);
}

export { WorkBlock, WorkBlockContent, WorkBlockFooter, WorkBlockHeader, WorkBlockRow };
