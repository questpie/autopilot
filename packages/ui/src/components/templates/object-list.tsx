import { PlusIcon } from "lucide-react";

import type { ObjectRowProps } from "@questpie/ui/components/composites/object-row";
import {
	SelectionBar,
	type SelectionBarAction,
} from "@questpie/ui/components/composites/selection-bar";
import { WorkObjectCard } from "@questpie/ui/components/composites/work-object-card";
import { StateBand, type StateBandTone } from "@questpie/ui/components/composites/state-band";
import {
	StateGroup,
	type StateGroupContextProjection,
} from "@questpie/ui/components/composites/state-group";
import { VirtualizationTail } from "@questpie/ui/components/composites/virtualization-tail";
import { Skeleton } from "@questpie/ui/components/ui/skeleton";
import { Button } from "@questpie/ui/components/ui/button";
import {
	ObjectViewBar,
	type ObjectDisplayMode,
	type ObjectViewBarProps,
} from "@questpie/ui/components/templates/object-view-bar";
import {
	SpaceContext,
	type SpaceContextProps,
} from "@questpie/ui/components/templates/space-context";
import {
	SpaceFacetNav,
	type SpaceFacetNavProps,
} from "@questpie/ui/components/templates/space-facet-nav";
import { StatePanel, type UniversalState } from "@questpie/ui/components/templates/state-panel";
import { cn } from "@questpie/ui/lib/utils";

const boardDotToneClass: Record<NonNullable<ObjectGroupProjection["tone"]>, string> = {
	running: "work-row-status--running",
	attention: "work-row-status--attention",
	done: "work-row-status--done",
	blocked: "work-row-status--blocked",
	failed: "work-row-status--blocked",
	idle: "",
};

export interface ObjectGroupProjection {
	id: string;
	label: string;
	count: number;
	tone?: "running" | "attention" | "done" | "idle" | "blocked" | "failed";
	context?: StateGroupContextProjection;
	quickAdd?: { label: string; shortcut?: string };
	items: readonly Omit<ObjectRowProps, "onActivate">[];
}

export interface ObjectListConnectionProjection {
	tone: StateBandTone;
	label: string;
	meta?: string;
	actionLabel?: string;
}

export interface ObjectListSelectionProjection {
	selectedIds: readonly string[];
	scopeLabel?: string;
	actions: readonly Omit<SelectionBarAction, "onSelect">[];
}

export interface ObjectListTailProjection {
	count: number;
	label: string;
	state?: "ready" | "loading" | "error";
	actionLabel?: string;
	cursor?: string;
}

export type ObjectListBodyProjection =
	| {
			kind: "ready";
			mode: "list";
			groups: readonly ObjectGroupProjection[];
			selection?: ObjectListSelectionProjection;
			tail?: ObjectListTailProjection;
	  }
	| {
			kind: "ready";
			mode: "board";
			columns: readonly ObjectGroupProjection[];
			selection?: ObjectListSelectionProjection;
	  }
	| { kind: "loading"; label: string }
	| { kind: UniversalState; title: string; description: string; actionLabel?: string };

export interface ObjectListProjection {
	context: SpaceContextProps;
	connection?: ObjectListConnectionProjection;
	facets: SpaceFacetNavProps;
	view: Omit<
		ObjectViewBarProps,
		| "onPresetChange"
		| "onGroup"
		| "onFilter"
		| "onSort"
		| "onSearch"
		| "onDisplayModeChange"
		| "onCreate"
	>;
	access?: "write" | "read";
	body: ObjectListBodyProjection;
}

export type ObjectListAction =
	| { type: "preset-change"; id: string }
	| { type: "group" }
	| { type: "filter" }
	| { type: "sort" }
	| { type: "search"; query: string }
	| { type: "display-change"; mode: ObjectDisplayMode }
	| { type: "create" }
	| { type: "item-open"; id: string }
	| { type: "item-select"; id: string; checked: boolean }
	| { type: "selection-action"; id: string }
	| { type: "selection-clear" }
	| { type: "quick-add"; groupId: string }
	| { type: "tail-action"; cursor: string }
	| { type: "connection-action" }
	| { type: "retry-body" };

export interface ObjectListProps {
	projection: ObjectListProjection;
	onAction?: (action: ObjectListAction) => void;
}

