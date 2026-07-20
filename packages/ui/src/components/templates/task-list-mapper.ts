import {
	ArchiveIcon,
	BookOpenIcon,
	InboxIcon,
	LayoutGridIcon,
	LayoutListIcon,
	MessageSquareIcon,
	SparklesIcon,
	TargetIcon,
	UserRoundPlusIcon,
} from "lucide-react";

import type {
	ObjectGroupProjection,
	ObjectListAction,
	ObjectListBodyProjection,
	ObjectListProjection,
	ObjectListTailProjection,
} from "@questpie/ui/components/templates/object-list";
import type {
	TaskBulkAction,
	TaskGroupProjection,
	TaskGrouping,
	TaskListAction,
	TaskListProjection,
	TaskListResultProjection,
	TaskPreset,
	TaskRowProjection,
} from "@questpie/ui/components/templates/task-list-contract";
import { mapTaskRowToObjectRow } from "@questpie/ui/components/templates/task-row-mapper";

const presetCopy = {
	"needs-you": { label: "Potrebuje ťa", icon: InboxIcon },
	running: { label: "Beží", tone: "live" as const },
	team: { label: "Tím" },
	scheduled: { label: "Naplánované" },
	overdue: { label: "Po termíne", agentAuthored: true },
} satisfies Record<TaskPreset, object>;

const bulkCopy = {
	assign: { label: "Priradiť", icon: UserRoundPlusIcon },
	"move-to-goal": { label: "Do cieľa", icon: TargetIcon },
	"change-status": { label: "Zmeniť stav" },
	archive: { label: "Archivovať", icon: ArchiveIcon },
} satisfies Record<TaskBulkAction, object>;

function readyResults<TSpaceId extends string>(projection: TaskListProjection<TSpaceId>) {
	return projection.display.list.kind === "ready" ? [projection.display.list] : [];
}

function validateReady<TSpaceId extends string>(
	result: Extract<TaskListResultProjection<TSpaceId>, { kind: "ready" }>,
	projection: TaskListProjection<TSpaceId>,
) {
	const taskIds = Object.keys(result.tasks);
	if (
		result.page.loadedCount !== taskIds.length ||
		result.page.totalCount < result.page.loadedCount
	) {
		throw new Error("Počty načítanej stránky Úloh si odporujú.");
	}
	if (result.page.next.kind === "complete" && result.page.totalCount !== result.page.loadedCount) {
		throw new Error("Dokončená stránka Úloh nemôže skrývať nenačítaný chvost.");
	}
	const placed = new Set<string>();
	for (const group of result.groups) {
		if (group.count < group.taskIds.length)
			throw new Error(`Skupina ${group.id} má nepravdivý počet.`);
		for (const taskId of group.taskIds) {
			if (!result.tasks[taskId]) throw new Error(`Skupina odkazuje na chýbajúcu Úlohu ${taskId}.`);
			if (placed.has(taskId)) throw new Error(`Úloha ${taskId} je vo viac než jednej skupine.`);
			placed.add(taskId);
		}
	}
	for (const task of Object.values(result.tasks)) {
		if (!placed.has(task.id)) throw new Error(`Úloha ${task.id} nie je zaradená do skupiny.`);
		if (task.project && task.project.spaceId !== projection.context.spaceId) {
			throw new Error(`Úloha ${task.id} odkazuje na Projekt z cudzieho Priestoru.`);
		}
		if (
			projection.access.kind === "read-only" &&
			task.allowedActions.some((action) => action !== "open")
		) {
			throw new Error(`Read-only Úloha ${task.id} obsahuje mutačnú akciu.`);
		}
	}
}

function validateTaskListProjection<TSpaceId extends string>(
	projection: TaskListProjection<TSpaceId>,
) {
	const results = readyResults(projection);
	for (const result of results) validateReady(result, projection);
	const selected = projection.selection?.selectedTaskIds ?? [];
	if (new Set(selected).size !== selected.length)
		throw new Error("Výber obsahuje duplicitnú Úlohu.");
	if (selected.length) {
		const ready = results[0];
		if (!ready) throw new Error("Výber môže existovať iba nad pripraveným výsledkom.");
		for (const taskId of selected) {
			if (!ready.tasks[taskId]) throw new Error(`Výber odkazuje na neznámu Úlohu ${taskId}.`);
		}
	}
	if ("board" in projection.display) {
		const taskMap = projection.display.list.tasks;
		const boardPlaced = new Set<string>();
		for (const column of projection.display.board.columns) {
			if (column.count < column.taskIds.length) {
				throw new Error(`Stĺpec ${column.id} má nepravdivý počet.`);
			}
			for (const taskId of column.taskIds) {
				if (!taskMap[taskId]) throw new Error(`Tabuľa odkazuje na neznámu Úlohu ${taskId}.`);
				if (boardPlaced.has(taskId)) throw new Error(`Úloha ${taskId} je vo viacerých stĺpcoch.`);
				boardPlaced.add(taskId);
			}
		}
		for (const taskId of Object.keys(taskMap)) {
			if (!boardPlaced.has(taskId)) {
				throw new Error(`Úloha ${taskId} nie je zaradená do stĺpca Tabule.`);
			}
		}
	}
}

