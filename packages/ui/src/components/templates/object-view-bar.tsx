import {
	Columns2Icon,
	FilterIcon,
	LayoutListIcon,
	PlusIcon,
	SearchIcon,
	ListFilterIcon,
	Settings2Icon,
	SlidersHorizontalIcon,
	SparklesIcon,
	type LucideIcon,
} from "lucide-react";

import { AdaptiveMenu } from "@questpie/ui/components/composites/adaptive-menu";
import { Button } from "@questpie/ui/components/ui/button";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@questpie/ui/components/ui/input-group";
import { ToggleGroup, ToggleGroupItem } from "@questpie/ui/components/ui/toggle-group";

export type ObjectDisplayMode = "list" | "board";

export interface ObjectViewPresetProjection {
	id: string;
	label: string;
	icon?: LucideIcon;
	tone?: "neutral" | "live";
	agentAuthored?: boolean;
}

export interface ObjectViewBarProps {
	presets: readonly ObjectViewPresetProjection[];
	activePresetId: string;
	groupLabel: string;
	filterLabel: string;
	sortLabel: string;
	searchLabel: string;
	displayMode: ObjectDisplayMode;
	displayModes?: readonly ObjectDisplayMode[];
	createLabel?: string;
	onPresetChange?: (id: string) => void;
	onGroup?: () => void;
	onFilter?: () => void;
	onSort?: () => void;
	onSearch?: (query: string) => void;
	onDisplayModeChange?: (mode: ObjectDisplayMode) => void;
	onCreate?: () => void;
}

function ObjectViewBar({
	presets,
	activePresetId,
	groupLabel,
	filterLabel,
	sortLabel,
	searchLabel,
	displayMode,
	displayModes = ["list", "board"],
	createLabel,
	onPresetChange,
	onGroup,
	onFilter,
	onSort,
	onSearch,
	onDisplayModeChange,
	onCreate,
}: ObjectViewBarProps) {
	const mobileTools = [
		...presets.map((preset) => ({
			id: `preset-${preset.id}`,
			label: preset.label,
			selected: preset.id === activePresetId,
			onSelect: () => onPresetChange?.(preset.id),
		})),
		{ id: "group", label: groupLabel, onSelect: onGroup },
		{ id: "filter", label: filterLabel, onSelect: onFilter },
		{ id: "sort", label: sortLabel, onSelect: onSort },
		...displayModes.map((mode) => ({
			id: `display-${mode}`,
			label: mode === "list" ? "Zoznam" : "Tabuľa",
			selected: mode === displayMode,
			onSelect: () => onDisplayModeChange?.(mode),
		})),
		...(createLabel
			? [{ id: "create", label: createLabel, tone: "accent" as const, onSelect: onCreate }]
			: []),
	];

	return (
		<div data-slot="object-view-bar" className="object-view-bar border-b border-border-subtle">
			<ToggleGroup
				aria-label="Uložené pohľady"
				value={[activePresetId]}
				onValueChange={(value) => value[0] && onPresetChange?.(String(value[0]))}
				spacing={1}
				size="sm"
				className="object-view-bar__presets !rounded-none !border-0 !bg-transparent !p-0"
			>
				{presets.map((preset) => {
					const Icon = preset.icon;
					return (
						<ToggleGroupItem
							key={preset.id}
							value={preset.id}
							data-tone={preset.tone ?? "neutral"}
							data-agent-authored={preset.agentAuthored || undefined}
						>
							{preset.agentAuthored ? <SparklesIcon data-icon="inline-start" aria-hidden /> : null}
							{Icon ? <Icon data-icon="inline-start" aria-hidden /> : null}
							{preset.tone === "live" ? (
								<span className="size-1.5 rounded-full bg-primary" aria-hidden />
							) : null}
							{preset.label}
						</ToggleGroupItem>
					);
				})}
			</ToggleGroup>

			<div className="object-view-bar__mobile-tools">
				<AdaptiveMenu
					label="Nástroje úloh"
					items={mobileTools}
					trigger={
						<Button variant="secondary" size="icon" aria-label="Nástroje úloh">
							<SlidersHorizontalIcon aria-hidden />
						</Button>
					}
				/>
			</div>
			<div className="object-view-bar__tools">
				<Button variant="secondary" size="sm" onClick={onGroup}>
					<Settings2Icon data-icon="inline-start" />
					{groupLabel}
				</Button>
				<Button variant="secondary" size="sm" onClick={onFilter}>
					<FilterIcon data-icon="inline-start" />
					{filterLabel}
				</Button>
				<Button
					variant="secondary"
					size="icon-sm"
					aria-label={sortLabel}
					title={sortLabel}
					onClick={onSort}
				>
					<ListFilterIcon aria-hidden />
				</Button>
				<InputGroup className="object-view-bar__search w-[11.25rem]!">
					<InputGroupInput
						aria-label={searchLabel}
						placeholder={searchLabel}
						onChange={(event) => onSearch?.(event.currentTarget.value)}
					/>
					<InputGroupAddon align="inline-start">
						<SearchIcon aria-hidden />
					</InputGroupAddon>
				</InputGroup>
				{displayModes.length > 1 ? (
					<ToggleGroup
						aria-label="Zobrazenie"
						value={[displayMode]}
						onValueChange={(value) => {
							const mode = value[0];
							if (mode && displayModes.includes(mode as ObjectDisplayMode)) {
								onDisplayModeChange?.(mode as ObjectDisplayMode);
							}
						}}
						size="sm"
					>
						{displayModes.includes("list") ? (
							<ToggleGroupItem value="list">
								<LayoutListIcon data-icon="inline-start" aria-hidden />
								Zoznam
							</ToggleGroupItem>
						) : null}
						{displayModes.includes("board") ? (
							<ToggleGroupItem value="board">
								<Columns2Icon data-icon="inline-start" aria-hidden />
								Tabuľa
							</ToggleGroupItem>
						) : null}
					</ToggleGroup>
				) : null}
				{createLabel ? (
					<Button data-part="object-create-action" size="sm" onClick={onCreate}>
						<PlusIcon data-icon="inline-start" />
						{createLabel}
					</Button>
				) : null}
			</div>
		</div>
	);
}

export { ObjectViewBar };
