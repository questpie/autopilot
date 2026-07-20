import type {
	TaskListProjection,
	TaskRowProjection,
} from "@questpie/ui/components/templates/task-list-contract";

const marek = { id: "marek", name: "Marek H.", kind: "human" as const };
const autopilot = { id: "autopilot", name: "Autopilot", kind: "agent" as const };

const validBlocked = {
	id: "payments",
	version: 4,
	title: "Spustiť platobnú bránu pre e-shop",
	project: { id: "project-shop", spaceId: "space-shop", slug: "e-shop", label: "E-shop" },
	assignee: marek,
	thread: { threadId: "thread-payments", commentCount: 2 },
	status: {
		kind: "blocked",
		blocker: {
			kind: "permission",
			permissionRequestId: "permission-provider-key",
			label: "Čaká na prístupové kľúče",
		},
	},
	priority: "high",
	allowedActions: ["open", "assign", "change-status"],
} satisfies TaskRowProjection<"space-shop">;

const validHumanWorkWithoutRun = {
	id: "human-work",
	version: 2,
	title: "Doplniť rozmery produktov",
	assignee: marek,
	status: {
		kind: "in_progress",
		startedAt: "2026-07-19T10:00:00+02:00",
		startedBy: marek,
		progress: { source: "task-checklist", completed: 2, total: 4 },
	},
	priority: "normal",
	allowedActions: ["open", "change-status"],
} satisfies TaskRowProjection<"space-shop">;

const validProjection = {
	context: {
		companyId: "company-hreben",
		spaceId: "space-shop",
		spaceName: "E-shop",
		project: { id: "project-shop", label: "E-shop" },
		memberCount: 3,
		agentCount: 1,
		counts: { tasks: 216, goals: 5, channels: 5 },
		members: [
			{ actor: marek, presence: "online" },
			{ actor: autopilot, presence: "online" },
		],
	},
	sync: { kind: "live", lastEventId: "event-42" },
	access: { kind: "writable", canCreate: true, canSelect: true, canMutate: true },
	view: {
		presets: ["needs-you", "running", "team", "scheduled", "overdue"],
		activePreset: "needs-you",
		grouping: "status",
		searchQuery: "",
	},
	selection: {
		selectedTaskIds: ["payments"],
		actions: ["assign", "move-to-goal", "change-status", "archive"],
	},
	display: {
		active: "list",
		list: {
			kind: "ready",
			groups: [{ id: "blocked", label: "Blokované", count: 1, taskIds: ["payments"] }],
			tasks: { payments: validBlocked },
			page: {
				loadedCount: 1,
				totalCount: 216,
				next: { kind: "ready", cursor: "task:payments", label: "Načítať ďalšie" },
			},
		},
	},
} satisfies TaskListProjection<"space-shop">;

void validProjection;
void validHumanWorkWithoutRun;

// Blocked Tasks require a grounded blocker payload.
const blockedWithoutReason: TaskRowProjection<"space-shop"> = {
	id: "invalid-blocked",
	version: 1,
	title: "Nepravdivo blokovaná úloha",
	priority: "normal",
	// @ts-expect-error blocker is mandatory for the blocked lifecycle state.
	status: { kind: "blocked" },
	allowedActions: ["open"],
};

// A Task has one accountable assignee, never an assignee array.
const multipleAssignees: TaskRowProjection<"space-shop"> = {
	id: "invalid-assignees",
	version: 1,
	title: "Úloha s dvoma vlastníkmi",
	priority: "normal",
	// @ts-expect-error use the singular assignee seam.
	assignees: [marek, autopilot],
	status: { kind: "backlog" },
	allowedActions: ["open"],
};

// Project identity must belong to the Task list Space.
const crossSpaceProject: TaskRowProjection<"space-shop"> = {
	id: "invalid-project",
	version: 1,
	title: "Úloha z cudzieho Priestoru",
	priority: "normal",
	// @ts-expect-error the Project space id must equal the list Space id literal.
	project: { id: "project-web", spaceId: "space-web", slug: "web", label: "Web" },
	status: { kind: "backlog" },
	allowedActions: ["open"],
};

// @ts-expect-error Undo belongs only to a completed Task with an undo window and provenance.
const readyWithUndo: TaskRowProjection<"space-shop"> = {
	id: "invalid-ready-undo",
	version: 1,
	title: "Nedokončená úloha s Undo",
	priority: "normal",
	status: { kind: "ready" },
	allowedActions: ["open", "undo"],
};

const humanAuthoredProvenance: TaskRowProjection<"space-shop"> = {
	id: "invalid-human-provenance",
	version: 1,
	title: "Nepravdivá agentová proveniencia",
	priority: "normal",
	status: { kind: "ready" },
	suggestion: {
		kind: "agent-suggestion",
		effectId: "effect-invalid",
		runId: "run-invalid",
		// @ts-expect-error durable AI provenance must reference an Agent Actor.
		actor: marek,
		label: "Navrhol Marek",
	},
	allowedActions: ["open"],
};

const selectionWhileLoading: TaskListProjection<"space-shop"> = {
	...validProjection,
	// @ts-expect-error selection only exists over a ready Task map.
	display: { active: "list", list: { kind: "loading", label: "Načítavam úlohy" } },
	selection: validProjection.selection,
};

const boardWithoutProjection: TaskListProjection<"space-shop"> = {
	...validProjection,
	// @ts-expect-error Board cannot be active without a grounded Board projection.
	display: { active: "board", list: validProjection.display.list },
};

// In-progress is a Task lifecycle state, not an assertion that an Agent Run exists.
const humanWorkWithoutRun = {
	id: "human-copy-review",
	version: 2,
	title: "Skontrolovať text kampane",
	assignee: marek,
	priority: "normal",
	status: {
		kind: "in_progress",
		startedAt: "2026-07-19T10:00:00+02:00",
		startedBy: marek,
	},
	allowedActions: ["open", "assign", "change-status"],
} satisfies TaskRowProjection<"space-shop">;

void readyWithUndo;
void humanAuthoredProvenance;
void selectionWhileLoading;
void boardWithoutProjection;
void blockedWithoutReason;
void multipleAssignees;
void crossSpaceProject;
void humanWorkWithoutRun;
