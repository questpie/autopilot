import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { catalogManifest } from "../../catalog";
import { Status, Surface } from "../../components/composites";
import { Badge, Button } from "../../components/ui";

const colorTokens = [
	"canvas",
	"canvas-subtle",
	"surface",
	"surface-muted",
	"surface-raised",
	"surface-selected",
	"ink",
	"ink-muted",
	"hairline",
	"border",
	"border-strong",
	"action",
	"action-tint",
	"agent",
	"agent-tint",
	"attention-surface",
	"success-surface",
	"danger-surface",
	"info-surface",
];

function FoundationsGallery() {
	return (
		<main className="ui-story-page">
			<header className="ui-story-heading">
				<Badge variant="secondary">Foundations</Badge>
				<h1>Canonical operator wireframe</h1>
				<p>
					Warm paper, ruled work surfaces, compact Geist typography, and one coral advancing action
					reproduce the visual grammar of the original Hrebeň board.
				</p>
			</header>
			<section className="ui-story-section">
				<h2>Color roles</h2>
				<div className="ui-token-grid">
					{colorTokens.map((token) => (
						<div className="ui-token" data-token={token} key={token}>
							<span />
							<code>--{token}</code>
						</div>
					))}
				</div>
			</section>
			<section className="ui-story-section">
				<h2>Type and hierarchy</h2>
				<div className="ui-type-specimen">
					<p className="ui-type-display">Spoločná práca, viditeľný výsledok.</p>
					<p className="ui-type-title">Cieľ: pripraviť letnú ponuku Hrebeňa</p>
					<p>Autopilot pracuje ako plnohodnotný člen tímu, s vlastnými právami a zručnosťami.</p>
					<small className="ui-mono">Aktualizované pred 2 minútami · 0123456789</small>
				</div>
			</section>
			<section className="ui-story-section">
				<h2>Action and state grammar</h2>
				<Surface className="ui-story-row" level="flat">
					<Button>Vytvoriť cieľ</Button>
					<Button variant="secondary">Uložiť koncept</Button>
					<Status state="running" label="Pracuje" elapsed="2 min" />
				</Surface>
			</section>
			<section className="ui-story-section">
				<h2>Catalog manifest</h2>
				<div className="ui-catalog-list">
					{catalogManifest.map((entry) => (
						<div key={entry.id}>
							<Badge variant="outline">{entry.group}</Badge>
							<strong>{entry.label}</strong>
							<span>{entry.mechanism}</span>
						</div>
					))}
				</div>
			</section>
		</main>
	);
}

const meta = {
	title: "Foundations/Design contract",
	component: FoundationsGallery,
	parameters: { layout: "fullscreen" },
} satisfies Meta<typeof FoundationsGallery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {
	play: async ({ canvasElement }) => {
		const display = canvasElement.querySelector(".ui-type-display");
		const title = canvasElement.querySelector(".ui-type-title");
		if (!(display instanceof HTMLElement) || !(title instanceof HTMLElement)) {
			throw new Error("Chýbajú typografické vzorky");
		}

		await expect(getComputedStyle(display).fontSize).toBe("28px");
		await expect(getComputedStyle(display).fontWeight).toBe("700");
		await expect(getComputedStyle(title).fontSize).toBe("15px");
		await expect(getComputedStyle(title).fontWeight).toBe("600");
	},
};
export const Dark: Story = { globals: { theme: "dark" } };
export const ReducedMotion: Story = {
	globals: { motion: "reduce" },
	play: async ({ canvasElement }) => {
		const button = canvasElement.querySelector('[data-slot="button"]');
		if (!(button instanceof HTMLElement)) throw new Error("Chýba meraný button");
		await expect(getComputedStyle(button).transitionDuration).toBe("0.001s");
	},
};
export const CoarsePointer: Story = {
	globals: {
		pointer: "coarse",
		viewport: { value: "mobile390", isRotated: false },
	},
	play: async ({ canvasElement }) => {
		const button = canvasElement.querySelector('[data-slot="button"]');
		if (!(button instanceof HTMLElement)) throw new Error("Chýba meraný button");
		await expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
	},
};
