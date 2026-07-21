import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import {
	AdaptiveConfirm,
	AdaptiveMenu,
	AdaptiveModal,
	AdaptivePopover,
	AdaptiveTooltip,
} from "../../components/composites";
import { Button, Field, FieldLabel, Input } from "../../components/ui";

function OverlayGallery() {
	return (
		<main className="ui-story-grid">
			<h1 className="sr-only">Adaptívne overlaye</h1>
			<AdaptiveMenu
				label="Akcie úlohy"
				trigger={<Button variant="outline">Otvoriť menu</Button>}
				items={[
					{ id: "edit", label: "Upraviť" },
					{ id: "duplicate", label: "Duplikovať", tone: "accent" },
					{ id: "archive", label: "Archivovať", tone: "danger" },
				]}
			/>
			<AdaptivePopover
				trigger={<Button variant="outline">Kontext</Button>}
				title="O cieli"
				description="Doplňujúce informácie"
			>
				<p>Pokrok sa odvodzuje z kritérií, nie z počtu hotových úloh.</p>
			</AdaptivePopover>
			<AdaptiveTooltip trigger={<Button variant="ghost">Prečo?</Button>} title="Vysvetlenie">
				Agent potrebuje vlastné oprávnenie.
			</AdaptiveTooltip>
			<AdaptiveModal
				trigger={<Button variant="outline">Otvoriť modal</Button>}
				title="Pozvať aktérov"
				description="Pozvánku môžete neskôr zrušiť."
				footer={<Button>Odoslať pozvánku</Button>}
			>
				<Field>
					<FieldLabel htmlFor="invite-email">E-mail</FieldLabel>
					<Input id="invite-email" type="email" />
				</Field>
			</AdaptiveModal>
			<AdaptiveConfirm
				trigger={<Button variant="destructive">Archivovať</Button>}
				title="Archivovať priestor?"
				description="Aktívne behy sa nezrušia automaticky."
				confirmLabel="Archivovať priestor"
				onConfirm={fn()}
				destructive
			/>
		</main>
	);
}

const meta = {
	title: "Composites/Adaptive overlays",
	component: AdaptiveMenu,
	tags: ["autodocs"],
	parameters: { layout: "centered" },
	args: {
		label: "Akcie úlohy",
		trigger: <Button variant="outline">Otvoriť menu</Button>,
		items: [{ id: "edit", label: "Upraviť" }],
	},
} satisfies Meta<typeof AdaptiveMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop768: Story = {
	render: () => <OverlayGallery />,
	globals: { viewport: { value: "overlay768", isRotated: false } },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const trigger = canvas.getByRole("button", { name: "Otvoriť menu" });
		await userEvent.click(trigger);
		await waitFor(() => expect(within(document.body).getByRole("menu")).toBeVisible());
		await userEvent.keyboard("{Escape}");
		await waitFor(() => expect(trigger).toHaveFocus());
	},
};

export const Mobile767: Story = {
	render: () => <OverlayGallery />,
	globals: {
		pointer: "coarse",
		safeArea: "24",
		viewport: { value: "overlay767", isRotated: false },
	},
	play: async ({ canvasElement }) => {
		const trigger = within(canvasElement).getByRole("button", { name: "Otvoriť menu" });
		await expect(trigger.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
		// Regression guard: EVERY default-size overlay trigger must share the coarse
		// touch height. Base UI rewrites a trigger's data-slot ("button" -> *-trigger),
		// which used to drop the coarse height bump for all but the adaptive-menu
		// trigger (44px), leaving modal/confirm/context triggers at 32px.
		const triggerHeights = ["Otvoriť menu", "Kontext", "Prečo?", "Otvoriť modal", "Archivovať"].map(
			(name) => within(canvasElement).getByRole("button", { name }).getBoundingClientRect().height,
		);
		for (const h of triggerHeights) await expect(h).toBeGreaterThanOrEqual(44);
		await expect(new Set(triggerHeights).size).toBe(1);
		await userEvent.click(trigger);
		const drawer = within(document.body).getByRole("dialog");
		await waitFor(() => expect(drawer).toBeVisible());
		const items = within(drawer).getByRole("menu", { name: "Akcie úlohy" });
		await expect(Number.parseFloat(getComputedStyle(items).paddingBottom)).toBeGreaterThanOrEqual(
			32,
		);
		await userEvent.keyboard("{Escape}");
		await waitFor(() => expect(trigger).toHaveFocus());
	},
};

export const Mobile390: Story = {
	render: () => <OverlayGallery />,
	globals: {
		pointer: "coarse",
		safeArea: "24",
		viewport: { value: "mobile390", isRotated: false },
	},
	play: async ({ canvasElement }) => {
		const trigger = within(canvasElement).getByRole("button", { name: "Otvoriť menu" });
		await expect(trigger.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
		// Regression guard: EVERY default-size overlay trigger must share the coarse
		// touch height. Base UI rewrites a trigger's data-slot ("button" -> *-trigger),
		// which used to drop the coarse height bump for all but the adaptive-menu
		// trigger (44px), leaving modal/confirm/context triggers at 32px.
		const triggerHeights = ["Otvoriť menu", "Kontext", "Prečo?", "Otvoriť modal", "Archivovať"].map(
			(name) => within(canvasElement).getByRole("button", { name }).getBoundingClientRect().height,
		);
		for (const h of triggerHeights) await expect(h).toBeGreaterThanOrEqual(44);
		await expect(new Set(triggerHeights).size).toBe(1);
		await userEvent.click(trigger);
		const drawer = within(document.body).getByRole("dialog");
		await waitFor(() => expect(drawer).toBeVisible());
		const items = within(drawer).getByRole("menu", { name: "Akcie úlohy" });
		await expect(Number.parseFloat(getComputedStyle(items).paddingBottom)).toBeGreaterThanOrEqual(
			32,
		);
		await userEvent.keyboard("{Escape}");
		await waitFor(() => expect(trigger).toHaveFocus());
	},
};

export const Dark: Story = {
	render: () => <OverlayGallery />,
	globals: { theme: "dark" },
	play: async ({ canvasElement }) => {
		await expect(canvasElement.ownerDocument.documentElement).toHaveAttribute("data-theme", "dark");
	},
};

export const ReducedMotion: Story = {
	render: () => <OverlayGallery />,
	globals: { motion: "reduce" },
	play: async ({ canvasElement }) => {
		const trigger = within(canvasElement).getByRole("button", { name: "Otvoriť menu" });
		await expect(
			Number.parseFloat(getComputedStyle(trigger).transitionDuration),
		).toBeLessThanOrEqual(0.001);
	},
};
