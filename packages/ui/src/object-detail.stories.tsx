import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { DocumentDetail, type ObjectDetailProjection } from "./components/templates";

const marek = { id: "marek", name: "Marek Hraško", kind: "human" as const };
const autopilot = { id: "autopilot", name: "Autopilot", kind: "agent" as const };

const taskDetail: ObjectDetailProjection = {
	id: "task-newsletter",
	kind: "task",
	eyebrow: "Úloha · Newsletter",
	title: "Pripraviť letný newsletter pre kolekciu Hrebeň",
	description:
		"Newsletter má predstaviť ľahké letné produkty, zľavový kód LETO26 a jasný termín odoslania.",
	status: { state: "attention", label: "Na schválenie" },
	metadata: [
		{ id: "project", label: "Projekt", value: "E-shop" },
		{ id: "goal", label: "Cieľ", value: "Letná kampaň 2026" },
		{ id: "assignee", label: "Aktér", value: "Autopilot" },
		{ id: "target", label: "Termín", value: "pondelok 20. 7." },
	],
	body: {
		lead: "Výsledkom je hotový newsletter pripravený na ľudské schválenie.",
		sections: [
			{
				id: "scope",
				title: "Rozsah",
				markdown:
					"- Úvod s hlavnou ponukou\n- Tri produktové bloky\n- Zľavový kód **LETO26**\n- Jednoznačná výzva na nákup",
			},
			{
				id: "notes",
				title: "Poznámky k značke",
				markdown:
					"Tón má byť ľahký a konkrétny. Nepoužívame nátlakové formulácie ani neoverené tvrdenia.",
			},
		],
	},
	evidence: [
		{
			id: "knowledge-brand",
			kind: "knowledge",
			label: "Tón značky Hrebeň",
			detail: "Znalosť · použitá pri návrhu",
		},
		{
			id: "draft-newsletter",
			kind: "artifact",
			label: "Newsletter · návrh 3",
			detail: "Artefakt · pripravený na kontrolu",
		},
	],
	thread: {
		title: "Vlákno úlohy",
		vessel: {
			kind: "thread",
			threadId: "thread-task-newsletter",
			anchor: { messageId: "task-newsletter", label: "Pripraviť letný newsletter" },
			participants: [
				{ actor: marek, presence: "online" },
				{ actor: autopilot, presence: "online" },
			],
			follow: { state: "following", label: "Sledujem" },
		},
		messages: [
			{
				id: "message-marek",
				actor: marek,
				authoredAt: { iso: "2026-07-19T14:43:00+02:00", label: "14:43" },
				parts: [
					{
						id: "message-marek-copy",
						kind: "markdown",
						markdown:
							'<mention actor_id="autopilot" node_id="mention-task-autopilot">@Autopilot</mention> doplň kód a priprav krátky text na Instagram.',
					},
				],
			},
			{
				id: "message-autopilot",
				actor: autopilot,
				authoredAt: { iso: "2026-07-19T14:44:00+02:00", label: "14:44" },
				parts: [
					{
						id: "message-autopilot-copy",
						kind: "markdown",
						markdown: "Hotovo. Návrh a zdroje som pripojil k úlohe na kontrolu.",
					},
				],
			},
		],
		composer: {
			mode: "thread",
			draft: { text: "", clientNonce: "detail-draft", mentions: [], attachments: [] },
			state: "ready",
			access: "write",
			placeholder: "Napíšte do vlákna úlohy…",
			mentionPicker: {
				label: "Spomenúť aktéra",
				actors: [marek, autopilot],
				state: "ready",
			},
		},
	},
};

const meta = {
	title: "Templates/Work/ObjectDetail",
	component: DocumentDetail,
	tags: ["autodocs"],
	parameters: { layout: "fullscreen" },
	args: {
		projection: taskDetail,
		onAction: fn(),
	},
} satisfies Meta<typeof DocumentDetail>;

export default meta;
type Story = StoryObj<typeof meta>;

