import * as React from "react";
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";
import { type VariantProps } from "class-variance-authority";

import { cn } from "@questpie/ui/lib/utils";
import { toggleVariants } from "@questpie/ui/components/ui/toggle";

type ToggleGroupSpacing = 0 | 1 | 2 | 3 | 4;

const spacingClasses: Record<ToggleGroupSpacing, string> = {
	0: "gap-0",
	1: "gap-1",
	2: "gap-2",
	3: "gap-3",
	4: "gap-4",
};

const ToggleGroupContext = React.createContext<
	VariantProps<typeof toggleVariants> & {
		spacing?: ToggleGroupSpacing;
		orientation?: "horizontal" | "vertical";
	}
>({
	size: "sm",
	variant: "default",
	spacing: undefined,
	orientation: "horizontal",
});

function ToggleGroup({
	className,
	variant,
	size = "sm",
	spacing,
	orientation = "horizontal",
	children,
	...props
}: ToggleGroupPrimitive.Props &
	VariantProps<typeof toggleVariants> & {
		spacing?: ToggleGroupSpacing;
		orientation?: "horizontal" | "vertical";
	}) {
	return (
		<ToggleGroupPrimitive
			data-slot="toggle-group"
			data-variant={variant}
			data-size={size}
			data-spacing={spacing}
			data-orientation={orientation}
			className={cn(
				"group/toggle-group flex w-fit flex-row items-center rounded-[var(--switcher-radius)] border border-border-subtle bg-muted p-[var(--switcher-pad)] data-vertical:flex-col data-vertical:items-stretch",
				spacing === undefined ? "gap-[var(--switcher-gap)]" : spacingClasses[spacing],
				className,
			)}
			{...props}
		>
			<ToggleGroupContext.Provider value={{ variant, size, spacing, orientation }}>
				{children}
			</ToggleGroupContext.Provider>
		</ToggleGroupPrimitive>
	);
}

function ToggleGroupItem({
	className,
	children,
	variant = "default",
	size = "sm",
	...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
	const context = React.useContext(ToggleGroupContext);

	return (
		<TogglePrimitive
			data-slot="toggle-group-item"
			data-variant={context.variant || variant}
			data-size={context.size || size}
			data-spacing={context.spacing}
			className={cn(
				"shrink-0 focus:z-10 focus-visible:z-10",
				toggleVariants({
					variant: context.variant || variant,
					size: context.size || size,
				}),
				"min-w-0 rounded-[var(--switcher-seg-radius)] border-transparent bg-transparent px-3 text-[length:var(--type-md)] leading-none text-muted-foreground shadow-none hover:bg-accent hover:text-foreground aria-pressed:bg-card aria-pressed:text-foreground [&_svg:not([class*='size-'])]:size-[var(--switcher-seg-icon)]",
				className,
			)}
			{...props}
		>
			{children}
		</TogglePrimitive>
	);
}

export { ToggleGroup, ToggleGroupItem };
