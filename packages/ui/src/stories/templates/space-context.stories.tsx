import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { SpaceContext } from "../../components/templates";
import { hrebenObjectListFixture } from "../../fixtures/hreben-work";

const meta = {
	title: "Templates/Space context",
	component: SpaceContext,
	tags: ["autodocs"],
	parameters: { layout: "fullscreen" },
	args: hrebenObjectListFixture.context,
} satisfies Meta<typeof SpaceContext>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Canonical: Story = {
	play: async ({ canvasElement }) => {
		const context = canvasElement.querySelector('[data-slot="space-context"]');
		if (!(context instanceof HTMLElement)) throw new Error("Chýba kontext priestoru");
		await expect(context.getBoundingClientRect().height).toBe(61);
	},
};

export const LongSlovakIdentity: Story = {
	args: {
		...hrebenObjectListFixture.context,
		title: "Medzinárodný e-shop a zákaznícka skúsenosť pre letnú sezónu",
		project: {
			label: "Projekt",
			value: "questpie-storefront-replatform-and-catalog-migration",
		},
	},
};

export const WithoutProject: Story = {
	args: { ...hrebenObjectListFixture.context, project: undefined },
};

export const ReplacedByMobilePlaceHeader: Story = {
	globals: { viewport: { value: "mobile390", isRotated: false } },
	play: async ({ canvasElement }) => {
		const context = canvasElement.querySelector('[data-slot="space-context"]');
		if (!(context instanceof HTMLElement)) throw new Error("Chýba kontext priestoru");
		await expect(getComputedStyle(context).display).toBe("none");
	},
};
