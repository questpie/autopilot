import type { ActorProjection } from "@questpie/ui/components/composites/actor";
import type { ActorMarkProps } from "@questpie/ui/components/composites/actor-mark";

export type AgentActorProjection = Omit<ActorProjection, "kind"> & { kind: "agent" };

export type TaskAllowedAction =
	| "open"
	| "assign"
	| "move-to-goal"
	| "change-status"
	| "archive"
	| "undo";

export type TaskNonUndoAction = Exclude<TaskAllowedAction, "undo">;

export interface TaskProjectProjection<TSpaceId extends string> {
	id: string;
	spaceId: TSpaceId;
	slug: string;
	label: string;
}

export interface TaskThreadProjection {
	threadId: string;
	commentCount: number;
}

export interface TaskRunProgressProjection {
	runId: string;
	source: "run-steps";
	completed: number;
	total: number;
	actor: AgentActorProjection;
	currentAction: string;
	elapsed: string;
}

export interface TaskChecklistProgressProjection {
	source: "task-checklist";
	completed: number;
	total: number;
}

export interface TaskProvenanceProjection {
	effectId: string;
	runId: string;
	actor: AgentActorProjection;
	label: string;
	kind: "agent-suggestion" | "automation" | "run-output";
}

export type TaskDoneWithoutUndoProjection = {
	kind: "done";
	completion: {
		completedAt: string;
		completedBy: ActorProjection;
		undoUntil?: never;
	};
	provenance?: TaskProvenanceProjection;
};

export type TaskDoneWithUndoProjection = {
	kind: "done";
	completion: {
		completedAt: string;
		completedBy: ActorProjection;
		undoUntil: string;
	};
	provenance: TaskProvenanceProjection;
};

export type TaskStatusProjection =
	| { kind: "backlog"; scheduledFor?: { iso: string; label: string } }
	| { kind: "ready" }
	| {
			kind: "in_progress";
			startedAt: string;
			startedBy: ActorProjection;
			progress?: TaskChecklistProgressProjection;
			run?: TaskRunProgressProjection;
	  }
	| {
			kind: "blocked";
			blocker:
				| { kind: "permission"; permissionRequestId: string; label: string }
				| { kind: "dependency"; blockingTaskId: string; label: string }
				| { kind: "human-input"; requestedActorId: string; label: string };
	  }
	| {
			kind: "in_review";
			review: { reviewRequestId: string; requestedAt: string; requestedBy: ActorProjection };
			provenance?: TaskProvenanceProjection;
	  }
	| TaskDoneWithoutUndoProjection
	| TaskDoneWithUndoProjection
	| {
			kind: "cancelled";
			cancellation: { cancelledAt: string; cancelledBy: ActorProjection; reason: string };
	  };

type TaskRowBaseProjection<TSpaceId extends string> = {
	id: string;
	version: number;
	title: string;
	project?: TaskProjectProjection<TSpaceId>;
	assignee?: ActorProjection;
	thread?: TaskThreadProjection;
	due?: { iso: string; label: string; tone: "neutral" | "attention" };
	suggestion?: TaskProvenanceProjection;
	priority: "none" | "low" | "normal" | "high" | "urgent";
};

type TaskNonDoneStatusProjection = Exclude<TaskStatusProjection, { kind: "done" }>;

export type TaskRowProjection<TSpaceId extends string> = TaskRowBaseProjection<TSpaceId> &
	(
		| { status: TaskNonDoneStatusProjection; allowedActions: readonly TaskNonUndoAction[] }
		| { status: TaskDoneWithoutUndoProjection; allowedActions: readonly TaskNonUndoAction[] }
		| { status: TaskDoneWithUndoProjection; allowedActions: readonly TaskAllowedAction[] }
	);

export interface TaskGroupProjection {
	id: string;
	label: string;
	count: number;
	taskIds: readonly string[];
	context?: { label: string; tone?: "neutral" | "live" };
	quickAdd?: { label: string; shortcut?: string };
}

export type TaskPageProjection = {
	loadedCount: number;
	totalCount: number;
	next:
		| { kind: "complete" }
		| { kind: "ready"; cursor: string; label: string }
		| { kind: "loading"; cursor: string; label: string }
		| { kind: "error"; cursor: string; label: string; retryLabel: string };
};

export type TaskListResultProjection<TSpaceId extends string> =
	| { kind: "loading"; label: string }
	| { kind: "empty"; title: string; description: string }
	| { kind: "no-results"; title: string; description: string }
	| { kind: "error"; title: string; description: string; retryLabel: string }
	| { kind: "access"; title: string; description: string }
	| {
			kind: "ready";
			groups: readonly TaskGroupProjection[];
			tasks: Readonly<Record<string, TaskRowProjection<TSpaceId>>>;
			page: TaskPageProjection;
	  };

