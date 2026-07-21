import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, within } from "storybook/test";

import {
	RunCard,
	RunDetail,
	type RunDetailProjection,
	type RunPresentationState,
} from "../../components/ai";

const autopilot = { id: "autopilot", name: "Autopilot", kind: "agent" as const };
const marek = { id: "marek", name: "Marek H.", kind: "human" as const };
const permission = {
	id: "permission-publish",
	capability: "Publikovať newsletter",
	scope: "E-shop · draft newsletter-01",
	consequence: "Obsah sa odošle 4 281 odberateľom.",
	requestedBy: autopilot,
	decision: "pending" as const,
	canDecide: false,
};
const recap = {
	summary: "Newsletter je pripravený na kontrolu.",
	items: [
		{
			id: "effect-01",
			kind: "effect" as const,
			label: "Aktualizoval draft newslettera",
			referenceId: "newsletter-draft-01",
			actor: autopilot,
			occurredAt: "09:48",
		},
		{
			id: "output-01",
			kind: "output" as const,
			label: "Text newslettera",
			referenceId: "artifact-copy-01",
			actor: autopilot,
			occurredAt: "09:48",
		},
		{
			id: "evidence-01",
			kind: "evidence" as const,
			label: "Tón značky Hrebeň",
			referenceId: "knowledge-tone-01",
			actor: autopilot,
			occurredAt: "09:46",
			detail: "Použitý ako podklad pre návrh.",
		},
	],
};
const baseRun = {
	id: "run-01",
	actor: autopilot,
	elapsed: "2 min",
	activity: "Zhrnul 4 kroky · naposledy pripravil návrh newslettera",
	hiddenActivityCount: 5,
};
const liveState = {
	kind: "live",
	phase: "working",
	phaseLabel: "Pracuje",
	currentAction: "Pripravuje návrh newslettera",
} as const;
const run = { ...baseRun, state: liveState };
const states: readonly RunPresentationState[] = [
	liveState,
	{ kind: "waiting-permission", permission },
	{ kind: "failed", summary: "Publikovanie zlyhalo.", retryLabel: "Skúsiť znova" },
	{ kind: "reconnecting", label: "Obnovuje spojenie", replayLabel: "Čaká na replay udalostí" },
	{
		kind: "cancel-requested",
		requestId: "cancel-request-01",
		label: "Čaká na bezpečné zastavenie",
		requestedAt: "09:46",
		requestedBy: marek,
	},
	{
		kind: "rejected",
		reason: "Publikovanie nie je povolené politikou Priestoru.",
		occurredAt: "09:46",
		policyReferenceId: "policy-space-publish-01",
	},
	{
		kind: "timed-out",
		summary: "Pracovný stroj neodpovedal v povolenom čase.",
		occurredAt: "09:47",
		retryLabel: "Spustiť nový pokus",
	},
	{ kind: "cancelled", reason: "Zrušené operátorom", cancelledAt: "09:47", cancelledBy: marek },
	{ kind: "completed", recap },
];

const meta = {
	title: "Agent work/Run terminal",
	component: RunCard,
	tags: ["autodocs"],
	parameters: { layout: "centered" },
	args: { run, onOpenDetail: fn() },
} satisfies Meta<typeof RunCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Running: Story = {};