function ObjectList({ projection, onAction }: ObjectListProps) {
	const { context, connection, facets, view, body, access = "write" } = projection;
	const ready = body.kind === "ready" ? body : undefined;
	const selection = ready?.selection;
	const selectionActions: SelectionBarAction[] =
		selection?.actions.map((action) => ({
			...action,
			onSelect: () => onAction?.({ type: "selection-action", id: action.id }),
		})) ?? [];

	return (
		<section
			data-slot="object-list"
			className="object-list-shell flex min-h-0 flex-1 flex-col bg-background"
		>
			<SpaceContext {...context} />
			{connection ? (
				<StateBand
					{...connection}
					action={
						connection.actionLabel ? (
							<Button
								variant="ghost"
								size="sm"
								onClick={() => onAction?.({ type: "connection-action" })}
							>
								{connection.actionLabel}
							</Button>
						) : undefined
					}
				/>
			) : null}
			<SpaceFacetNav {...facets} />
			{ready ? (
				<ObjectViewBar
					{...view}
					createLabel={access === "write" ? view.createLabel : undefined}
					onPresetChange={(id) => onAction?.({ type: "preset-change", id })}
					onGroup={() => onAction?.({ type: "group" })}
					onFilter={() => onAction?.({ type: "filter" })}
					onSort={() => onAction?.({ type: "sort" })}
					onSearch={(query) => onAction?.({ type: "search", query })}
					onDisplayModeChange={(mode) => onAction?.({ type: "display-change", mode })}
					onCreate={access === "write" ? () => onAction?.({ type: "create" }) : undefined}
				/>
			) : null}
			{ready && selection && access === "write" ? (
				<SelectionBar
					count={selection.selectedIds.length}
					context={selection.scopeLabel}
					actions={selectionActions}
					onClear={() => onAction?.({ type: "selection-clear" })}
				/>
			) : null}
			<div data-slot="object-list-body" className="min-h-0 min-w-0 max-w-full flex-1 overflow-auto">
				{body.kind === "loading" ? (
					<output className="grid gap-3 p-4" aria-busy="true" aria-label={body.label}>
						<Skeleton className="h-7 w-32" />
						<Skeleton className="h-11 w-full" />
						<Skeleton className="h-11 w-full" />
						<Skeleton className="h-11 w-full" />
					</output>
				) : body.kind !== "ready" ? (
					<StatePanel
						state={body.kind}
						title={body.title}
						description={body.description}
						action={
							body.actionLabel ? (
								<Button
									variant="secondary"
									size="sm"
									onClick={() => onAction?.({ type: "retry-body" })}
								>
									{body.actionLabel}
								</Button>
							) : undefined
						}
					/>
				) : body.mode === "list" ? (
					<>
						{body.groups.map((group) => (
							<StateGroup
								key={group.id}
								{...group}
								quickAdd={access === "write" ? group.quickAdd : undefined}
								onOpenItem={(id) => onAction?.({ type: "item-open", id })}
								onSelectItem={(id, checked) => onAction?.({ type: "item-select", id, checked })}
								selectionEnabled={access === "write"}
								onQuickAdd={() => onAction?.({ type: "quick-add", groupId: group.id })}
							/>
						))}
						{body.tail ? (
							<VirtualizationTail
								{...body.tail}
								onAction={
									body.tail.cursor
										? () => onAction?.({ type: "tail-action", cursor: body.tail!.cursor! })
										: undefined
								}
							/>
						) : null}
					</>
				) : (
					<div data-slot="work-board" className="work-board">
						{body.columns.map((column) => (
							<section
								key={column.id}
								data-slot="work-board-column"
								data-group-id={column.id}
								className="work-board-column"
								aria-labelledby={`${column.id}-col`}
							>
								<header data-slot="work-board-column-head" className="work-board-column-head">
									<span
										className={cn("work-row-status", boardDotToneClass[column.tone ?? "idle"])}
										aria-hidden
									/>
									<span id={`${column.id}-col`} className="work-board-column-head__name">
										{column.label}
									</span>
									<span className="ui-mono tabular-nums work-board-column-head__count">
										{column.count}
									</span>
									{access === "write" && column.quickAdd ? (
										<button
											type="button"
											className="work-board-column-head__add"
											aria-label={column.quickAdd.label}
											onClick={() => onAction?.({ type: "quick-add", groupId: column.id })}
										>
											<PlusIcon aria-hidden />
										</button>
									) : null}
								</header>
								<div className="work-board-column-body">
									{column.items.map((item) => (
										<WorkObjectCard
											key={item.id}
											{...item}
											onActivate={() => onAction?.({ type: "item-open", id: item.id })}
										/>
									))}
								</div>
							</section>
						))}
					</div>
				)}
			</div>
		</section>
	);
}

export { ObjectList };