function expectNoPageOverflow(canvasElement: HTMLElement) {
	const documentElement = canvasElement.ownerDocument.documentElement;
	return expect(documentElement.scrollWidth).toBeLessThanOrEqual(documentElement.clientWidth);
}

async function expectDrawerDisclosure(canvasElement: HTMLElement, direction: "down" | "right") {
	const canvas = within(canvasElement);
	const trigger = canvas.getByRole("button", { name: "Otvoriť vlákno a dôkazy" });
	await expect(trigger).toBeVisible();
	await expect(canvasElement.querySelector('[data-slot="contextual-thread-panel"]')).toBeNull();
	await userEvent.click(trigger);
	const body = within(canvasElement.ownerDocument.body);
	await expect(body.getByRole("dialog", { name: "Vlákno a dôkazy" })).toBeVisible();
	await expect(body.getAllByText("Vlákno úlohy")).toHaveLength(1);
	await expect(
		canvasElement.ownerDocument.querySelectorAll('[data-slot="contextual-thread-panel"]'),
	).toHaveLength(1);
	const popup = canvasElement.ownerDocument.querySelector('[data-slot="drawer-popup"]');
	if (!(popup instanceof HTMLElement)) throw new Error("Chýba adaptívny kontextový drawer");
	await expect(popup).toHaveAttribute("data-swipe-direction", direction);
	const popupBox = popup.getBoundingClientRect();
	if (direction === "right") {
		await expect(Math.round(popupBox.width)).toBe(380);
		await expect(Math.round(popupBox.height)).toBe(
			canvasElement.ownerDocument.defaultView?.innerHeight,
		);
	} else {
		await expect(Math.round(popupBox.width)).toBe(
			canvasElement.ownerDocument.documentElement.clientWidth,
		);
		await expect(Math.round(popupBox.height)).toBe(
			canvasElement.ownerDocument.defaultView?.innerHeight,
		);
	}
	const safeRegion = canvasElement.ownerDocument.querySelector(
		'[data-slot="contextual-panel-safe"]',
	);
	if (!(safeRegion instanceof HTMLElement)) throw new Error("Chýba safe-bottom región");
	await expect(getComputedStyle(safeRegion).paddingBottom).toBe("24px");
	await userEvent.keyboard("{Escape}");
	await waitFor(() => expect(body.queryByRole("dialog", { name: "Vlákno a dôkazy" })).toBeNull());
	await expect(trigger).toHaveFocus();
}

export const AtDetailSplit1180: Story = {
	globals: { viewport: { value: "detail1180", isRotated: false } },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const panel = canvasElement.querySelector('[data-slot="contextual-thread-panel"]');
		const aside = panel?.closest("aside");
		if (!(panel instanceof HTMLElement)) throw new Error("Chýba pripnuté kontextové vlákno");
		if (!(aside instanceof HTMLElement)) throw new Error("Chýba 380px kontextový panel");
		await expect(canvas.getByRole("heading", { name: taskDetail.title, level: 1 })).toBeVisible();
		await expect(canvas.getByText("Letná kampaň 2026")).toBeVisible();
		await expect(canvas.getByText("Newsletter · návrh 3")).toBeVisible();
		await expect(aside.getBoundingClientRect().width).toBe(380);
		await expect(canvas.queryByRole("button", { name: "Otvoriť vlákno a dôkazy" })).toBeNull();
		await userEvent.click(canvas.getByRole("button", { name: "Spomenúť aktéra" }));
		const menu = within(canvasElement.ownerDocument.body);
		await waitFor(() => expect(menu.getByRole("menuitem", { name: /Marek Hraško/ })).toBeVisible());
		await expect(menu.getByRole("menuitem", { name: /Autopilot/ })).toBeVisible();
		await userEvent.keyboard("{Escape}");
		await expectNoPageOverflow(canvasElement);
	},
};

