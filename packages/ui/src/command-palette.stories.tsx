import type { Meta, StoryObj } from "@storybook/react-vite";
import {
	BotIcon,
	CircleDotIcon,
	HashIcon,
	InboxIcon,
	ListChecksIcon,
	PlusIcon,
	StoreIcon,
} from "lucide-react";
import { expect, fn, userEvent, within } from "storybook/test";

import { CommandPalette, type CommandPaletteGroup } from "./components/composites/command-palette";

const groups: CommandPaletteGroup[] = [
	{
		id: "recent",
		label: "Nedávne",
		items: [
			{
				id: "needs-you",
				label: "Potrebuje ťa",
				meta: "3 čakajú · Domov",
				icon: InboxIcon,
			},
		],
	},
	{
		id: "jump",
		label: "Prejsť na",
		detail: "„letná predaj“",
		items: [
			{
				id: "goal-summer",
				label: "Letná kampaň 2026",
				meta: "Cieľ · E-shop",
				shortcut: "↵",
				icon: CircleDotIcon,
			},
			{
				id: "task-sale",
				label: "Letný výpredaj — dopredaj zásob",
				meta: "Úloha · E-shop",
				icon: ListChecksIcon,
			},
			{ id: "space-shop", label: "E-shop", meta: "Priestor", icon: StoreIcon },
			{
				id: "channel-summer",
				label: "letná-kampaň",
				meta: "Kanál · 5 neprečítaných",
				icon: HashIcon,
			},
		],
	},
	{
		id: "people",
		label: "Aktéri v kampani",
		items: [
			{
				id: "actor-lucia",
				label: "Lucia",
				meta: "online",
				actor: { id: "actor-lucia", name: "Lucia", kind: "human" },
				presence: "online",
			},
			{
				id: "actor-autopilot",
				label: "Autopilot",
				meta: "online",
				actor: { id: "actor-autopilot", name: "Autopilot", kind: "agent" },
				presence: "online",
			},
		],
	},
	{
		id: "create",
		label: "Vytvoriť",
		items: [
			{
				id: "create-goal",
				label: "Nový cieľ „letná predaj“",
				meta: "Priestor: E-shop",
				shortcut: "⌘↵",
				icon: PlusIcon,
			},
		],
	},
];