export const LifecycleStates: Story = {
	render: () => (
		<div className="ui-story-run-column">
			{states.map((state) => (
				<RunCard
					key={state.kind}
					run={{ ...baseRun, state }}
					onOpenDetail={fn()}
					onRetry={state.kind === "failed" ? fn() : undefined}
				/>
			))}
		</div>
	),
	play: async ({ canvasElement }) => {
		await expect(canvasElement.ownerDocument.documentElement.scrollWidth).toBeLessThanOrEqual(
			canvasElement.ownerDocument.documentElement.clientWidth,
		);
		const summaries = canvasElement.querySelectorAll<HTMLElement>('[data-part="run-summary"]');
		await expect(summaries).toHaveLength(9);
		for (const [index, state] of states.entries()) {
			await expect(summaries[index]).toHaveAttribute("data-slot", "work-block");
			await expect(summaries[index]).toHaveAttribute("data-run-state", state.kind);
			await expect(Math.round(summaries[index]!.getBoundingClientRect().height)).toBe(144);
			await expect(summaries[index]!.querySelectorAll('[data-slot="work-block-row"]')).toHaveLength(
				2,
			);
			const content = summaries[index]!.querySelector<HTMLElement>(
				'[data-slot="work-block-content"]',
			);
			const lastRow = summaries[index]!.querySelector<HTMLElement>(
				'[data-slot="work-block-row"]:last-child',
			);
			await expect(content).not.toBeNull();
			await expect(lastRow).not.toBeNull();
			await expect(Math.ceil(lastRow!.getBoundingClientRect().bottom)).toBeLessThanOrEqual(
				Math.ceil(content!.getBoundingClientRect().bottom),
			);
		}
		await expect(canvasElement.querySelectorAll('[data-slot="run-current-action"]')).toHaveLength(
			1,
		);
		await expect(within(canvasElement).getByRole("button", { name: "Skúsiť znova" })).toBeEnabled();
		await expect(
			within(summaries[2]!).getByRole("button", { name: "Zobraziť detail behu" }),
		).toBeEnabled();
		await expect(summaries[3]).not.toHaveTextContent("Zrušené operátorom");
		await expect(
			canvasElement.querySelector('[data-run-state="cancel-requested"]'),
		).toHaveTextContent("Čaká na bezpečné zastavenie");
		await expect(canvasElement.querySelector('[data-run-state="rejected"]')).toHaveTextContent(
			"Publikovanie nie je povolené politikou Priestoru.",
		);
		await expect(canvasElement.querySelector('[data-run-state="timed-out"]')).toHaveTextContent(
			"Pracovný stroj neodpovedal",
		);
	},
};

export const DurableActivePhases: Story = {
	render: () => (
		<div className="ui-story-run-column">
			{(
				[
					["queued", "Čaká", "približne 1 min", "Čaká na pridelenie pracovného stroja"],
					["evaluating", "Vyhodnocuje", "18 s", "Kontroluje oprávnenia a dostupný kontext"],
					["working", "Pracuje", "2 min", "Pripravuje návrh newslettera"],
					["responding", "Odpovedá", "12 s", "Ukladá výsledok a pripravuje odpoveď"],
				] as const
			).map(([phase, phaseLabel, elapsed, currentAction]) => (
				<RunCard
					key={phase}
					run={{
						...baseRun,
						elapsed,
						state: { kind: "live", phase, phaseLabel, currentAction },
					}}
					onOpenDetail={fn()}
				/>
			))}
		</div>
	),
	play: async ({ canvasElement }) => {
		for (const phase of ["queued", "evaluating", "working", "responding"] as const) {
			const card = canvasElement.querySelector<HTMLElement>(`[data-run-phase="${phase}"]`);
			await expect(card).not.toBeNull();
			await expect(Math.round(card!.getBoundingClientRect().height)).toBe(144);
		}
		await expect(canvasElement).toHaveTextContent("približne 1 min");
		await expect(canvasElement).toHaveTextContent("18 s");
		await expect(canvasElement).toHaveTextContent("12 s");
	},
};

export const LongActivityFixedFootprint: Story = {
	render: () => (
		<div className="ui-story-run-column">
			{Array.from({ length: 4 }, (_, index) => (
				<RunCard
					key={index}
					run={{ ...run, activity: `${run.activity}. ${"Veľmi dlhá aktivita ".repeat(8)}` }}
					onOpenDetail={fn()}
				/>
			))}
		</div>
	),
	globals: { viewport: { value: "mobile390", isRotated: false } },
	play: async ({ canvasElement }) => {
		const cards = canvasElement.querySelectorAll<HTMLElement>('[data-fixed-height="true"]');
		await expect(cards).toHaveLength(4);
		await expect(
			new Set(Array.from(cards, (card) => card.getBoundingClientRect().height)).size,
		).toBe(1);
	},
};

export const Dark: Story = {
	globals: { theme: "dark", viewport: { value: "mobile390", isRotated: false } },
	play: async ({ canvasElement }) => {
		const summary = canvasElement.querySelector<HTMLElement>('[data-part="run-summary"]');
		await expect(summary).not.toBeNull();
		await expect(Math.round(summary!.getBoundingClientRect().height)).toBe(144);
		await expect(canvasElement.ownerDocument.documentElement.dataset.theme).toBe("dark");
	},
};

