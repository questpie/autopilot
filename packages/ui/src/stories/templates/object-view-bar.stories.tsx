import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { ObjectViewBar } from "../../components/templates";
import { hrebenObjectListFixture } from "../../fixtures/hreben-work";

const meta = {
	title: "Templates/Object view bar",
	component: ObjectViewBar,
	tags: ["autodocs"],
	parameters: { layout: "fullscreen" },
	args: {
		...hrebenObjectListFixture.view,
		onCreate: fn(),
		onFilter: fn(),
		onGroup: fn(),
		onSearch: fn(),
	},
} satisfies Meta<typeof ObjectViewBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {
	globals: { viewport: { value: "wide1440", isRotated: false } },
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole("button", { name: "Nová úloha" }));
		await expect(args.onCreate).toHaveBeenCalledOnce();
		const bar = canvasElement.querySelector('[data-slot="object-view-bar"]');
		if (!(bar instanceof HTMLElement)) throw new Error("Chýba pracovná lišta");
		await expect(bar.getBoundingClientRect().height).toBe(63);
	},
};

export const NarrowDesktop: Story = {
	globals: { viewport: { value: "shell1024", isRotated: false } },
};

export const MobileControls: Story = {
	globals: { pointer: "coarse", viewport: { value: "mobile390", isRotated: false } },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.queryByRole("button", { name: "Nová úloha" })).toBeNull();
		await expect(canvas.getByRole("button", { name: "Nástroje úloh" })).toBeVisible();
		await expect(canvas.queryByRole("button", { name: "Filter" })).toBeNull();
	},
};
