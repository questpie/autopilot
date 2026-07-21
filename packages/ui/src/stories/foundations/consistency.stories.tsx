import type { Meta, StoryObj } from "@storybook/react-vite";
import { SearchIcon } from "lucide-react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { AdaptiveMenu, Status } from "../../components/composites";
import {
	Badge,
	Button,
	Input,
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../../components/ui";

const selectItems = [
	{ label: "E-shop", value: "eshop" },
	{ label: "Financie", value: "finance" },
];

function ControlMatrix() {
	return (
		<div className="ui-story-page">
			<div className="ui-story-heading">
				<span className="ui-eyebrow">Shared geometry gate</span>
				<h1>Jedna rodina ovládacích prvkov</h1>
				<p>Výška, radius, typografia, focus a pohyb sa merajú spolu, nie po komponentoch.</p>
			</div>
			<div className="ui-consistency-grid">
				<div>
					<span>Button</span>
					<Button data-consistency="button">Vytvoriť</Button>
				</div>
				<div>
					<span>Input</span>
					<Input data-consistency="input" aria-label="Názov úlohy" placeholder="Názov úlohy" />
				</div>
				<div>
					<span>Search</span>
					<InputGroup data-consistency="search">
						<InputGroupInput aria-label="Hľadať" placeholder="Hľadať…" />
						<InputGroupAddon align="inline-start">
							<SearchIcon aria-hidden />
						</InputGroupAddon>
					</InputGroup>
				</div>
				<div>
					<span>Select</span>
					<Select items={selectItems} defaultValue="eshop">
						<SelectTrigger data-consistency="select" aria-label="Priestor">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectGroup>
								{selectItems.map((item) => (
									<SelectItem key={item.value} value={item.value}>
										{item.label}
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>
				</div>
				<div>
					<span>Compact action</span>
					<Button data-consistency="compact" variant="secondary" size="sm">
						Filter
					</Button>
				</div>
				<div>
					<span>Large action</span>
					<Button data-consistency="large" size="lg">
						Pokračovať
					</Button>
				</div>
				<div>
					<span>Badge</span>
					<Badge data-consistency="badge">12</Badge>
				</div>
				<div>
					<span>Status</span>
					<Status data-consistency="status" state="running" label="Beží" />
				</div>
				<div>
					<span>Icon action</span>
					<Button data-consistency="icon" size="icon" variant="secondary" aria-label="Hľadať">
						<SearchIcon />
					</Button>
				</div>
				<div>
					<span>Menu row</span>
					<AdaptiveMenu
						label="Akcie úlohy"
						trigger={
							<Button data-consistency="menu-trigger" variant="secondary">
								Akcie
							</Button>
						}
						items={[{ id: "assign", label: "Priradiť aktéra" }]}
					/>
				</div>
			</div>
		</div>
	);
}

const meta = {
	title: "Foundations/Gates/Control matrix",
	component: ControlMatrix,
	parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ControlMatrix>;

export default meta;
type Story = StoryObj<typeof meta>;

function getControl(canvasElement: HTMLElement, name: string) {
	const control = canvasElement.querySelector(`[data-consistency="${name}"]`);
	if (!(control instanceof HTMLElement)) throw new Error(`Chýba control ${name}`);
	return control;
}

export const Desktop: Story = {
	play: async ({ canvasElement }) => {
		// Fields keep radius-sm (10px); the button carries the ratified .btn radius-md (14px, asserted below).
		for (const name of ["input", "search", "select"] as const) {
			const control = getControl(canvasElement, name);
			const style = getComputedStyle(control);
			await expect(control.getBoundingClientRect().height).toBe(32);
			await expect(style.borderRadius).toBe("10px");
			await expect(style.transitionProperty).not.toContain("all");
		}

		await expect(getControl(canvasElement, "compact").getBoundingClientRect().height).toBe(28);
		// Secondary is the borderless soft-fill tier — the reserved coral `outline` must not leak in.
		await expect(getComputedStyle(getControl(canvasElement, "compact")).borderTopColor).toBe(
			"rgba(0, 0, 0, 0)",
		);
		await expect(getControl(canvasElement, "large").getBoundingClientRect().height).toBe(36);
		await expect(getControl(canvasElement, "badge").getBoundingClientRect().height).toBe(20);
		await expect(getControl(canvasElement, "status").getBoundingClientRect().height).toBe(22);

		const button = getControl(canvasElement, "button");
		const buttonStyle = getComputedStyle(button);
		await expect(button.getBoundingClientRect().height).toBe(32);
		await expect(buttonStyle.borderRadius).toBe("14px");
		await expect(buttonStyle.transitionProperty).not.toContain("all");
		const before = button.getBoundingClientRect();
		button.focus();
		const after = button.getBoundingClientRect();
		await expect([after.width, after.height]).toEqual([before.width, before.height]);

		await waitFor(() =>
			expect(getControl(canvasElement, "menu-trigger")).toHaveAttribute(
				"data-slot",
				"dropdown-menu-trigger",
			),
		);
		const menuTrigger = getControl(canvasElement, "menu-trigger");
		await userEvent.click(menuTrigger);
		const menuItem = await within(document.body).findByRole("menuitem", {
			name: "Priradiť aktéra",
		});
		await waitFor(() => expect(Math.round(menuItem.getBoundingClientRect().height)).toBe(40));
		await expect(getComputedStyle(menuItem).borderRadius).toBe("10px");
		await userEvent.keyboard("{Escape}");
		await waitFor(() => expect(menuTrigger).toHaveFocus());
	},
};

export const CoarsePointer: Story = {
	globals: { pointer: "coarse", viewport: { value: "mobile390", isRotated: false } },
	play: async ({ canvasElement }) => {
		// Middle tier: 32px desktop controls grow to the 44px comfortable target.
		for (const name of ["button", "input", "search", "select", "icon", "menu-trigger"] as const) {
			await expect(
				getControl(canvasElement, name).getBoundingClientRect().height,
			).toBeGreaterThanOrEqual(44);
		}
		// The coarse floor is a three-tier scale (JUBLI-ADAPTIVE 36/44/52), not a flat
		// 44px: small controls settle at 36, the middle tier lands on 44, large climbs to 52.
		await expect(
			Math.round(getControl(canvasElement, "compact").getBoundingClientRect().height),
		).toBe(36);
		await expect(
			Math.round(getControl(canvasElement, "button").getBoundingClientRect().height),
		).toBe(44);
		await expect(
			Math.round(getControl(canvasElement, "large").getBoundingClientRect().height),
		).toBe(52);
		const icon = getControl(canvasElement, "icon");
		await expect(icon.getBoundingClientRect().width).toBeGreaterThanOrEqual(44);
		await expect(icon.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
		const menuTrigger = getControl(canvasElement, "menu-trigger");
		await expect(menuTrigger.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
		await userEvent.click(menuTrigger);
		const mobileRow = within(document.body).getByRole("menuitem", { name: "Priradiť aktéra" });
		await waitFor(() => expect(mobileRow).toBeVisible());
		await expect(mobileRow.getBoundingClientRect().height).toBe(48);
		await expect(getComputedStyle(mobileRow).borderRadius).toBe("10px");
	},
};

export const Dark: Story = {
	globals: { theme: "dark" },
};
