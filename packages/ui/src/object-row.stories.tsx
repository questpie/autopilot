import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, within } from "storybook/test";

import { ObjectRow } from "./components/composites";
import { hrebenActors } from "./fixtures/hreben-work";

const meta = {
	title: "Product composites/Work/ObjectRow",
	component: ObjectRow,
	tags: ["autodocs"],
	parameters: { layout: "fullscreen" },
	args: {
		id: "landing",
		title: "Landing sekcia — hero + prehľad kolekcie",
		tag: "landing",
		status: "running",
		selection: { checked: true, onCheckedChange: fn() },
		progress: { completed: 5, total: 8, dueLabel: "o 12 dní" },
		agentActivity: {
			actor: hrebenActors.autopilot,
			label: "Autopilot · píše…",
			elapsed: "0:41",
			actionLabel: "sleduj",
		},
		comments: 6,
	},
} satisfies Meta<typeof ObjectRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Running: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const row = canvasElement.querySelector('[data-slot="work-object-row"]');
		if (!(row instanceof HTMLElement)) throw new Error("Chýba pracovný riadok");
		await expect(row.getBoundingClientRect().height).toBeGreaterThanOrEqual(40);
		await expect(row.getBoundingClientRect().height).toBeLessThanOrEqual(48);
		await expect(canvas.getByRole("checkbox", { name: /Landing sekcia/ })).toBeChecked();
		await expect(canvas.getByText("landing")).toBeVisible();
		await expect(canvas.getByText("Autopilot · píše…")).toBeVisible();
		await expect(canvas.getByText("0:41")).toBeVisible();
	},
};

export const NeedsHuman: Story = {
	args: {
		id: "checkout",
		title: "Zrýchliť mobilný checkout",
		progress: undefined,
		agentActivity: undefined,
		comments: undefined,
		status: "attention",
		notice: { label: "čaká na teba", tone: "attention" },
		actors: [{ actor: hrebenActors.marek }],
	},
};

export const AgentSuggestion: Story = {
	args: {
		id: "spring",
		title: "Jarná kolekcia — uvedenie",
		progress: undefined,
		agentActivity: undefined,
		comments: undefined,
		status: "idle",
		suggestion: "Autopilot navrhol uzavrieť",
		actors: [{ actor: hrebenActors.marek }],
	},
};

export const LongSlovakCopy: Story = {
	args: {
		title:
			"Pripraviť produktové stránky pre štyri letné produkty vrátane veľmi dlhého názvu kolekcie a lokalizovaných popisov",
	},
};

export const CoarsePointer: Story = {
	globals: { pointer: "coarse", viewport: { value: "mobile390", isRotated: false } },
	play: async ({ canvasElement }) => {
		const row = canvasElement.querySelector('[data-slot="work-object-row"]');
		if (!(row instanceof HTMLElement)) throw new Error("Chýba pracovný riadok");
		await expect(row.getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
	},
};
