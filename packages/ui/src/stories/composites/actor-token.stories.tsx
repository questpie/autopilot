import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn } from "storybook/test";

import { ActorChip } from "../../components/composites";

const human = {
	id: "marek",
	name: "Marek Drepovský",
	kind: "human" as const,
};

const agent = {
	id: "autopilot",
	name: "Autopilot",
	kind: "agent" as const,
};

const meta = {
	title: "Composites/Actor token",
	component: ActorChip,
	tags: ["autodocs"],
	parameters: { layout: "centered" },
	args: { actor: human, size: "sm" },
} satisfies Meta<typeof ActorChip>;

export default meta;
type Story = StoryObj<typeof meta>;

async function expectConcentricToken(
	canvasElement: HTMLElement,
	expected: {
		outer: number;
		mark: number;
		radius: number;
		verticalInset: number;
		horizontalInset: number;
	},
) {
	const surface = canvasElement.querySelector('[data-slot="actor-chip"] [data-slot="badge"]');
	const mark = canvasElement.querySelector('[data-slot="actor-chip"] [data-slot="actor-mark"]');
	if (!(surface instanceof HTMLElement) || !(mark instanceof HTMLElement)) {
		throw new Error("Chýba povrch alebo značka Actor tokenu");
	}
	const surfaceRect = surface.getBoundingClientRect();
	const markRect = mark.getBoundingClientRect();
	const outerRadius = Number.parseFloat(getComputedStyle(surface).borderTopLeftRadius);
	const verticalInset = (surfaceRect.height - markRect.height) / 2;
	const horizontalInset = markRect.left - surfaceRect.left;

	await expect(surfaceRect.height).toBe(expected.outer);
	await expect(markRect.width).toBe(expected.mark);
	await expect(markRect.height).toBe(expected.mark);
	await expect(verticalInset).toBe(expected.verticalInset);
	await expect(horizontalInset).toBe(expected.horizontalInset);
	await expect(outerRadius).toBe(expected.radius);
	await expect(outerRadius).toBeGreaterThanOrEqual(surfaceRect.height / 2);
}

const smallGeometry = { outer: 28, mark: 20, radius: 14, verticalInset: 4, horizontalInset: 4 };
const mediumGeometry = { outer: 32, mark: 24, radius: 16, verticalInset: 4, horizontalInset: 4 };

export const HumanSelection: Story = {
	play: async ({ canvasElement }) => expectConcentricToken(canvasElement, smallGeometry),
};
export const AgentSelection: Story = {
	args: { actor: agent },
	play: async ({ canvasElement }) => expectConcentricToken(canvasElement, smallGeometry),
};
export const Medium: Story = {
	args: { size: "md" },
	play: async ({ canvasElement }) => expectConcentricToken(canvasElement, mediumGeometry),
};
export const Presence: Story = {
	args: { actor: agent, presence: "online" },
	play: async ({ canvasElement }) => expectConcentricToken(canvasElement, smallGeometry),
};
export const Unavailable: Story = {
	args: { availability: "unavailable" },
	play: async ({ canvasElement }) => expectConcentricToken(canvasElement, smallGeometry),
};
export const RemovableSelection: Story = {
	args: { actor: agent, pickerMode: true, onRemove: fn() },
	play: async ({ canvasElement }) => {
		await expectConcentricToken(canvasElement, smallGeometry);
		const remove = canvasElement.querySelector('[data-slot="actor-chip"] [data-slot="button"]');
		if (!(remove instanceof HTMLElement)) throw new Error("Chýba odobratie Actor tokenu");
		await expect(getComputedStyle(remove, "::after").width).toBe("40px");
		await expect(getComputedStyle(remove, "::after").height).toBe("40px");
	},
};

export const LongName: Story = {
	args: {
		actor: {
			...human,
			name: "Marek Drepovský z medzinárodného obchodného tímu",
		},
	},
	play: async ({ canvasElement }) => expectConcentricToken(canvasElement, smallGeometry),
};

export const Dark: Story = {
	globals: { theme: "dark" },
	play: async ({ canvasElement }) => expectConcentricToken(canvasElement, smallGeometry),
};

export const CoarsePointer: Story = {
	args: { actor: agent, presence: "online" },
	globals: { pointer: "coarse", viewport: { value: "mobile390", isRotated: false } },
	play: async ({ canvasElement }) => expectConcentricToken(canvasElement, smallGeometry),
};