const meta = {
	title: "Templates/Shells/CommandPalette",
	component: CommandPalette,
	tags: ["autodocs"],
	parameters: { layout: "fullscreen" },
	args: {
		open: true,
		onOpenChange: fn(),
		query: "letná predaj",
		onQueryChange: fn(),
		mode: "jump",
		onModeChange: fn(),
		scope: { label: "Priestor", value: "E-shop" },
		groups,
		generate: {
			label: "Vygenerovať „Letná kampaň — predaj po dňoch“",
			detail: "Autopilot interpretuje zámer ako dashboard · predaj po dňoch",
			shortcut: "⌘↵",
			actionLabel: "Vygeneruj",
			icon: BotIcon,
			onSelect: fn(),
		},
	},
} satisfies Meta<typeof CommandPalette>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Results: Story = {
	play: async () => {
		const body = within(document.body);
		const dialog = await body.findByRole("dialog", { name: "Príkazová paleta" });
		await expect(dialog).toBeVisible();
		await expect(body.getByRole("combobox", { name: "Hľadať alebo vyvolať" })).toHaveValue(
			"letná predaj",
		);
		await expect(body.getByRole("button", { name: "Prejdi" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		await expect(body.getByLabelText("Rozsah Priestor: E-shop")).toBeVisible();
		await expect(body.getByRole("option", { name: /Letná kampaň 2026/ })).toBeVisible();
		await expect(
			dialog.querySelectorAll('[data-slot="actor-presence"][data-presence="online"]'),
		).toHaveLength(2);
		const generateAction = dialog.querySelector('[data-slot="button"]');
		if (!(generateAction instanceof HTMLButtonElement)) {
			throw new Error("Chýba hlavná akcia generovania");
		}
		await expect(generateAction).toHaveAccessibleName("Vygeneruj");
		await expect(dialog).toHaveAttribute("data-presentation", "dialog");
	},
};

export const KeyboardFiltering: Story = {
	play: async () => {
		const body = within(document.body);
		const search = await body.findByRole("combobox", { name: "Hľadať alebo vyvolať" });
		await userEvent.clear(search);
		await userEvent.type(search, "newsletter");
		await expect(meta.args.onQueryChange).toHaveBeenCalled();
	},
};

export const Mobile390: Story = {
	globals: {
		pointer: "coarse",
		safeArea: "24",
		viewport: { value: "mobile390", isRotated: false },
	},
	play: async () => {
		const body = within(document.body);
		const dialog = await body.findByRole("dialog", { name: "Príkazová paleta" });
		const safeAreaContent = dialog.querySelector(".command-palette__generate");
		if (!(safeAreaContent instanceof HTMLElement)) {
			throw new Error("Chýba bezpečná spodná oblasť príkazovej palety");
		}
		await expect(dialog).toHaveAttribute("data-presentation", "sheet");
		await expect(body.getByRole("combobox", { name: "Hľadať alebo vyvolať" })).toHaveStyle({
			fontSize: "16px",
		});
		await expect(getComputedStyle(safeAreaContent).paddingBottom).toBe("24px");
	},
};

export const BelowOverlayBoundary767: Story = {
	globals: {
		pointer: "coarse",
		viewport: { value: "overlay767", isRotated: false },
	},
	play: async () => {
		const body = within(document.body);
		const dialog = await body.findByRole("dialog", { name: "Príkazová paleta" });
		await expect(dialog).toHaveAttribute("data-presentation", "sheet");
		await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
			document.documentElement.clientWidth,
		);
	},
};

export const AtOverlayBoundary768: Story = {
	globals: { viewport: { value: "overlay768", isRotated: false } },
	play: async () => {
		const body = within(document.body);
		const dialog = await body.findByRole("dialog", { name: "Príkazová paleta" });
		await expect(dialog).toHaveAttribute("data-presentation", "dialog");
		await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
			document.documentElement.clientWidth,
		);
	},
};

export const Loading: Story = {
	args: {
		status: { kind: "loading", message: "Hľadám v cieľoch, úlohách a kanáloch…" },
		groups: [],
	},
	play: async () => {
		const body = within(document.body);
		await expect(await body.findByRole("status")).toHaveTextContent(
			"Hľadám v cieľoch, úlohách a kanáloch…",
		);
	},
};

export const SearchError: Story = {
	args: {
		status: { kind: "error", message: "Index je dočasne nedostupný. Skúste to znova." },
		groups: [],
	},
};

export const NoResults: Story = {
	args: {
		status: { kind: "empty", message: "Nenašla sa presná zhoda." },
		groups: [],
	},
};

export const LongSlovakCopy390: Story = {
	globals: {
		pointer: "coarse",
		safeArea: "24",
		viewport: { value: "mobile390", isRotated: false },
	},
	args: {
		query: "kompletná letná marketingová kampaň pre slovenský a český trh",
		groups: [
			{
				id: "long-copy",
				label: "Najpravdepodobnejšie výsledky v aktuálnom priestore",
				items: [
					{
						id: "long-task",
						label:
							"Pripraviť kompletnú letnú marketingovú kampaň vrátane newslettera, sociálnych sietí a vyhodnotenia výsledkov",
						meta: "Úloha · E-shop · čaká na schválenie Marekom H.",
						icon: ListChecksIcon,
					},
				],
			},
		],
		generate: {
			label:
				"Vygenerovať nový cieľ s úlohami, vlastníkmi, termínmi a merateľnými kritériami úspechu",
			detail:
				"Autopilot najprv pripraví návrh a až potom požiada operátora o potvrdenie vytvorenia.",
			actionLabel: "Pripraviť návrh",
			onSelect: fn(),
		},
	},
	play: async () => {
		const body = within(document.body);
		await expect(await body.findByRole("dialog", { name: "Príkazová paleta" })).toHaveAttribute(
			"data-presentation",
			"sheet",
		);
		await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
			document.documentElement.clientWidth,
		);
	},
};

export const ReducedMotion: Story = {
	globals: { motion: "reduce" },
	play: async () => {
		await expect(document.documentElement.dataset.reducedMotion).toBe("reduce");
		const dialog = await within(document.body).findByRole("dialog", { name: "Príkazová paleta" });
		await expect(
			Number.parseFloat(getComputedStyle(dialog).transitionDuration),
		).toBeLessThanOrEqual(0.001);
	},
};

export const Dark: Story = {
	globals: { theme: "dark" },
};
