import { describe, expect, it } from "vitest";

import type {
	TaskListProjection,
	TaskRowProjection,
} from "@questpie/ui/components/templates/task-list-contract";
import {
	mapTaskRowToObjectRow,
	validateTaskListProjection,
} from "@questpie/ui/components/templates/task-list-mapper";

const marek = { id: "marek", name: "Marek H.", kind: "human" as const };
const autopilot = { id: "autopilot", name: "Autopilot", kind: "agent" as const };

const runningTask = {
	id: "landing",
	version: 7,
	title: "Hero sekcia letnej landing stránky",
	project: {
		id: "project-shop",
		spaceId: "space-shop",
		slug: "e-shop",
		label: "E-shop",
	},
	assignee: marek,
	thread: { threadId: "thread-landing", commentCount: 4 },
	status: {
		kind: "in_progress",
		startedAt: "2026-07-19T09:41:00+02:00",
		startedBy: marek,
		run: {
			runId: "run-landing",
			source: "run-steps",
			completed: 5,
			total: 8,
			actor: autopilot,
			currentAction: "Píše Hero sekciu",
			elapsed: "0:41",
		},
	},
	priority: "high",
	allowedActions: ["open", "assign", "change-status"],
} satisfies TaskRowProjection<"space-shop">;

const projection = {
	context: {
		companyId: "company-hreben",
		spaceId: "space-shop",
		spaceName: "E-shop",
		memberCount: 2,
		agentCount: 1,
		counts: { tasks: 1, goals: 1, channels: 1 },
		members: [{ actor: marek }, { actor: autopilot }],
	},
	sync: { kind: "live", lastEventId: "event-42" },
	access: {
		kind: "writable",
		canCreate: true,
		canSelect: true,
		canMutate: true,
	},
	selection: { selectedTaskIds: ["landing"], actions: ["assign"] },
	view: {
		presets: ["needs-you", "running"],
		activePreset: "running",
		grouping: "status",
		searchQuery: "",
	},
	display: {
		active: "list",
		list: {
			kind: "ready",
			groups: [{ id: "in-progress", label: "Beží", count: 1, taskIds: ["landing"] }],
			tasks: { landing: runningTask },
			page: { loadedCount: 1, totalCount: 1, next: { kind: "complete" } },
		},
	},
} satisfies TaskListProjection<"space-shop">;

describe("typed Task list contract", () => {
	it("derives selection, singular accountability and grounded metadata at the mapper seam", () => {
		const actions: unknown[] = [];
		const mapped = mapTaskRowToObjectRow(runningTask, {
			selectedTaskIds: new Set(["landing"]),
			selectionEnabled: true,
			onAction: (action) => actions.push(action),
		});

		expect(mapped.selection?.checked).toBe(true);
		expect(mapped.actors).toHaveLength(1);
		expect(mapped.comments).toBe(4);
		expect(mapped.thread).toEqual({ id: "thread-landing", count: 4 });
		expect(mapped.progress).toEqual(
			expect.objectContaining({
				runId: "run-landing",
				source: "run-steps",
				completed: 5,
				total: 8,
			}),
		);
		expect(mapped.agentActivity?.actor.id).toBe("autopilot");
		mapped.agentActivity?.onAction?.();
		expect(actions).toEqual([{ kind: "open-run", runId: "run-landing" }]);
	});

	it("keeps human checklist progress separate from Agent Run activity", () => {
		const humanTask = {
			...runningTask,
			id: "catalog",
			due: { iso: "2026-07-22", label: "o 3 dni", tone: "attention" as const },
			status: {
				kind: "in_progress" as const,
				startedAt: "2026-07-19T09:20:00+02:00",
				startedBy: marek,
				progress: { source: "task-checklist" as const, completed: 3, total: 6 },
			},
		} satisfies TaskRowProjection<"space-shop">;
		const mapped = mapTaskRowToObjectRow(humanTask, {
			selectedTaskIds: new Set(),
			selectionEnabled: true,
		});

		expect(mapped.progress).toEqual({
			source: "task-checklist",
			completed: 3,
			total: 6,
			dueLabel: "o 3 dni",
			dueTone: "attention",
		});
		expect(mapped.agentActivity).toBeUndefined();
		expect(mapped.details).not.toContainEqual(
			expect.objectContaining({ kind: "schedule", label: "o 3 dni" }),
		);
	});

	it("rejects duplicate placement and cross-Space Project references", () => {
		expect(() => validateTaskListProjection(projection)).not.toThrow();

		const duplicated = structuredClone(projection);
		if (duplicated.display.list.kind !== "ready") throw new Error("Expected ready fixture");
		duplicated.display.list.groups.push({
			id: "also-running",
			label: "Tiež beží",
			count: 1,
			taskIds: ["landing"],
		});
		expect(() => validateTaskListProjection(duplicated)).toThrow(/viac než jednej skupine/);

		const foreignProject = structuredClone(projection) as TaskListProjection<string>;
		if (foreignProject.display.list.kind !== "ready") throw new Error("Expected ready fixture");
		foreignProject.display.list.tasks.landing!.project!.spaceId = "space-web";
		expect(() => validateTaskListProjection(foreignProject)).toThrow(/cudzieho Priestoru/);
	});

	it("requires every loaded Task exactly once in the Board and truthful page completion", () => {
		const missingBoardTask = structuredClone(projection) as TaskListProjection<"space-shop">;
		if (missingBoardTask.display.list.kind !== "ready") throw new Error("Expected ready fixture");
		missingBoardTask.display = {
			active: "board",
			list: missingBoardTask.display.list,
			board: { kind: "ready", columns: [] },
		};
		expect(() => validateTaskListProjection(missingBoardTask)).toThrow(/stĺpca Tabule/);

		const falseComplete = structuredClone(projection) as TaskListProjection<"space-shop">;
		if (falseComplete.display.list.kind !== "ready") throw new Error("Expected ready fixture");
		falseComplete.display.list.page = {
			loadedCount: 1,
			totalCount: 2,
			next: { kind: "complete" },
		};
		expect(() => validateTaskListProjection(falseComplete)).toThrow(/skrývať nenačítaný chvost/);
	});
});
