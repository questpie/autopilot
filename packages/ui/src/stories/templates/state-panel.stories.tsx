import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn } from "storybook/test";

import { StatePanel, type UniversalState } from "../../components/templates";
import { Button } from "../../components/ui";

const copy: Record<UniversalState, { title: string; description: string; actionLabel?: string }> = {
	empty: {
		title: "Zatiaľ žiadne úlohy",
		description: "Vytvorte prvú úlohu alebo ju nechajte navrhnúť Autopilotom.",
		actionLabel: "Navrhnúť s Autopilotom",
	},
	"no-results": {
		title: "Nenašli sme žiadne úlohy",
		description: "Skúste upraviť hľadanie alebo zrušiť aktívne filtre.",
		actionLabel: "Vymazať filter",
	},
	error: {
		title: "Úlohy sa nepodarilo načítať",
		description: "Pripojenie zlyhalo. Skúste to znova o chvíľu.",
		actionLabel: "Skúsiť znova",
	},
	access: {
		title: "Nemáte prístup",
		description: "Požiadajte vlastníka priestoru o oprávnenie na zobrazenie úloh.",
	},
};

function Panel({ state }: { state: UniversalState }) {
	const { title, description, actionLabel } = copy[state];
	const primary = state === "empty";
	return (
		<StatePanel
			state={state}
			title={title}
			description={description}
			action={
				actionLabel ? (
					<Button size="sm" variant={primary ? "default" : "secondary"} onClick={fn()}>
						{actionLabel}
					</Button>
				) : undefined
			}
		/>
	);
}

const meta = {
	title: "Templates/State panel",
	component: Panel,
	parameters: { layout: "centered" },
	args: { state: "empty" },
	argTypes: {
		state: { control: "inline-radio", options: ["empty", "no-results", "error", "access"] },
	},
} satisfies Meta<typeof Panel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyState: Story = { args: { state: "empty" } };
export const NoResults: Story = { args: { state: "no-results" } };
export const LoadError: Story = { args: { state: "error" } };
export const AccessDenied: Story = { args: { state: "access" } };

const stateContract = [
	["empty", "icon", "lucide-inbox"],
	["no-results", "icon", "lucide-search"],
	["error", "icon-attention", "lucide-circle-alert"],
	["access", "icon-attention", "lucide-lock"],
] as const;

export const Matrix: Story = {
	render: () => (
		<div className="ui-story-run-column">
			{stateContract.map(([state]) => (
				<Panel key={state} state={state} />
			))}
		</div>
	),
	play: async ({ canvasElement }) => {
		// Every universal state carries the designed medallion anatomy (44px / radius-lg /
		// 20px glyph) with a DISTINCT icon — never the same generic glyph, never naked.
		for (const [state, variant, iconClass] of stateContract) {
			const panel = canvasElement.querySelector<HTMLElement>(`[data-state="${state}"]`);
			if (!panel) throw new Error(`Chýba stav ${state}`);
			const medallion = panel.querySelector<HTMLElement>('[data-slot="empty-icon"]');
			await expect(medallion).toHaveAttribute("data-variant", variant);
			await expect(medallion!.getBoundingClientRect().width).toBe(44);
			await expect(getComputedStyle(medallion!).borderTopLeftRadius).toBe("18px");
			const icon = medallion!.querySelector("svg");
			await expect(icon?.getBoundingClientRect().width).toBe(20);
			await expect(icon?.getAttribute("class")).toContain(iconClass);
		}
		// error/access read gold (board .errorstate __ic), empty/no-results read neutral.
		for (const state of ["error", "access"] as const) {
			const medallion = canvasElement.querySelector(
				`[data-state="${state}"] [data-slot="empty-icon"]`,
			);
			await expect(getComputedStyle(medallion!).backgroundColor).toBe("rgb(255, 248, 232)");
		}
		const neutral = canvasElement.querySelector('[data-state="empty"] [data-slot="empty-icon"]');
		await expect(getComputedStyle(neutral!).backgroundColor).toBe("rgb(242, 238, 231)");
		// Title/hint hierarchy (board .empty__title 18/600, .empty__hint 15).
		const title = canvasElement.querySelector('[data-state="empty"] [data-slot="empty-title"]');
		const hint = canvasElement.querySelector(
			'[data-state="empty"] [data-slot="empty-description"]',
		);
		await expect(getComputedStyle(title!).fontSize).toBe("18px");
		await expect(getComputedStyle(title!).fontWeight).toBe("600");
		await expect(getComputedStyle(hint!).fontSize).toBe("15px");
	},
};

export const Dark: Story = {
	globals: { theme: "dark" },
	render: () => (
		<div className="ui-story-run-column">
			{stateContract.map(([state]) => (
				<Panel key={state} state={state} />
			))}
		</div>
	),
};

export const Mobile: Story = {
	args: { state: "empty" },
	globals: { viewport: { value: "mobile390", isRotated: false } },
};
