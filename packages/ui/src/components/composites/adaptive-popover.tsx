import type { ReactElement, ReactNode } from "react";

import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
} from "@questpie/ui/components/ui/drawer";
import {
	Popover,
	PopoverContent,
	PopoverDescription,
	PopoverHeader,
	PopoverTitle,
	PopoverTrigger,
} from "@questpie/ui/components/ui/popover";
import { useIsMobile } from "@questpie/ui/hooks/use-mobile";

function AdaptivePopover({
	trigger,
	title,
	description,
	children,
	open,
	onOpenChange,
}: {
	trigger: ReactElement;
	title: string;
	description?: string;
	children: ReactNode;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
}) {
	const mobile = useIsMobile();
	if (mobile)
		return (
			<Drawer open={open} onOpenChange={onOpenChange} showSwipeHandle>
				<DrawerTrigger render={trigger} />
				<DrawerContent>
					<DrawerHeader>
						<DrawerTitle>{title}</DrawerTitle>
						{description ? <DrawerDescription>{description}</DrawerDescription> : null}
					</DrawerHeader>
					<div className="px-4 pb-6">{children}</div>
				</DrawerContent>
			</Drawer>
		);
	return (
		<Popover open={open} onOpenChange={onOpenChange}>
			<PopoverTrigger render={trigger} />
			<PopoverContent>
				<PopoverHeader>
					<PopoverTitle>{title}</PopoverTitle>
					{description ? <PopoverDescription>{description}</PopoverDescription> : null}
				</PopoverHeader>
				{children}
			</PopoverContent>
		</Popover>
	);
}

export { AdaptivePopover };
