import { HashIcon, type LucideIcon } from "lucide-react";

import { ActorMark } from "@questpie/ui/components/composites/actor-mark";
import type { ActorProjection } from "@questpie/ui/components/composites/actor";
import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@questpie/ui/components/ui/sidebar";

export type MobileNavigationSlot = "home" | "spaces" | "inbox" | "self";

interface CompanyNavigationItemBase {
	id: string;
	label: string;
	mobileLabel?: string;
	mobileSlot?: MobileNavigationSlot;
}

export interface AttentionNavigationItem extends CompanyNavigationItemBase {
	kind: "attention";
	icon: LucideIcon;
	badge?: number;
}

export interface SpaceNavigationItem extends CompanyNavigationItemBase {
	kind: "space";
	icon?: LucideIcon;
	memberCount?: number;
}

export interface ChannelNavigationItem extends CompanyNavigationItemBase {
	kind: "channel";
	unreadCount?: number;
}

export interface DirectNavigationItem extends CompanyNavigationItemBase {
	kind: "direct";
	actor: ActorProjection;
	presence?: "online" | "away" | "offline";
	icon?: LucideIcon;
}

export interface ResourceNavigationItem extends CompanyNavigationItemBase {
	kind: "resource";
	icon: LucideIcon;
}

export type CompanyNavigationItem =
	| AttentionNavigationItem
	| SpaceNavigationItem
	| ChannelNavigationItem
	| DirectNavigationItem
	| ResourceNavigationItem;

export interface CompanyNavigationSection {
	id: string;
	label?: string;
	items: readonly CompanyNavigationItem[];
}

function CompanyNavigationGlyph({ item }: { item: CompanyNavigationItem }) {
	if (item.kind === "direct") {
		return <ActorMark actor={item.actor} size="sm" presence={item.presence} />;
	}
	if (item.kind === "channel") {
		return <HashIcon aria-hidden />;
	}
	if (item.kind === "space" && !item.icon) {
		return <span data-slot="space-mark" aria-hidden />;
	}
	if (!item.icon) return null;
	const Icon = item.icon;
	return <Icon aria-hidden />;
}

function itemMeta(item: CompanyNavigationItem) {
	if (item.kind === "attention") return item.badge;
	if (item.kind === "space") return item.memberCount;
	if (item.kind === "channel") return item.unreadCount;
	return undefined;
}

function CompanyShellNavigation({
	sections,
	activeId,
	onNavigate,
}: {
	sections: readonly CompanyNavigationSection[];
	activeId: string;
	onNavigate: (id: string) => void;
}) {
	return sections.map((section) => (
		<SidebarGroup className="py-1" key={section.id} data-section={section.id}>
			{section.label ? (
				<SidebarGroupLabel className="ui-eyebrow h-6 px-2">{section.label}</SidebarGroupLabel>
			) : null}
			<SidebarGroupContent>
				<SidebarMenu className="gap-0.5">
					{section.items.map((item) => {
						const meta = itemMeta(item);
						return (
							<SidebarMenuItem key={item.id}>
								<SidebarMenuButton
									isActive={item.id === activeId}
									onClick={() => onNavigate(item.id)}
									data-kind={item.kind}
									data-mobile-slot={item.mobileSlot}
									className="company-navigation-row text-[length:var(--type-lg)] font-medium"
								>
									<CompanyNavigationGlyph item={item} />
									<span>{item.label}</span>
									{meta !== undefined ? (
										<SidebarMenuBadge className="ui-type-meta">{meta}</SidebarMenuBadge>
									) : null}
								</SidebarMenuButton>
							</SidebarMenuItem>
						);
					})}
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	));
}

export { CompanyNavigationGlyph, CompanyShellNavigation };
