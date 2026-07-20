import type { ComponentType } from "react";
import { ArrowRightIcon, PlusIcon, SparklesIcon, TriangleAlertIcon } from "lucide-react";

import type { ActorProjection } from "@questpie/ui/components/composites/actor";
import { ActorIdentity } from "@questpie/ui/components/composites/actor-identity";
import type { ActorMarkProps } from "@questpie/ui/components/composites/actor-mark";
import { Alert, AlertDescription, AlertTitle } from "@questpie/ui/components/ui/alert";
import { Badge } from "@questpie/ui/components/ui/badge";
import { Button } from "@questpie/ui/components/ui/button";
import {
	Command,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from "@questpie/ui/components/ui/command";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@questpie/ui/components/ui/dialog";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle,
} from "@questpie/ui/components/ui/drawer";
import { Spinner } from "@questpie/ui/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@questpie/ui/components/ui/toggle-group";
import { useIsMobile } from "@questpie/ui/hooks/use-mobile";

type CommandPaletteIcon = ComponentType<{ "aria-hidden"?: boolean }>;

export type CommandPaletteMode = "jump" | "create" | "generate";

export interface CommandPaletteItem {
	id: string;
	label: string;
	meta?: string;
	shortcut?: string;
	icon?: CommandPaletteIcon;
	actor?: ActorProjection;
	presence?: ActorMarkProps["presence"];
	disabled?: boolean;
	onSelect?: () => void;
}

export interface CommandPaletteGroup {
	id: string;
	label: string;
	detail?: string;
	items: CommandPaletteItem[];
}

export interface CommandPaletteGenerateAction {
	label: string;
	detail?: string;
	shortcut?: string;
	actionLabel: string;
	icon?: CommandPaletteIcon;
	onSelect: () => void;
}

export type CommandPaletteStatus =
	| { kind: "ready" }
	| { kind: "loading"; message: string }
	| { kind: "empty"; message: string }
	| { kind: "error"; message: string };

export interface CommandPaletteProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	query: string;
	onQueryChange: (query: string) => void;
	mode: CommandPaletteMode;
	onModeChange: (mode: CommandPaletteMode) => void;
	scope: { label: string; value: string };
	groups: CommandPaletteGroup[];
	generate?: CommandPaletteGenerateAction;
	status?: CommandPaletteStatus;
	title?: string;
	description?: string;
}

const modeOptions: Array<{
	value: CommandPaletteMode;
	label: string;
	icon: CommandPaletteIcon;
}> = [
	{ value: "jump", label: "Prejdi", icon: ArrowRightIcon },
	{ value: "create", label: "Vytvor", icon: PlusIcon },
	{ value: "generate", label: "Vygeneruj", icon: SparklesIcon },
];

function Shortcut({ children }: { children: string }) {
	return (
		<kbd className="command-palette__shortcut" aria-label={`Klávesová skratka ${children}`}>
			{children}
		</kbd>
	);
}

type PalettePanelProps = Pick<
	CommandPaletteProps,
	"query" | "onQueryChange" | "mode" | "onModeChange" | "scope" | "groups" | "generate" | "status"
>;

