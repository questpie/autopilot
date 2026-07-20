import type {
	TaskGroupProjection,
	TaskListProjection,
	TaskRowProjection,
} from "@questpie/ui/components/templates/task-list-contract";
import { mapTaskListProjection } from "@questpie/ui/components/templates/task-list-mapper";

export const hrebenActors = {
	marek: { id: "marek", name: "Marek H.", kind: "human" as const },
	lucia: { id: "lucia", name: "Lucia", kind: "human" as const },
	jan: { id: "jan", name: "Ján", kind: "human" as const },
	autopilot: { id: "autopilot", name: "Autopilot", kind: "agent" as const },
};

const spaceId = "space-e-shop" as const;

function project(id: string, slug: string, label: string) {
	return { id, spaceId, slug, label };
}

const tasks = {
	landing: {
		id: "landing",
		version: 7,
		title: "Hero sekcia letnej landing stránky",
		project: project("project-landing", "landing", "Landing"),
		assignee: hrebenActors.marek,
		thread: { threadId: "thread-landing", commentCount: 6 },
		due: { iso: "2026-07-31", label: "o 12 dní", tone: "neutral" },
		priority: "high",
		status: {
			kind: "in_progress",
			startedAt: "2026-07-19T09:41:00+02:00",
			startedBy: hrebenActors.marek,
			run: {
				runId: "run-landing-07",
				source: "run-steps",
				completed: 5,
				total: 8,
				actor: hrebenActors.autopilot,
				currentAction: "Autopilot · píše…",
				elapsed: "0:41",
			},
		},
		allowedActions: ["open", "assign", "move-to-goal", "change-status", "archive"],
	},
	catalog: {
		id: "catalog",
		version: 4,
		title: "Import 42 produktov z dodávateľského feedu",
		project: project("project-catalog", "katalóg", "Katalóg"),
		assignee: hrebenActors.lucia,
		thread: { threadId: "thread-catalog", commentCount: 2 },
		priority: "normal",
		status: {
			kind: "in_progress",
			startedAt: "2026-07-19T09:20:00+02:00",
			startedBy: hrebenActors.lucia,
			progress: { source: "task-checklist", completed: 3, total: 6 },
		},
		allowedActions: ["open", "assign", "change-status", "archive"],
	},
	newsletter: {
		id: "newsletter",
		version: 11,
		title: "Newsletter — Ponuka mesiaca (3 sekcie)",
		project: project("project-newsletter", "newsletter", "Newsletter"),
		assignee: hrebenActors.marek,
		thread: { threadId: "thread-newsletter", commentCount: 2 },
		priority: "urgent",
		status: {
			kind: "in_review",
			review: {
				reviewRequestId: "review-newsletter-11",
				requestedAt: "2026-07-19T09:44:00+02:00",
				requestedBy: hrebenActors.autopilot,
			},
			provenance: {
				kind: "run-output",
				effectId: "effect-newsletter-draft-11",
				runId: "run-newsletter-11",
				actor: hrebenActors.autopilot,
				label: "Draft·Autopilot",
			},
		},
		allowedActions: ["open", "assign", "change-status", "archive"],
	},
	photos: {
		id: "photos",
		version: 3,
		title: "Produktové fotky — retuš 12 kusov",
		project: project("project-photo", "foto", "Foto"),
		assignee: hrebenActors.jan,
		thread: { threadId: "thread-photos", commentCount: 1 },
		priority: "normal",
		status: {
			kind: "in_review",
			review: {
				reviewRequestId: "review-photos-03",
				requestedAt: "2026-07-19T09:38:00+02:00",
				requestedBy: hrebenActors.jan,
			},
		},
		allowedActions: ["open", "assign", "change-status", "archive"],
	},
	payments: {
		id: "payments",
		version: 2,
		title: "Spustiť platobnú bránu pre e-shop",
		project: project("project-payments", "platby", "Platby"),
		assignee: hrebenActors.marek,
		priority: "high",
		status: {
			kind: "blocked",
			blocker: {
				kind: "permission",
				permissionRequestId: "permission-payment-keys-02",
				label: "čaká na prístupové kľúče",
			},
		},
		allowedActions: ["open", "assign", "change-status"],
	},
	reviews: {
		id: "reviews",
		version: 5,
		title: "Recenzie produktov — výzva zákazníkom",
		project: project("project-reviews", "recenzie", "Recenzie"),
		assignee: hrebenActors.autopilot,
		priority: "low",
		status: {
			kind: "backlog",
			scheduledFor: { iso: "2026-07-20", label: "po 20. 7." },
		},
		allowedActions: ["open", "assign", "move-to-goal", "change-status", "archive"],
	},
	seo: {
		id: "seo",
		version: 6,
		title: "SEO audit kategórie Batohy",
		project: project("project-seo", "SEO", "SEO"),
		priority: "normal",
		suggestion: {
			kind: "agent-suggestion",
			effectId: "effect-seo-suggestion-06",
			runId: "run-seo-suggestion-06",
			actor: hrebenActors.autopilot,
			label: "Autopilot navrhol",
		},
		status: { kind: "ready" },
		allowedActions: ["open", "assign", "move-to-goal", "change-status", "archive"],
	},
	spring: {
		id: "spring",
		version: 14,
		title: "Jarná kolekcia — uvedenie",
		project: project("project-campaign", "kampaň", "Kampaň"),
		assignee: hrebenActors.autopilot,
		priority: "none",
		status: {
			kind: "done",
			completion: {
				completedAt: "2026-07-18T15:02:00+02:00",
				completedBy: hrebenActors.autopilot,
				undoUntil: "2026-07-26T15:02:00+02:00",
			},
			provenance: {
				kind: "automation",
				effectId: "effect-spring-publish-14",
				runId: "run-spring-publish-14",
				actor: hrebenActors.autopilot,
				label: "auto-publikované",
			},
		},
		allowedActions: ["open", "undo"],
	},
} satisfies Record<string, TaskRowProjection<typeof spaceId>>;

