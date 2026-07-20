import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { Status } from "./components/composites";
import { Badge } from "./components/ui";

const states = [
	{ state: "running", label: "Pracuje", elapsed: "12 min" },
	{ state: "attention", label: "Čaká na teba" },
	{ state: "done", label: "Hotovo" },
	{ state: "idle", label: "Pripravený" },
	{ state: "blocked", label: "Blokovaný" },
	{ state: "failed", label: "Nepodarilo sa" },
] as const;

function StatusMatrix() {
	return (
		<div className="ui-story-stack">
			<div className="ui-story-grid">
				<Badge>3</Badge>
				<Badge variant="secondary">Koncept</Badge>
				<Badge variant="outline">Projekt: E-shop</Badge>
				<Badge variant="destructive">Vyžaduje zásah</Badge>
			</div>
			<div className="ui-story-grid">
				{states.map((item) => (
					<Status key={item.state} {...item} />
				))}
			</div>
		</div>
	);
}

const meta = {
	title: "Identity & status/Badge and Status",
	component: Status,
	tags: ["autodocs"],
	parameters: { layout: "centered" },
	args: { state: "idle", label: "Pripravený" },
} satisfies Meta<typeof Status>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LifecycleStates: Story = {
	render: () => <StatusMatrix />,
	play: async ({ canvasElement }) => {
		const badges = canvasElement.querySelectorAll('[data-slot="badge"]');
		for (const badge of badges) {
			await expect(badge.getBoundingClientRect().height).toBeGreaterThanOrEqual(20);
		}
	},
};

export const RunningWithMetadata: Story = {
	args: { state: "running", label: "Autopilot pracuje", elapsed: "2 min", meta: "3 kroky" },
};

export const LongSlovakCopy: Story = {
	args: {
		state: "attention",
		label: "Čaká na potvrdenie publikovania cenových zmien",
	},
	globals: { viewport: { value: "mobile390", isRotated: false } },
};

export const Dark: Story = {
	render: () => <StatusMatrix />,
	globals: { theme: "dark" },
};