export interface TaskBoardProjection {
	kind: "ready";
	columns: readonly TaskGroupProjection[];
}

export type TaskReadyListResultProjection<TSpaceId extends string> = Extract<
	TaskListResultProjection<TSpaceId>,
	{ kind: "ready" }
>;

export type TaskNonReadyListResultProjection<TSpaceId extends string> = Exclude<
	TaskListResultProjection<TSpaceId>,
	{ kind: "ready" }
>;

export type TaskReadyDisplayProjection<TSpaceId extends string> =
	| {
			active: "list";
			list: TaskReadyListResultProjection<TSpaceId>;
	  }
	| {
			active: "list" | "board";
			list: TaskReadyListResultProjection<TSpaceId>;
			board: TaskBoardProjection;
	  };

export type TaskNonReadyDisplayProjection<TSpaceId extends string> = {
	active: "list";
	list: TaskNonReadyListResultProjection<TSpaceId>;
};

export type TaskDisplayProjection<TSpaceId extends string> =
	| TaskReadyDisplayProjection<TSpaceId>
	| TaskNonReadyDisplayProjection<TSpaceId>;

export type TaskPreset = "needs-you" | "running" | "team" | "scheduled" | "overdue";
export type TaskGrouping = "status" | "assignee" | "project" | "due";
export type TaskBulkAction = "assign" | "move-to-goal" | "change-status" | "archive";

export interface TaskListContextProjection<TSpaceId extends string> {
	companyId: string;
	spaceId: TSpaceId;
	spaceName: string;
	project?: { id: string; label: string };
	memberCount: number;
	agentCount: number;
	counts: { tasks: number; goals: number; channels: number };
	members: readonly {
		actor: ActorProjection;
		presence?: ActorMarkProps["presence"];
	}[];
}

export type TaskListSyncProjection =
	| { kind: "live"; lastEventId: string }
	| { kind: "reconnecting"; label: string; replayLabel: string; lastEventId?: string }
	| { kind: "replaying"; label: string; lastEventId: string; replayedCount: number }
	| { kind: "reconciled"; lastEventId: string; movedTaskIds: readonly string[] }
	| { kind: "replay-gap"; label: string; recoveryLabel: string };

export interface TaskListViewProjection {
	presets: readonly TaskPreset[];
	activePreset: TaskPreset;
	grouping: TaskGrouping;
	searchQuery: string;
}

export interface TaskSelectionProjection {
	selectedTaskIds: readonly string[];
	actions: readonly TaskBulkAction[];
}

interface TaskListBaseProjection<TSpaceId extends string> {
	context: TaskListContextProjection<TSpaceId>;
	sync: TaskListSyncProjection;
	view: TaskListViewProjection;
}

export type TaskListProjection<TSpaceId extends string> = TaskListBaseProjection<TSpaceId> &
	(
		| {
				access: {
					kind: "read-only";
					canCreate: false;
					canSelect: false;
					canMutate: false;
				};
				display: TaskDisplayProjection<TSpaceId>;
				selection?: never;
		  }
		| {
				access: {
					kind: "writable";
					canCreate: boolean;
					canSelect: false;
					canMutate: true;
				};
				display: TaskDisplayProjection<TSpaceId>;
				selection?: never;
		  }
		| ({
				access: {
					kind: "writable";
					canCreate: boolean;
					canSelect: true;
					canMutate: true;
				};
		  } & (
				| {
						display: TaskNonReadyDisplayProjection<TSpaceId>;
						selection?: never;
				  }
				| {
						display: TaskReadyDisplayProjection<TSpaceId>;
						selection?: TaskSelectionProjection;
				  }
		  ))
	);

export type TaskListAction =
	| { kind: "change-preset"; preset: TaskPreset }
	| { kind: "open-grouping" }
	| { kind: "change-grouping"; grouping: TaskGrouping }
	| { kind: "open-filter" }
	| { kind: "open-sort" }
	| { kind: "search"; query: string }
	| { kind: "change-display"; display: "list" | "board" }
	| { kind: "create-task" }
	| { kind: "open-task"; taskId: string }
	| { kind: "apply-task-action"; taskId: string; action: TaskAllowedAction }
	| { kind: "set-task-selected"; taskId: string; selected: boolean }
	| { kind: "clear-selection" }
	| { kind: "apply-bulk-action"; action: TaskBulkAction }
	| { kind: "quick-add"; groupId: string }
	| { kind: "load-next-page"; cursor: string }
	| { kind: "retry-next-page"; cursor: string }
	| { kind: "recover-replay-gap" }
	| { kind: "retry-result" }
	| { kind: "undo-task"; taskId: string }
	| { kind: "open-run"; runId: string };
