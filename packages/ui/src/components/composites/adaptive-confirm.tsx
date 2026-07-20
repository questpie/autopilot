import type { ReactElement } from "react";
import { useState } from "react";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@questpie/ui/components/ui/alert-dialog";
import { Button } from "@questpie/ui/components/ui/button";
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

export interface AdaptiveConfirmProps {
	trigger?: ReactElement;
	title: string;
	description: string;
	confirmLabel: string;
	cancelLabel?: string;
	destructive?: boolean;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	onConfirm: () => void;
}

function AdaptiveConfirm({
	trigger,
	title,
	description,
	confirmLabel,
	cancelLabel = "Zrušiť",
	destructive,
	open,
	onOpenChange,
	onConfirm,
}: AdaptiveConfirmProps) {
	const mobile = useIsMobile();
	const [internalOpen, setInternalOpen] = useState(false);
	const resolvedOpen = open === undefined ? internalOpen : open;

	function setOpen(nextOpen: boolean) {
		if (open === undefined) {
			setInternalOpen(nextOpen);
		}
		onOpenChange?.(nextOpen);
	}

	function confirm() {
		onConfirm();
		setOpen(false);
	}

	if (mobile) {
		return (
			<Drawer open={resolvedOpen} onOpenChange={setOpen} showSwipeHandle>
				{trigger ? <DrawerTrigger render={trigger} /> : null}
				<DrawerContent>
					<DrawerHeader>
						<DrawerTitle>{title}</DrawerTitle>
						<DrawerDescription>{description}</DrawerDescription>
					</DrawerHeader>
					<DrawerFooter>
						<Button variant={destructive ? "destructive" : "default"} onClick={confirm}>
							{confirmLabel}
						</Button>
						<Button variant="secondary" onClick={() => setOpen(false)}>
							{cancelLabel}
						</Button>
					</DrawerFooter>
				</DrawerContent>
			</Drawer>
		);
	}

	return (
		<AlertDialog open={resolvedOpen} onOpenChange={setOpen}>
			{trigger ? <AlertDialogTrigger render={trigger} /> : null}
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{title}</AlertDialogTitle>
					<AlertDialogDescription>{description}</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
					<AlertDialogAction variant={destructive ? "destructive" : "default"} onClick={confirm}>
						{confirmLabel}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

export { AdaptiveConfirm };
