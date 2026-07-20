import type { ReactElement, ReactNode } from "react";

import {
	Drawer,
	DrawerContent,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
} from "@questpie/ui/components/ui/drawer";
import { Tooltip, TooltipContent, TooltipTrigger } from "@questpie/ui/components/ui/tooltip";
import { useIsMobile } from "@questpie/ui/hooks/use-mobile";

function AdaptiveTooltip({
	trigger,
	title,
	children,
}: {
	trigger: ReactElement;
	title: string;
	children: ReactNode;
}) {
	const mobile = useIsMobile();
	if (mobile)
		return (
			<Drawer showSwipeHandle>
				<DrawerTrigger render={trigger} />
				<DrawerContent>
					<DrawerHeader>
						<DrawerTitle>{title}</DrawerTitle>
					</DrawerHeader>
					<div className="px-4 pb-6 text-sm text-muted-foreground">{children}</div>
				</DrawerContent>
			</Drawer>
		);
	return (
		<Tooltip>
			<TooltipTrigger render={trigger} />
			<TooltipContent>{children}</TooltipContent>
		</Tooltip>
	);
}

export { AdaptiveTooltip };
