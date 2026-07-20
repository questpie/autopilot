import { CheckIcon } from "lucide-react";
import type { ReactElement } from "react";

import type { ActorProjection } from "@questpie/ui/components/composites/actor";
import { ActorIdentity } from "@questpie/ui/components/composites/actor-identity";
import {
	Drawer,
	DrawerContent,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
} from "@questpie/ui/components/ui/drawer";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@questpie/ui/components/ui/dropdown-menu";
import { Item, ItemGroup, ItemTitle } from "@questpie/ui/components/ui/item";
import { useIsMobile } from "@questpie/ui/hooks/use-mobile";

export interface MenuItemConfig {
	id: string;
	label: string;
	tone?: "neutral" | "accent" | "danger";
	disabled?: boolean;
	selected?: boolean;
	actor?: ActorProjection;
	onSelect?: () => void;
}

interface AdaptiveMenuProps {
	trigger: ReactElement;
	label: string;
	items: readonly MenuItemConfig[];
}

function AdaptiveMenu({ trigger, label, items }: AdaptiveMenuProps) {
	const mobile = useIsMobile();

	if (mobile) {
		return (
			<Drawer showSwipeHandle>
				<DrawerTrigger data-adaptive-menu-trigger render={trigger} />
				<DrawerContent>
					<DrawerHeader>
						<DrawerTitle>{label}</DrawerTitle>
					</DrawerHeader>
					<ItemGroup className="adaptive-menu__items px-4" role="menu" aria-label={label}>
						{items.map((item) => (
							<Item
								key={item.id}
								className="min-h-12! rounded-[var(--radius-sm)]!"
								render={
									<button
										type="button"
										aria-label={item.label}
										role="menuitem"
										disabled={item.disabled}
										onClick={item.onSelect}
										aria-current={item.selected ? "true" : undefined}
									/>
								}
								data-tone={item.tone ?? "neutral"}
							>
								{item.actor ? (
									<ActorIdentity actor={item.actor} size="sm" />
								) : (
									<ItemTitle>{item.label}</ItemTitle>
								)}
								{item.selected ? <CheckIcon className="ml-auto" aria-hidden /> : null}
							</Item>
						))}
					</ItemGroup>
				</DrawerContent>
			</Drawer>
		);
	}

	return (
		<DropdownMenu modal={false}>
			<DropdownMenuTrigger data-adaptive-menu-trigger render={trigger} />
			<DropdownMenuContent>
				<DropdownMenuGroup>
					<DropdownMenuLabel>{label}</DropdownMenuLabel>
					{items.map((item) => (
						<DropdownMenuItem
							key={item.id}
							className="min-h-10! rounded-[var(--radius-sm)]!"
							variant={item.tone === "danger" ? "destructive" : "default"}
							disabled={item.disabled}
							onClick={item.onSelect}
							aria-current={item.selected ? "true" : undefined}
						>
							{item.actor ? <ActorIdentity actor={item.actor} size="sm" /> : item.label}
							{item.selected ? <CheckIcon className="ml-auto" aria-hidden /> : null}
						</DropdownMenuItem>
					))}
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export { AdaptiveMenu };
