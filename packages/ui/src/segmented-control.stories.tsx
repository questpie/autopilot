import type { Meta, StoryObj } from "@storybook/react-vite";
import { LayoutListIcon, SparklesIcon } from "lucide-react";
import { expect } from "storybook/test";

import { ToggleGroup, ToggleGroupItem } from "./components/ui";

function SegmentedControlSpecimen() {
	return (
		<div className="ui-story-stack">
			<ToggleGroup aria-label="Spôsob vytvorenia" value={["autopilot"]}>
				<ToggleGroupItem value="autopilot">
					<SparklesIcon data-icon="inline-start" />
					S Autopilotom
				</ToggleGroupItem>
				<ToggleGroupItem value="manual">Napíšem sám</ToggleGroupItem>
			</ToggleGroup>
			<ToggleGroup aria-label="Zobrazenie" value={["list"]}>
				<ToggleGroupItem value="list">
					<LayoutListIcon data-icon="inline-start" />
					Zoznam
				</ToggleGroupItem>
				<ToggleGroupItem value="board">Tabuľa</ToggleGroupItem>
			</ToggleGroup>
		</div>
	);
}

async function expectConcentricSegmentedControl(canvasElement: HTMLElement) {
	const groups = canvasElement.querySelectorAll('[data-slot="toggle-group"]');
	await expect(groups.length).toBeGreaterThan(0);

	for (const group of groups) {
		const active = group.querySelector('[data-slot="toggle-group-item"][aria-pressed="true"]');
		if (!(group instanceof HTMLElement) || !(active instanceof HTMLElement)) {
			throw new Error("Chýba aktívny segment");
		}

		const groupStyle = getComputedStyle(group);
		const outerRadius = Number.parseFloat(groupStyle.borderRadius);
		const innerRadius = Number.parseFloat(getComputedStyle(active).borderRadius);
		const padding = Number.parseFloat(groupStyle.paddingTop);

		// Concentric law (docs/interface-quality-rules.md §10): outer = inner + padding.
		// Board .toggle (goal.css:115): radius-md 14 container = radius-sm 10 segment + 4px inset.
		await expect(padding).toBe(4);
		await expect(outerRadius).toBe(14);
		await expect(innerRadius).toBe(10);
		await expect(outerRadius).toBe(innerRadius + padding);
	}
}

const meta = {
	title: "Actions/Segmented control",
	component: ToggleGroup,
	tags: ["autodocs"],
	parameters: { layout: "centered" },
} satisfies Meta<typeof ToggleGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Canonical: Story = {
	render: () => <SegmentedControlSpecimen />,
	play: async ({ canvasElement }) => {
		const group = canvasElement.querySelector('[data-slot="toggle-group"]');
		const active = canvasElement.querySelector(
			'[data-slot="toggle-group-item"][aria-pressed="true"]',
		);
		const icon = canvasElement.querySelector('[data-slot="toggle-group-item"] svg');
		if (
			!(group instanceof HTMLElement) ||
			!(active instanceof HTMLElement) ||
			!(icon instanceof SVGElement)
		) {
			throw new Error("Chýba segmentovaný control");
		}

		const groupStyle = getComputedStyle(group);
		const activeStyle = getComputedStyle(active);
		await expect(group.getBoundingClientRect().height).toBe(38);
		await expect(groupStyle.gap).toBe("2px");
		await expect(groupStyle.padding).toBe("4px");
		await expect(groupStyle.borderRadius).toBe("14px");
		await expect(active.getBoundingClientRect().height).toBe(28);
		await expect(activeStyle.fontSize).toBe("13px");
		await expect(activeStyle.borderRadius).toBe("10px");
		await expect(activeStyle.backgroundColor).toBe("rgb(255, 255, 255)");
		await expect(icon.getBoundingClientRect().width).toBe(13);
		await expectConcentricSegmentedControl(canvasElement);
	},
};

export const Dark: Story = {
	render: () => <SegmentedControlSpecimen />,
	globals: { theme: "dark" },
	play: async ({ canvasElement }) => expectConcentricSegmentedControl(canvasElement),
};

export const CoarsePointer: Story = {
	render: () => <SegmentedControlSpecimen />,
	globals: { pointer: "coarse", viewport: { value: "mobile390", isRotated: false } },
	play: async ({ canvasElement }) => {
		await expectConcentricSegmentedControl(canvasElement);
		// Segmented items are exempt from the coarse touch-tier growth: the drawn kit
		// keeps 28px full-width segments, so they must NOT jump to the 44px floor.
		const item = canvasElement.querySelector('[data-slot="toggle-group-item"]');
		if (!(item instanceof HTMLElement)) throw new Error("Chýba segment");
		await expect(item.getBoundingClientRect().height).toBe(28);
	},
};