const groups = [
	{ id: "running", label: "Beží", count: 2, taskIds: ["landing", "catalog"] },
	{
		id: "review",
		label: "Na schválenie",
		count: 2,
		taskIds: ["newsletter", "photos"],
		context: { label: "realtime · práve pribudlo", tone: "live" as const },
	},
	{ id: "blocked", label: "Blokované", count: 1, taskIds: ["payments"] },
	{
		id: "backlog",
		label: "Backlog",
		count: 216,
		taskIds: ["reviews", "seo"],
		quickAdd: { label: "Rýchlo pridať úlohu — názov a Enter…", shortcut: "N" },
	},
	{
		id: "done",
		label: "Hotové",
		count: 2,
		taskIds: ["spring"],
		context: { label: "Filter: posledných 7 dní" },
	},
] satisfies readonly TaskGroupProjection[];

const context = {
	companyId: "company-hreben",
	spaceId,
	spaceName: "E-shop",
	project: { id: "project-shop", label: "E-shop" },
	memberCount: 3,
	agentCount: 1,
	counts: { tasks: 12, goals: 5, channels: 5 },
	members: [
		{ actor: hrebenActors.marek, presence: "online" as const },
		{ actor: hrebenActors.lucia, presence: "away" as const },
		{ actor: hrebenActors.jan },
		{ actor: hrebenActors.autopilot, presence: "online" as const },
	],
};

const display = {
	active: "list" as const,
	list: {
		kind: "ready" as const,
		groups,
		tasks,
		page: {
			loadedCount: 8,
			totalCount: 222,
			next: { kind: "ready" as const, cursor: "task:spring", label: "Načítať ďalšie" },
		},
	},
	board: { kind: "ready" as const, columns: groups },
};

export const hrebenTaskListFixture = {
	context,
	sync: { kind: "live", lastEventId: "event-42" },
	access: { kind: "writable", canCreate: true, canSelect: true, canMutate: true },
	view: {
		presets: ["needs-you", "running", "team", "scheduled", "overdue"],
		activePreset: "needs-you",
		grouping: "status",
		searchQuery: "",
	},
	selection: {
		selectedTaskIds: ["landing", "newsletter", "seo"],
		actions: ["assign", "move-to-goal", "change-status", "archive"],
	},
	display,
} satisfies TaskListProjection<typeof spaceId>;

export const hrebenReconnectingProjection = {
	...hrebenTaskListFixture,
	sync: {
		kind: "reconnecting",
		label: "Offline — obnovujem spojenie…",
		replayLabel: "Last-Event-ID · replay 12 udalostí",
		lastEventId: "event-42",
	},
} satisfies TaskListProjection<typeof spaceId>;

export const hrebenObjectListFixture = mapTaskListProjection(
	hrebenTaskListFixture,
	() => undefined,
);
