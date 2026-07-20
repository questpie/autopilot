import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { QuickAddRow, SelectionBar, StateGroup, VirtualizationTail } from "./components/composites";

const meta = {
	title: "Product composites/Work/List anatomy",
	parameters: { layout: "fullscreen" },
	tags: ["autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Selection: Story = {
	render: () => (
		<SelectionBar
			count={3}
			context="označené naprieč 3 skupinami"
			actions={[
				{ id: "assign", label: "Priradiť", onSelect: fn() },
				{ id: "goal", label: "Do cieľa", onSelect: fn() },
				{ id: "state", label: "Zmeniť stav", onSelect: fn() },
				{ id: "archive", label: "Archivovať", onSelect: fn() },
			]}
			onClear={fn()}
		/>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const bar = canvasElement.querySelector('[data-slot="work-selection-bar"]');
		if (!(bar instanceof HTMLElement)) throw new Error("Chýba lišta výberu");
		await expect(bar.getBoundingClientRect().height).toBe(44);
		await expect(canvas.getByText("3 vybrané")).toBeVisible();
		await expect(canvas.getByRole("button", { name: "Zrušiť výber" })).toBeVisible();
	},
};

export const GroupHeader: Story = {
	render: () => (
		<StateGroup
			id="review"
			label="Na schválenie"
			count={2}
			tone="attention"
			context={{ label: "realtime · práve pribudlo", tone: "live" }}
			items={[]}
		/>
	),
	play: async ({ canvasElement }) => {
		const header = canvasElement.querySelector('[data-slot="state-group-header"]');
		if (!(header instanceof HTMLElement)) throw new Error("Chýba hlavička skupiny");
		await expect(header.getBoundingClientRect().height).toBe(46);
		await expect(within(canvasElement).getByText("realtime · práve pribudlo")).toBeVisible();
	},
};

export const QuickAddAndTail: Story = {
	render: () => (
		<div>
			<QuickAddRow label="Rýchlo pridať úlohu — názov a Enter…" shortcut="N" onAdd={fn()} />
			<VirtualizationTail
				count={214}
				label="ďalších úloh · virtualizované (načítajú sa pri scrollovaní)"
			/>
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			canvas.getByRole("button", { name: "Rýchlo pridať úlohu — názov a Enter…" }),
		);
		await expect(canvas.getByText("214")).toBeVisible();
	},
};
