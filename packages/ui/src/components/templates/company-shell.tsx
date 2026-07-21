import { MenuIcon, MoreVerticalIcon, PlusIcon, SearchIcon, type LucideIcon } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";

import { ActorMark } from "@questpie/ui/components/composites/actor-mark";
import type { ActorProjection } from "@questpie/ui/components/composites/actor";
import { BrandMark } from "@questpie/ui/components/composites/brand-mark";
import { Button } from "@questpie/ui/components/ui/button";
import {
	Drawer,
	DrawerContent,
	DrawerHeader,
	DrawerTitle,
} from "@questpie/ui/components/ui/drawer";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarInset,
	SidebarProvider,
} from "@questpie/ui/components/ui/sidebar";
import {
	CompanyNavigationGlyph,
	CompanyShellNavigation,
	type CompanyNavigationItem,
	type CompanyNavigationSection,
	type MobileNavigationSlot,
} from "@questpie/ui/components/templates/company-shell-navigation";
import { useHydrated } from "@questpie/ui/hooks/use-hydrated";

export interface CompanyShellMobileContext {
	label: string;
	icon: LucideIcon;
	presence?: readonly ActorProjection[];
}

export interface CompanyShellProps {
	companyName: string;
	sections: readonly CompanyNavigationSection[];
	activeId: string;
	actor: ActorProjection;
	actorRole?: string;
	/** The actor's presence dot. Omitted by default — presence is injected data, never assumed. */
	actorPresence?: "online" | "away" | "offline";
	commandLabel: string;
	createLabel?: string;
	mobileContext?: CompanyShellMobileContext;
	children: ReactNode;
	onNavigate?: (id: string) => void;
	onOpenCommand?: () => void;
	onCreate?: () => void;
	onOpenActorMenu?: () => void;
	footerNotice?: ReactNode;
	openNavigationLabel?: string;
	mobileNavigationLabel?: string;
	actorMenuLabel?: string;
}

const mobileSlotOrder: readonly MobileNavigationSlot[] = ["home", "spaces", "inbox", "self"];

function CompanyIdentity({ companyName }: { companyName: string }) {
	return (
		<div data-slot="company-identity" className="flex min-h-9 items-center gap-2 px-2">
			<BrandMark size={20} />
			<strong className="truncate text-[0.9375rem] font-semibold">{companyName}</strong>
		</div>
	);
}

function CompanyActorIdentity({
	actor,
	role,
	presence,
	menuLabel,
	onOpenMenu,
}: {
	actor: ActorProjection;
	role?: string;
	presence?: "online" | "away" | "offline";
	menuLabel: string;
	onOpenMenu?: () => void;
}) {
	return (
		<div data-slot="company-actor-identity" className="flex min-w-0 items-center gap-2">
			<ActorMark actor={actor} size="sm" presence={presence} />
			<span className="min-w-0 flex-1">
				<strong className="block truncate text-[0.8125rem] font-medium">{actor.name}</strong>
				{role ? (
					<small className="block truncate text-[0.6875rem] text-ink-muted">{role}</small>
				) : null}
			</span>
			<Button variant="ghost" size="icon-xs" aria-label={menuLabel} onClick={onOpenMenu}>
				<MoreVerticalIcon />
			</Button>
		</div>
	);
}

function collectMobileItems(sections: readonly CompanyNavigationSection[]) {
	const bySlot = new Map<MobileNavigationSlot, CompanyNavigationItem>();
	for (const item of sections.flatMap((section) => section.items)) {
		if (item.mobileSlot) bySlot.set(item.mobileSlot, item);
	}
	return mobileSlotOrder.flatMap((slot) => {
		const item = bySlot.get(slot);
		return item ? [{ slot, item }] : [];
	});
}

