import type { ObjectRowProps } from "@questpie/ui/components/composites/object-row";
import type { WorkRowDetailProjection } from "@questpie/ui/components/composites/work-row-detail";
import type {
	TaskListAction,
	TaskProvenanceProjection,
	TaskRowProjection,
} from "@questpie/ui/components/templates/task-list-contract";

export interface TaskRowMapperOptions {
	selectedTaskIds: ReadonlySet<string>;
	selectionEnabled: boolean;
	onAction?: (action: TaskListAction) => void;
}

function mapProvenance(provenance: TaskProvenanceProjection): WorkRowDetailProjection {
	return provenance.kind === "automation"
		? {
				kind: "automation",
				label: provenance.label,
				effectId: provenance.effectId,
				runId: provenance.runId,
			}
		: {
				kind: "provenance",
				label: provenance.label,
				effectId: provenance.effectId,
				runId: provenance.runId,
			};
}

function blockerReference(
	status: Extract<TaskRowProjection<string>["status"], { kind: "blocked" }>,
) {
	switch (status.blocker.kind) {
		case "permission":
			return status.blocker.permissionRequestId;
		case "dependency":
			return status.blocker.blockingTaskId;
		case "human-input":
			return status.blocker.requestedActorId;
	}
}

function mapDetails<TSpaceId extends string>(
	task: TaskRowProjection<TSpaceId>,
	onAction?: (action: TaskListAction) => void,
): readonly WorkRowDetailProjection[] {
	const suggestion = task.suggestion ? [mapProvenance(task.suggestion)] : [];
	const due = task.due
		? [{ kind: "schedule" as const, label: task.due.label, iso: task.due.iso }]
		: [];
	switch (task.status.kind) {
		case "backlog":
			return task.status.scheduledFor
				? [
						...suggestion,
						{
							kind: "schedule",
							label: `Naplánované · ${task.status.scheduledFor.label}`,
							iso: task.status.scheduledFor.iso,
						},
					]
				: [...suggestion, ...due];
		case "ready":
			return [...suggestion, ...due];
		case "in_progress":
			return task.status.run || task.status.progress ? suggestion : [...suggestion, ...due];
		case "blocked":
			return [
				...suggestion,
				{
					kind: "permission",
					label: task.status.blocker.label,
					referenceId: blockerReference(task.status),
				},
			];
		case "in_review":
			return [
				...suggestion,
				...(task.status.provenance ? [mapProvenance(task.status.provenance)] : []),
				{ kind: "text", label: "čaká na teba" },
			];
		case "done":
			const canUndo = Array.from(task.allowedActions).includes("undo");
			return [
				...suggestion,
				...(task.status.provenance ? [mapProvenance(task.status.provenance)] : []),
				...(task.status.completion.undoUntil && task.status.provenance && canUndo
					? [
							{
								kind: "undo" as const,
								label: "Vrátiť späť",
								effectId: task.status.provenance.effectId,
								onSelect: () => onAction?.({ kind: "undo-task", taskId: task.id }),
							},
						]
					: []),
			];
		case "cancelled":
			return [...suggestion, { kind: "text", label: task.status.cancellation.reason }];
	}
}

function mapTaskRowToObjectRow<TSpaceId extends string>(
	task: TaskRowProjection<TSpaceId>,
	options: TaskRowMapperOptions,
): Omit<ObjectRowProps, "onActivate"> {
	const status =
		task.status.kind === "in_progress"
			? "running"
			: task.status.kind === "in_review"
				? "attention"
				: task.status.kind === "blocked" || task.status.kind === "cancelled"
					? "blocked"
					: task.status.kind === "done"
						? "done"
						: "idle";
	const run = task.status.kind === "in_progress" ? task.status.run : undefined;
	const checklistProgress = task.status.kind === "in_progress" ? task.status.progress : undefined;
	return {
		id: task.id,
		version: task.version,
		title: task.title,
		project: task.project,
		status,
		selection: options.selectionEnabled
			? { checked: options.selectedTaskIds.has(task.id) }
			: undefined,
		selected: options.selectedTaskIds.has(task.id),
		progress: run
			? {
					runId: run.runId,
					source: run.source,
					completed: run.completed,
					total: run.total,
					dueLabel: task.due?.label,
					dueTone: task.due?.tone,
				}
			: checklistProgress
				? {
						source: checklistProgress.source,
						completed: checklistProgress.completed,
						total: checklistProgress.total,
						dueLabel: task.due?.label,
						dueTone: task.due?.tone,
					}
				: undefined,
		agentActivity: run
			? {
					runId: run.runId,
					actor: run.actor,
					label: run.currentAction,
					elapsed: run.elapsed,
					actionLabel: "sleduj",
					onAction: () => options.onAction?.({ kind: "open-run", runId: run.runId }),
				}
			: undefined,
		comments: task.thread?.commentCount,
		thread: task.thread ? { id: task.thread.threadId, count: task.thread.commentCount } : undefined,
		actors: task.assignee ? [{ actor: task.assignee }] : undefined,
		details: mapDetails(task, options.onAction),
		dimmed: task.status.kind === "done" || task.status.kind === "cancelled",
	};
}

export { mapTaskRowToObjectRow };
