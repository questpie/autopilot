import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@questpie/ui/lib/utils";

function Empty({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="empty"
			className={cn(
				// Board .empty (states.css:8-9): centered island, gap 12, padding 48/24,
				// max-width 420px, no border. The dashed border was a dead invisible rule.
				"mx-auto flex w-full min-w-0 max-w-[26.25rem] flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center text-balance",
				className,
			)}
			{...props}
		/>
	);
}

function EmptyHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="empty-header"
			className={cn("flex max-w-sm flex-col items-center gap-2", className)}
			{...props}
		/>
	);
}

// Board .empty__ic (states.css:10-12): 44px medallion, radius-lg (18px), surface-mid
// fill, holding a 20px glyph. `icon-attention` is the .errorstate treatment
// (states.css:15) — a gold medallion for error/access states, never red.
const medallion =
	"flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-lg)] [&_svg:not([class*='size-'])]:size-5";

const emptyMediaVariants = cva(
	"mb-2 flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0",
	{
		variants: {
			variant: {
				default: "bg-transparent",
				icon: `${medallion} bg-muted text-muted-foreground`,
				"icon-attention": `${medallion} bg-warning-surface text-warning-foreground`,
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

function EmptyMedia({
	className,
	variant = "default",
	...props
}: React.ComponentProps<"div"> & VariantProps<typeof emptyMediaVariants>) {
	return (
		<div
			data-slot="empty-icon"
			data-variant={variant}
			className={cn(emptyMediaVariants({ variant, className }))}
			{...props}
		/>
	);
}

function EmptyTitle({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="empty-title"
			// Board .empty__title (states.css:13): text-xl (18px), semibold, -0.01em, 1.3.
			className={cn(
				"font-heading text-[length:var(--type-xl)] font-semibold -tracking-[0.01em] leading-[1.3]",
				className,
			)}
			{...props}
		/>
	);
}

function EmptyDescription({ className, ...props }: React.ComponentProps<"p">) {
	return (
		<div
			data-slot="empty-description"
			// Board .empty__hint (states.css:14): text-lg (15px), line-height 1.55.
			className={cn(
				"text-[length:var(--type-lg)] leading-[1.55] text-muted-foreground [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary",
				className,
			)}
			{...props}
		/>
	);
}

function EmptyContent({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="empty-content"
			className={cn(
				"flex w-full max-w-sm min-w-0 flex-col items-center gap-2.5 text-sm text-balance",
				className,
			)}
			{...props}
		/>
	);
}

export { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent, EmptyMedia };