export const BelowDetailSplit1179: Story = {
	globals: {
		safeArea: "24",
		viewport: { value: "detail1179", isRotated: false },
	},
	play: async ({ canvasElement }) => {
		await expectNoPageOverflow(canvasElement);
		await expectDrawerDisclosure(canvasElement, "right");
	},
};

export const BelowShellBoundary1023: Story = {
	globals: {
		safeArea: "24",
		viewport: { value: "shell1023", isRotated: false },
	},
	play: async ({ canvasElement }) => {
		await expectNoPageOverflow(canvasElement);
		await expectDrawerDisclosure(canvasElement, "right");
	},
};

export const BelowOverlayBoundary767: Story = {
	globals: {
		pointer: "coarse",
		safeArea: "24",
		viewport: { value: "overlay767", isRotated: false },
	},
	play: async ({ canvasElement }) => {
		await expectNoPageOverflow(canvasElement);
		await expectDrawerDisclosure(canvasElement, "down");
	},
};

export const AtOverlayBoundary768: Story = {
	globals: {
		safeArea: "24",
		viewport: { value: "overlay768", isRotated: false },
	},
	play: async ({ canvasElement }) => {
		await expectNoPageOverflow(canvasElement);
		await expectDrawerDisclosure(canvasElement, "right");
	},
};

export const Mobile390: Story = {
	globals: {
		pointer: "coarse",
		safeArea: "24",
		viewport: { value: "mobile390", isRotated: false },
	},
	play: async ({ canvasElement }) => {
		await expectNoPageOverflow(canvasElement);
		await expectDrawerDisclosure(canvasElement, "down");
		await expect(
			within(canvasElement)
				.getByRole("heading", { name: taskDetail.title, level: 1 })
				.getBoundingClientRect().width,
		).toBeGreaterThanOrEqual(300);
		await expect(
			within(canvasElement)
				.getByRole("button", { name: "Otvoriť vlákno a dôkazy" })
				.getBoundingClientRect().height,
		).toBe(44);
	},
};

export const EmptyEvidence: Story = {
	args: {
		projection: { ...taskDetail, evidence: [] },
	},
	play: async ({ canvasElement }) => {
		await expect(within(canvasElement).getByText("Zatiaľ bez dôkazov")).toBeVisible();
	},
};

export const ReadOnlyThread: Story = {
	args: {
		projection: {
			...taskDetail,
			thread: taskDetail.thread
				? {
						...taskDetail.thread,
						composer: { ...taskDetail.thread.composer, access: "read_only" },
					}
				: undefined,
		},
	},
	play: async ({ canvasElement }) => {
		await expect(canvasElement.querySelector('[data-slot="message-composer"]')).toBeNull();
		await expect(within(canvasElement).getByText("Vlákno je iba na čítanie")).toBeVisible();
	},
};

export const LongSlovakCopy390: Story = {
	globals: { pointer: "coarse", viewport: { value: "mobile390", isRotated: false } },
	args: {
		projection: {
			...taskDetail,
			title:
				"Pripraviť dôsledne vysvetlený letný newsletter pre zákazníkov, ktorí nakupujú z mobilu počas cestovania",
			description:
				"Text musí zostať čitateľný aj pri veľmi úzkom priestore, nesmie vytlačiť akcie mimo obrazovky a musí prirodzene zalamovať slovenské slová aj názvy prepojených objektov.",
		},
	},
	play: async ({ canvasElement }) => {
		await expectNoPageOverflow(canvasElement);
	},
};

export const Dark: Story = {
	globals: { theme: "dark", viewport: { value: "wide1440", isRotated: false } },
};

export const ReducedMotion: Story = {
	globals: { motion: "reduce", viewport: { value: "shell1023", isRotated: false } },
	play: async ({ canvasElement }) => {
		const trigger = within(canvasElement).getByRole("button", { name: "Otvoriť vlákno a dôkazy" });
		await expect(trigger).toBeVisible();
		await expect(canvasElement.ownerDocument.documentElement.dataset.reducedMotion).toBe("reduce");
	},
};