function CompanyShell({
	companyName,
	sections,
	activeId,
	actor,
	actorRole,
	actorPresence,
	commandLabel,
	createLabel = "Vytvoriť",
	mobileContext,
	children,
	onNavigate,
	onOpenCommand,
	onCreate,
	onOpenActorMenu,
	footerNotice,
	openNavigationLabel = "Otvoriť navigáciu",
	mobileNavigationLabel = "Hlavná mobilná navigácia",
	actorMenuLabel = "Otvoriť menu aktéra",
}: CompanyShellProps) {
	const [drawerOpen, setDrawerOpen] = useState(false);
	const hydrated = useHydrated();
	const mobileItems = useMemo(() => collectMobileItems(sections), [sections]);
	const navigate = (id: string) => {
		onNavigate?.(id);
		setDrawerOpen(false);
	};
	const MobileContextIcon = mobileContext?.icon;

	return (
		<div data-slot="company-shell">
			<SidebarProvider className="min-h-dvh">
				<Sidebar collapsible="none" className="hidden min-h-dvh border-r border-hairline lg:flex">
					<div data-slot="company-rail" className="contents">
						<SidebarHeader className="gap-1 p-2">
							<CompanyIdentity companyName={companyName} />
							<Button
								variant="secondary"
								className="company-command w-full justify-start text-ink-muted"
								onClick={onOpenCommand}
							>
								<SearchIcon data-icon="inline-start" />
								<span className="truncate">{commandLabel}</span>
								<span className="ui-type-meta ml-auto">⌘K</span>
							</Button>
						</SidebarHeader>
						<SidebarContent className="px-1 py-1">
							<CompanyShellNavigation
								sections={sections}
								activeId={activeId}
								onNavigate={navigate}
							/>
						</SidebarContent>
						<SidebarFooter className="gap-2 border-t border-hairline p-2">
							{footerNotice}
							<CompanyActorIdentity
								actor={actor}
								role={actorRole}
								presence={actorPresence}
								menuLabel={actorMenuLabel}
								onOpenMenu={onOpenActorMenu}
							/>
						</SidebarFooter>
					</div>
				</Sidebar>
				<SidebarInset className="min-h-dvh min-w-0 bg-canvas">
					<header
						data-slot="mobile-place-header"
						className="sticky top-0 flex items-center gap-3 border-b border-hairline px-3 lg:hidden"
					>
						<Button
							variant="ghost"
							size="icon"
							aria-label={openNavigationLabel}
							onClick={() => setDrawerOpen(true)}
						>
							<MenuIcon />
						</Button>
						{MobileContextIcon ? <MobileContextIcon aria-hidden /> : null}
						<strong className="truncate text-[0.9375rem] font-semibold">
							{mobileContext?.label ?? companyName}
						</strong>
						{mobileContext?.presence?.length ? (
							<div data-slot="mobile-context-presence" className="ml-auto flex -space-x-1.5">
								{mobileContext.presence.slice(0, 3).map((member) => (
									<ActorMark key={member.id} actor={member} size="sm" />
								))}
							</div>
						) : (
							<Button
								variant="ghost"
								size="icon"
								aria-label={commandLabel}
								onClick={onOpenCommand}
								className="ml-auto"
							>
								<SearchIcon />
							</Button>
						)}
					</header>
					<div data-slot="app-shell-content" className="ui-app-shell-content min-w-0 lg:pb-0">
						{children}
					</div>
					<nav
						className="ui-app-shell-mobile-nav fixed inset-x-0 bottom-0 grid border-t border-hairline lg:hidden"
						aria-label={mobileNavigationLabel}
					>
						{mobileItems.slice(0, 2).map(({ slot, item }) => (
							<Button
								className="flex-col gap-1 px-1 text-[length:var(--type-xs)] font-medium"
								variant="ghost"
								key={item.id}
								data-part="mobile-nav-item"
								data-mobile-slot={slot}
								data-active={item.id === activeId || undefined}
								onClick={() => navigate(item.id)}
								aria-label={item.label}
							>
								<CompanyNavigationGlyph item={item} />
								<span data-part="mobile-nav-label" className="max-w-full truncate">
									{item.mobileLabel ?? item.label}
								</span>
							</Button>
						))}
						<Button
							data-part="mobile-create"
							size="icon-lg"
							aria-label={createLabel}
							onClick={onCreate}
						>
							<PlusIcon />
						</Button>
						{mobileItems.slice(2).map(({ slot, item }) => (
							<Button
								className="flex-col gap-1 px-1 text-[length:var(--type-xs)] font-medium"
								variant="ghost"
								key={item.id}
								data-part="mobile-nav-item"
								data-mobile-slot={slot}
								data-active={item.id === activeId || undefined}
								onClick={() => navigate(item.id)}
								aria-label={item.label}
							>
								<CompanyNavigationGlyph item={item} />
								<span data-part="mobile-nav-label" className="max-w-full truncate">
									{item.mobileLabel ?? item.label}
								</span>
							</Button>
						))}
					</nav>
				</SidebarInset>
				{hydrated ? (
					<Drawer open={drawerOpen} onOpenChange={setDrawerOpen} swipeDirection="left">
						<DrawerContent className="company-navigation-drawer">
							<DrawerHeader className="sr-only">
								<DrawerTitle>{companyName}</DrawerTitle>
							</DrawerHeader>
							<div className="flex min-h-0 flex-1 flex-col bg-sidebar text-sidebar-foreground">
								<div className="p-2">
									<CompanyIdentity companyName={companyName} />
								</div>
								<div className="min-h-0 flex-1 overflow-y-auto px-1">
									<CompanyShellNavigation
										sections={sections}
										activeId={activeId}
										onNavigate={navigate}
									/>
								</div>
								<div className="border-t border-hairline p-2">
									<CompanyActorIdentity
										actor={actor}
										role={actorRole}
										presence={actorPresence}
										menuLabel={actorMenuLabel}
										onOpenMenu={onOpenActorMenu}
									/>
								</div>
							</div>
						</DrawerContent>
					</Drawer>
				) : null}
			</SidebarProvider>
		</div>
	);
}

export { CompanyShell };
