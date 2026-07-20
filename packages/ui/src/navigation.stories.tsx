import type { Meta, StoryObj } from "@storybook/react-vite";
import { GoalIcon, LayoutListIcon } from "lucide-react";
import { expect, userEvent, within } from "storybook/test";

import { Badge, Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui";

function SpaceFacets() {
	return (
		<Tabs defaultValue="tasks">
			<TabsList variant="line">
				<TabsTrigger value="overview">Prehľad</TabsTrigger>
				<TabsTrigger value="tasks">
					Úlohy <Badge>12</Badge>
				</TabsTrigger>
				<TabsTrigger value="goals">Ciele</TabsTrigger>
				<TabsTrigger value="channel">Kanál</TabsTrigger>
				<TabsTrigger value="knowledge">Znalosti</TabsTrigger>
				<TabsTrigger value="dashboards">Dashboardy</TabsTrigger>
			</TabsList>
			<TabsContent value="overview">Prehľad priestoru</TabsContent>
			<TabsContent value="tasks">Zoznam úloh</TabsContent>
			<TabsContent value="goals">Aktívne ciele</TabsContent>
		</Tabs>
	);
}

const meta = {
	title: "Navigation/Tabs",
	component: Tabs,
	tags: ["autodocs"],
	parameters: { layout: "centered" },
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SpaceFacetLine: Story = {
	render: () => <SpaceFacets />,
};

export const LocalFilled: Story = {
	render: () => (
		<Tabs defaultValue="list">
			<TabsList>
				<TabsTrigger value="list">
					<LayoutListIcon data-icon="inline-start" /> Zoznam
				</TabsTrigger>
				<TabsTrigger value="goals">
					<GoalIcon data-icon="inline-start" /> Ciele
				</TabsTrigger>
			</TabsList>
		</Tabs>
	),
	play: async ({ canvasElement }) => {
		// Filled Tabs consume the ONE segmented-switcher anatomy (board .toggle,
		// goal.css:114-120) — identical geometry to segmented-control.stories.
		const list = canvasElement.querySelector('[data-slot="tabs-list"][data-variant="default"]');
		const active = canvasElement.querySelector('[role="tab"][aria-selected="true"]');
		const icon = canvasElement.querySelector('[data-slot="tabs-trigger"] svg');
		if (
			!(list instanceof HTMLElement) ||
			!(active instanceof HTMLElement) ||
			!(icon instanceof SVGElement)
		) {
			throw new Error("Chýba filled tab switcher");
		}
		const listStyle = getComputedStyle(list);
		const activeStyle = getComputedStyle(active);
		await expect(listStyle.borderRadius).toBe("14px");
		await expect(listStyle.padding).toBe("4px");
		await expect(active.getBoundingClientRect().height).toBe(28);
		await expect(activeStyle.borderRadius).toBe("10px");
		await expect(activeStyle.fontSize).toBe("13px");
		await expect(activeStyle.backgroundColor).toBe("rgb(255, 255, 255)");
		await expect(icon.getBoundingClientRect().width).toBe(13);
	},
};

export const Keyboard: Story = {
	render: () => <SpaceFacets />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const first = canvas.getByRole("tab", { name: "Prehľad" });
		first.focus();
		await userEvent.keyboard("{ArrowRight}");
		await expect(canvas.getByRole("tab", { name: /Úlohy/ })).toHaveFocus();
	},
};

export const NarrowOverflow: Story = {
	render: () => <SpaceFacets />,
	globals: { viewport: { value: "mobile390", isRotated: false } },
};

export const Dark: Story = {
	render: () => <SpaceFacets />,
	globals: { theme: "dark" },
};