export const ReducedMotion: Story = {
	globals: { motion: "reduce", viewport: { value: "mobile390", isRotated: false } },
	play: async ({ canvasElement }) => {
		const summary = canvasElement.querySelector<HTMLElement>('[data-part="run-summary"]');
		await expect(summary).not.toBeNull();
		await expect(Math.round(summary!.getBoundingClientRect().height)).toBe(144);
		await expect(canvasElement.ownerDocument.documentElement.dataset.reducedMotion).toBe("reduce");
	},
};

export const PermissionGate: Story = {
	render: () => {
		const projection = {
			run: { ...baseRun, state: states[1]! },
			groups: [],
			permissions: [permission],
			attempts: [],
			defaultTab: "permissions",
		} satisfies RunDetailProjection;
		return <RunDetail projection={projection} onAction={fn()} />;
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("Publikovať newsletter")).toBeVisible();
		await expect(canvas.getByText("E-shop · draft newsletter-01")).toBeVisible();
		await expect(canvas.getByText("Obsah sa odošle 4 281 odberateľom.")).toBeVisible();
		await expect(canvas.getAllByText("Autopilot")).toHaveLength(2);
		// Each request is a bounded caution card (board .approval), not a hairline row:
		// a WorkBlock at radius-md 14 with a gold caution header while pending.
		const gate = canvasElement.querySelector<HTMLElement>('[data-part="run-permission"]');
		await expect(gate).not.toBeNull();
		await expect(gate).toHaveAttribute("data-slot", "work-block");
		await expect(getComputedStyle(gate!).borderTopLeftRadius).toBe("14px");
		const permissionHeader = gate!.querySelector<HTMLElement>('[data-slot="work-block-header"]');
		await expect(getComputedStyle(permissionHeader!).backgroundColor).toBe("rgb(255, 248, 232)");
		await expect(canvas.queryByRole("button", { name: "Povoliť" })).toBeNull();
		await expect(canvas.getByText(/nemôže schváliť vlastnú žiadosť/)).toBeVisible();
	},
};

export const FailedRun: Story = {
	render: () => (
		<RunDetail
			projection={{
				run: { ...baseRun, state: states[2]! },
				groups: [],
				permissions: [],
				attempts: [
					{
						id: "attempt-01",
						label: "Pokus 1",
						status: "failed",
						startedAt: "09:41",
						endedAt: "09:43",
					},
				],
				defaultTab: "recap",
			}}
			onAction={fn()}
		/>
	),
	play: async ({ canvasElement }) => {
		await expect(within(canvasElement).getByRole("button", { name: "Skúsiť znova" })).toBeEnabled();
		await expect(canvasElement.querySelector('[data-slot="run-recap"]')).toBeNull();
	},
};

export const CompletedRecap: Story = {
	render: () => (
		<RunDetail
			projection={{
				run: { ...baseRun, state: states[8]! },
				groups: [],
				permissions: [],
				attempts: [{ id: "attempt-01", label: "Pokus 1", status: "completed", startedAt: "09:41" }],
			}}
			onAction={fn()}
		/>
	),
	play: async ({ canvasElement }) => {
		const records = canvasElement.querySelectorAll('[data-part="run-provenance-record"]');
		await expect(records).toHaveLength(3);
		for (const record of records) {
			await expect(record).toHaveAttribute("data-slot", "item");
		}
		for (const referenceId of ["newsletter-draft-01", "artifact-copy-01", "knowledge-tone-01"]) {
			await expect(
				canvasElement.querySelector(`[data-reference-id="${referenceId}"]`),
			).toBeVisible();
		}
		await expect(canvasElement.querySelectorAll('[data-slot="actor-identity"]')).toHaveLength(3);
	},
};

export const FullRunDetail: Story = {
	render: () => (
		<RunDetail
			projection={{
				run,
				groups: [
					{
						id: "g1",
						label: "Prehľadal Znalosti",
						count: 4,
						latest: "Našiel cenník leto 2026",
						time: "09:42",
					},
				],
				permissions: [],
				attempts: [{ id: "attempt-01", label: "Pokus 1", status: "running", startedAt: "09:41" }],
			}}
			onAction={fn()}
		/>
	),
	play: async ({ canvasElement }) => {
		await expect(within(canvasElement).getByText(/\+3 súvisiacich krokov/)).toBeVisible();
		await expect(canvasElement).not.toHaveTextContent("Použil 4 nástroje");
	},
};