function PalettePanel({
	query,
	onQueryChange,
	mode,
	onModeChange,
	scope,
	groups,
	generate,
	status = { kind: "ready" },
}: PalettePanelProps) {
	const GenerateIcon = generate?.icon ?? SparklesIcon;

	return (
		<Command data-slot="command-palette" label="Hľadať alebo vyvolať" shouldFilter={false}>
			<CommandInput
				value={query}
				onValueChange={onQueryChange}
				placeholder="Povedzte, čo treba — alebo vyvolajte nástroj…"
				aria-label="Hľadať alebo vyvolať"
				shortcut="esc"
			/>

			<div className="command-palette__controls">
				<ToggleGroup
					aria-label="Režim príkazovej palety"
					value={[mode]}
					onValueChange={(value) => {
						const next = value[0] as CommandPaletteMode | undefined;
						if (next) onModeChange(next);
					}}
				>
					{modeOptions.map((option) => {
						const Icon = option.icon;
						return (
							<ToggleGroupItem key={option.value} value={option.value} aria-label={option.label}>
								<Icon aria-hidden />
								{option.label}
							</ToggleGroupItem>
						);
					})}
				</ToggleGroup>
				<Badge variant="outline" aria-label={`Rozsah ${scope.label}: ${scope.value}`}>
					{scope.label}: {scope.value}
				</Badge>
			</div>

			<CommandList className="command-palette__list min-h-0! max-h-none! flex-1!">
				{status.kind === "ready" ? (
					<>
						{groups.map((group, index) => (
							<div key={group.id}>
								{index > 0 ? <CommandSeparator /> : null}
								<CommandGroup
									heading={
										<span className="command-palette__group-heading">
											<span>{group.label}</span>
											{group.detail ? <span>{group.detail}</span> : null}
										</span>
									}
								>
									{group.items.map((item) => {
										const Icon = item.icon;
										return (
											<CommandItem
												key={item.id}
												value={item.label}
												disabled={item.disabled}
												onSelect={item.onSelect}
											>
												{item.actor ? (
													<ActorIdentity actor={item.actor} size="sm" presence={item.presence} />
												) : (
													<>
														{Icon ? <Icon aria-hidden /> : null}
														<span className="command-palette__item-label" title={item.label}>
															{item.label}
														</span>
													</>
												)}
												{item.meta ? (
													<span className="command-palette__item-meta">{item.meta}</span>
												) : null}
												{item.shortcut ? <Shortcut>{item.shortcut}</Shortcut> : null}
											</CommandItem>
										);
									})}
								</CommandGroup>
							</div>
						))}
						{groups.length === 0 ? (
							<CommandGroup>
								<CommandItem disabled className="command-palette__feedback">
									Nenašla sa žiadna zhoda.
								</CommandItem>
							</CommandGroup>
						) : null}
					</>
				) : (
					<CommandGroup>
						<CommandItem disabled className="command-palette__feedback-panel">
							{status.kind === "error" ? (
								<Alert variant="destructive">
									<TriangleAlertIcon />
									<AlertTitle>Vyhľadávanie nie je dostupné</AlertTitle>
									<AlertDescription>{status.message}</AlertDescription>
								</Alert>
							) : (
								<>
									{status.kind === "loading" ? <Spinner /> : null}
									<output>{status.message}</output>
								</>
							)}
						</CommandItem>
					</CommandGroup>
				)}
			</CommandList>

			{generate ? (
				<div className="command-palette__generate">
					<div className="command-palette__generate-heading">
						<strong>Vygenerovať</strong>
						<span>žiadna presná zhoda → nový výsledok</span>
					</div>
					{generate.detail ? <p>{generate.detail}</p> : null}
					<div className="command-palette__generate-action">
						<GenerateIcon aria-hidden />
						<span title={generate.label}>{generate.label}</span>
						{generate.shortcut ? <Shortcut>{generate.shortcut}</Shortcut> : null}
						<Button size="sm" onClick={generate.onSelect}>
							<SparklesIcon data-icon="inline-start" />
							{generate.actionLabel}
						</Button>
					</div>
				</div>
			) : null}

			<div className="command-palette__footer" aria-label="Klávesové ovládanie">
				<span>
					<Shortcut>↑</Shortcut>
					<Shortcut>↓</Shortcut> navigovať
				</span>
				<span>
					<Shortcut>↵</Shortcut> otvoriť
				</span>
				<span>
					<Shortcut>esc</Shortcut> zavrieť
				</span>
			</div>
		</Command>
	);
}

function CommandPalette({
	open,
	onOpenChange,
	title = "Príkazová paleta",
	description = "Vyhľadajte, prejdite, vytvorte alebo vygenerujte výsledok v aktívnom rozsahu.",
	...panelProps
}: CommandPaletteProps) {
	const mobile = useIsMobile();

	if (mobile) {
		return (
			<Drawer open={open} onOpenChange={onOpenChange} showSwipeHandle>
				<DrawerContent
					data-presentation="sheet"
					className="[--drawer-content-max-height:92dvh] [--drawer-height:92dvh]"
				>
					<DrawerHeader className="sr-only">
						<DrawerTitle>{title}</DrawerTitle>
						<DrawerDescription>{description}</DrawerDescription>
					</DrawerHeader>
					<PalettePanel {...panelProps} />
				</DrawerContent>
			</Drawer>
		);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				data-presentation="dialog"
				className="top-5! flex h-[min(50.75rem,calc(100dvh-2.5rem))] max-w-[min(40rem,calc(100%-2rem))]! translate-y-0! overflow-hidden p-0"
				showCloseButton={false}
			>
				<DialogHeader className="sr-only">
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<PalettePanel {...panelProps} />
			</DialogContent>
		</Dialog>
	);
}

export { CommandPalette };
