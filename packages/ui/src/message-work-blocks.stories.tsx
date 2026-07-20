import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn } from "storybook/test";

import type { ChannelMessagePart } from "./components/ai";
import { MessagePartList } from "./components/ai";

const autopilot = { id: "autopilot", name: "Autopilot", kind: "agent" as const };

const parts = [
	{
		id: "run-completed-01",
		kind: "run" as const,
		run: {
			id: "run-newsletter-01",
			actor: { id: "autopilot", name: "Autopilot", kind: "agent" as const },
			activity: "Zhrnul 4 kroky · naposledy pripravil návrh",
			state: {
				kind: "completed" as const,
				recap: {
					summary: "Newsletter je pripravený na kontrolu.",
					items: [
						{
							id: "output-01",
							kind: "output" as const,
							label: "Text newslettera",
							referenceId: "artifact-copy-01",
							actor: { id: "autopilot", name: "Autopilot", kind: "agent" as const },
							occurredAt: "09:48",
						},
					],
				},
			},
		},
	},
	{
		id: "plan-01",
		kind: "plan" as const,
		title: "Plán · 4 kroky",
		steps: [
			{ id: "p1", label: "Načítať tón zo Znalostí", state: "done" as const },
			{ id: "p2", label: "Doplniť zľavový kód LETO26", state: "done" as const },
			{ id: "p3", label: "Napísať text príspevku", state: "running" as const },
			{ id: "p4", label: "Poslať na schválenie", state: "pending" as const },
		],
	},
	{
		id: "tools-01",
		kind: "tool-summary" as const,
		count: 7,
		latest: "Pripravil draft newslettera",
	},
	{
		id: "permission-01",
		kind: "permission" as const,
		runId: "run-newsletter-01",
		permission: {
			id: "permission-publish-01",
			capability: "Zverejniť newsletter",
			scope: "E-shop · jednorazovo pre draft newsletter-01",
			consequence: "Obsah sa odošle zákazníkom.",
			requestedBy: autopilot,
			decision: "pending" as const,
			canDecide: true,
			expiresAt: "dnes 10:30",
		},
	},
	{
		id: "artifact-01",
		kind: "artifact" as const,
		title: "Letný newsletter · draft",
		mediaType: "Dokument",
		provenance: "Vytvoril Autopilot",
		status: "draft" as const,
	},
] satisfies readonly ChannelMessagePart[];

const meta = {
	title: "Agent work/Typed message blocks",
	component: MessagePartList,
	tags: ["autodocs"],
	parameters: { layout: "padded" },
	args: { parts, onAction: fn() },
} satisfies Meta<typeof MessagePartList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Catalog: Story = {
	play: async ({ args, canvasElement }) => {
		for (const slot of ["run", "plan", "tool-summary", "permission", "artifact"]) {
			await expect(canvasElement.querySelector(`[data-slot="message-part-${slot}"]`)).toBeVisible();
		}
		await expect(canvasElement.querySelector('[data-run-state="completed"]')).toBeVisible();
		await expect(
			Math.round(
				canvasElement
					.querySelector<HTMLElement>('[data-part="run-summary"]')!
					.getBoundingClientRect().height,
			),
		).toBe(144);
		for (const block of canvasElement.querySelectorAll('[data-slot="work-block"]')) {
			await expect(block.getBoundingClientRect().width).toBeLessThanOrEqual(672);
		}
		await expect(canvasElement.querySelector('button[data-decision="approve"]')).toBeNull();
		await expect(canvasElement.querySelector('button[data-decision="deny"]')).toBeNull();
		const openRun = Array.from(canvasElement.querySelectorAll("button")).find(
			(button) => button.textContent?.trim() === "Otvoriť detail behu",
		);
		await expect(openRun).toBeVisible();
		openRun?.click();
		await expect(args.onAction).toHaveBeenCalledWith({
			kind: "open-run",
			runId: "run-newsletter-01",
		});
	},
};

export const Mobile390: Story = {
	globals: { pointer: "coarse", viewport: { value: "mobile390", isRotated: false } },
};

export const UnauthorizedPermission: Story = {
	args: {
		parts: [
			{
				id: "permission-self-approval",
				kind: "permission",
				runId: "run-newsletter-unauthorized",
				permission: {
					id: "permission-self-approval",
					capability: "Zverejniť newsletter",
					scope: "E-shop · draft newsletter-01",
					consequence: "Obsah sa odošle zákazníkom.",
					requestedBy: autopilot,
					decision: "pending",
					canDecide: false,
				},
			},
		],
	},
	play: async ({ canvasElement }) => {
		await expect(canvasElement).toHaveTextContent("Autopilot");
		await expect(canvasElement).toHaveTextContent("Rozhodnutie je dostupné v detaile behu");
		await expect(canvasElement.querySelector('button[data-decision="approve"]')).toBeNull();
		await expect(canvasElement.querySelector('button[data-decision="deny"]')).toBeNull();
	},
};