function mapGroups<TSpaceId extends string>(
	groups: readonly TaskGroupProjection[],
	tasks: Readonly<Record<string, TaskRowProjection<TSpaceId>>>,
	projection: TaskListProjection<TSpaceId>,
	onAction: (action: TaskListAction) => void,
): readonly ObjectGroupProjection[] {
	const selectedTaskIds = new Set(projection.selection?.selectedTaskIds ?? []);
	return groups.map((group) => {
		const rows = group.taskIds.map((taskId) => tasks[taskId]!);
		const kinds = new Set(rows.map((row) => row.status.kind));
		return {
			...group,
			tone: kinds.has("in_progress")
				? "running"
				: kinds.has("in_review")
					? "attention"
					: kinds.has("blocked") || kinds.has("cancelled")
						? "blocked"
						: kinds.has("done")
							? "done"
							: "idle",
			items: rows.map((task) =>
				mapTaskRowToObjectRow(task, {
					selectedTaskIds,
					selectionEnabled: projection.access.canSelect,
					onAction,
				}),
			),
		};
	});
}

function mapTail(
	page: Extract<TaskListResultProjection<string>, { kind: "ready" }>["page"],
): ObjectListTailProjection | undefined {
	if (page.next.kind === "complete") return undefined;
	const base = {
		count: page.totalCount - page.loadedCount,
		label: `ďalších úloh · ${page.loadedCount} načítaných z ${page.totalCount}`,
		cursor: page.next.cursor,
	};
	if (page.next.kind === "error")
		return { ...base, state: "error", actionLabel: page.next.retryLabel };
	return { ...base, state: page.next.kind, actionLabel: page.next.label };
}

function mapSelection<TSpaceId extends string>(projection: TaskListProjection<TSpaceId>) {
	if (!projection.selection?.selectedTaskIds.length) return undefined;
	const groups =
		projection.display.active === "board" && "board" in projection.display
			? projection.display.board.columns
			: projection.display.list.kind === "ready"
				? projection.display.list.groups
				: [];
	const groupCount = groups.filter((group) =>
		group.taskIds.some((taskId) => projection.selection!.selectedTaskIds.includes(taskId)),
	).length;
	return {
		selectedIds: projection.selection.selectedTaskIds,
		scopeLabel: `označené naprieč ${groupCount} skupinami`,
		actions: projection.selection.actions.map((action) => ({ id: action, ...bulkCopy[action] })),
	};
}

function mapBody<TSpaceId extends string>(
	projection: TaskListProjection<TSpaceId>,
	onAction: (action: TaskListAction) => void,
): ObjectListBodyProjection {
	const list = projection.display.list;
	if (projection.display.active === "board" && "board" in projection.display) {
		return {
			kind: "ready",
			mode: "board",
			columns: mapGroups(
				projection.display.board.columns,
				projection.display.list.tasks,
				projection,
				onAction,
			),
			selection: mapSelection(projection),
		};
	}
	if (list.kind === "ready") {
		return {
			kind: "ready",
			mode: "list",
			groups: mapGroups(list.groups, list.tasks, projection, onAction),
			selection: mapSelection(projection),
			tail: mapTail(list.page),
		};
	}
	if (list.kind === "loading") return list;
	return { ...list, actionLabel: list.kind === "error" ? list.retryLabel : undefined };
}

