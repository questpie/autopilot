import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";

import { SpaceFacetNav } from "../../components/templates";
import { hrebenObjectListFixture } from "../../fixtures/hreben-work";

const meta = {
	title: "Templates/Space facet nav",
	component: SpaceFacetNav,
	tags: ["autodocs"],
	parameters: { layout: "fullscreen" },
	args: hrebenObjectListFixture.facets,
} satisfies Meta<typeof SpaceFacetNav>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CanonicalOrder: Story = {
	play: async ({ canvasElement }) => {
		const tabs = within(canvasElement).getAllByRole("tab");
		await expect(tabs.map((tab) => tab.textContent?.trim())).toEqual([
			"Prehľad",
			"Úlohy12",
			"Ciele5",
			"Kanál5",
			"Znalosti",
			"Dashboardy",
		]);
	},
};

export const Keyboard: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const overview = canvas.getByRole("tab", { name: "Prehľad" });
		overview.focus();
		await userEvent.keyboard("{ArrowRight}");
		await expect(canvas.getByRole("tab", { name: /Úlohy/ })).toHaveFocus();
	},
};

export const MobileOverflow: Story = {
	globals: { viewport: { value: "mobile390", isRotated: false } },
	play: async ({ canvasElement }) => {
		const navigation = canvasElement.querySelector('[data-slot="space-facet-nav"]');
		if (!(navigation instanceof HTMLElement)) throw new Error("Chýba facet navigácia");
		await expect(navigation.scrollWidth).toBeGreaterThan(navigation.clientWidth);
	},
};

export const Dark: Story = {
	globals: { theme: "dark" },
};
