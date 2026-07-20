import type { ReactElement, ReactNode } from "react";

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@questpie/ui/components/ui/dialog";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
} from "@questpie/ui/components/ui/drawer";
import { useIsMobile } from "@questpie/ui/hooks/use-mobile";

export interface AdaptiveModalProps {
	trigger?: ReactElement;
	title: string;
	description?: string;
	children: ReactNode;
	footer?: ReactNode;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
}

function AdaptiveModal({
	trigger,
	title,
	description,
	children,
	footer,
	open,
	onOpenChange,
}: AdaptiveModalProps) {
	const mobile = useIsMobile();
	if (mobile) {
		return (
			<Drawer open={open} onOpenChange={onOpenChange} showSwipeHandle>
				{trigger ? <DrawerTrigger render={trigger} /> : null}
				<DrawerContent>
					<DrawerHeader>
						<DrawerTitle>{title}</DrawerTitle>
						{description ? <DrawerDescription>{description}</DrawerDescription> : null}
					</DrawerHeader>
					<div className="min-h-0 overflow-y-auto px-4 py-2">{children}</div>
					{footer ? <DrawerFooter>{footer}</DrawerFooter> : null}
				</DrawerContent>
			</Drawer>
		);
	}
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			{trigger ? <DialogTrigger render={trigger} /> : null}
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					{description ? <DialogDescription>{description}</DialogDescription> : null}
				</DialogHeader>
				{children}
				{footer ? <DialogFooter>{footer}</DialogFooter> : null}
			</DialogContent>
		</Dialog>
	);
}

export { AdaptiveModal };