function mapTaskListProjection<TSpaceId extends string>(
	projection: TaskListProjection<TSpaceId>,
	onAction: (action: TaskListAction) => void,
): ObjectListProjection {
	validateTaskListProjection(projection);
	const sync = projection.sync;
	const connection =
		sync.kind === "live" || sync.kind === "reconciled"
			? undefined
			: sync.kind === "replay-gap"
				? { tone: "attention" as const, label: sync.label, actionLabel: sync.recoveryLabel }
				: {
						tone: "attention" as const,
						label: sync.label,
						meta:
							sync.kind === "reconnecting" ? sync.replayLabel : `${sync.replayedCount} udalostí`,
					};
	return {
		context: {
			icon: LayoutGridIcon,
			title: projection.context.spaceName,
			project: projection.context.project
				? { label: "Projekt", value: projection.context.project.label }
				: undefined,
			meta: `${projection.context.memberCount} členovia · ${projection.context.agentCount} agent`,
			members: projection.context.members,
			inviteLabel: "Pozvať",
		},
		connection,
		facets: {
			activeId: "tasks",
			facets: [
				{ id: "overview", label: "Prehľad", icon: LayoutGridIcon },
				{
					id: "tasks",
					label: "Úlohy",
					icon: LayoutListIcon,
					count: projection.context.counts.tasks,
				},
				{ id: "goals", label: "Ciele", icon: TargetIcon, count: projection.context.counts.goals },
				{
					id: "channel",
					label: "Kanál",
					icon: MessageSquareIcon,
					count: projection.context.counts.channels,
				},
				{ id: "knowledge", label: "Znalosti", icon: BookOpenIcon },
				{ id: "dashboards", label: "Dashboardy", icon: SparklesIcon, agentAuthored: true },
			],
		},
		view: {
			presets: projection.view.presets.map((preset) => ({ id: preset, ...presetCopy[preset] })),
			activePresetId: projection.view.activePreset,
			groupLabel: `Zoskupiť: ${groupingLabel(projection.view.grouping)}`,
			filterLabel: "Filter",
			sortLabel: "Zoradiť: Priorita",
			searchLabel: "Hľadať úlohu…",
			displayMode: projection.display.active,
			displayModes: "board" in projection.display ? ["list", "board"] : ["list"],
			createLabel: projection.access.canCreate ? "Nová úloha" : undefined,
		},
		access: projection.access.kind === "writable" ? "write" : "read",
		body: mapBody(projection, onAction),
	};
}

function groupingLabel(grouping: TaskGrouping) {
	return { status: "Stav", assignee: "Aktér", project: "Projekt", due: "Termín" }[grouping];
}

function mapObjectListAction<TSpaceId extends string>(
	action: ObjectListAction,
	projection: TaskListProjection<TSpaceId>,
): TaskListAction | undefined {
	switch (action.type) {
		case "preset-change":
			return projection.view.presets.includes(action.id as TaskPreset)
				? { kind: "change-preset", preset: action.id as TaskPreset }
				: undefined;
		case "group":
			return { kind: "open-grouping" };
		case "filter":
			return { kind: "open-filter" };
		case "sort":
			return { kind: "open-sort" };
		case "search":
			return { kind: "search", query: action.query };
		case "display-change":
			return action.mode === "board" && !("board" in projection.display)
				? undefined
				: { kind: "change-display", display: action.mode };
		case "create":
			return projection.access.canCreate ? { kind: "create-task" } : undefined;
		case "item-open":
			return { kind: "open-task", taskId: action.id };
		case "item-select":
			return projection.access.canSelect
				? { kind: "set-task-selected", taskId: action.id, selected: action.checked }
				: undefined;
		case "selection-action":
			return projection.selection?.actions.includes(action.id as TaskBulkAction)
				? { kind: "apply-bulk-action", action: action.id as TaskBulkAction }
				: undefined;
		case "selection-clear":
			return { kind: "clear-selection" };
		case "quick-add":
			return projection.access.canMutate
				? { kind: "quick-add", groupId: action.groupId }
				: undefined;
		case "tail-action": {
			const page =
				projection.display.list.kind === "ready" ? projection.display.list.page : undefined;
			if (!page || page.next.kind === "complete" || page.next.cursor !== action.cursor)
				return undefined;
			return page.next.kind === "error"
				? { kind: "retry-next-page", cursor: action.cursor }
				: { kind: "load-next-page", cursor: action.cursor };
		}
		case "connection-action":
			return projection.sync.kind === "replay-gap" ? { kind: "recover-replay-gap" } : undefined;
		case "retry-body":
			return { kind: "retry-result" };
	}
}

export {
	mapObjectListAction,
	mapTaskListProjection,
	mapTaskRowToObjectRow,
	validateTaskListProjection,
};
