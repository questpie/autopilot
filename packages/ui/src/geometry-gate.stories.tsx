import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn } from "storybook/test";

import { RunCard, RunPermissionList } from "./components/ai";
import { StatePanel } from "./components/templates";
import { ToggleGroup, ToggleGroupItem } from "./components/ui";

// The board's icon scale (interface-quality-rules §6): every product glyph snaps to
// one of these px values. 24 is the mobile-nav size AND Lucide's raw default — the
// desktop specimens below must never render a 24px glyph (that is the "bare icon" leak).
const ICON_SCALE = [12, 14, 15, 16, 18, 20, 24] as const;

const autopilot = { id: "autopilot", name: "Autopilot", kind: "agent" as const };
const pendingPermission = {
	id: "permission-publish",
	capability: "Publikovať newsletter",
	scope: "E-shop · draft newsletter-01",
	consequence: "Obsah sa odošle 4 281 odberateľom.",
	requestedBy: autopilot,
	decision: "pending" as const,
	canDecide: false,
};
const liveState = {
	kind: "live",
	phase: "working",
	phaseLabel: "Pracuje",
	currentAction: "Pripravuje návrh newslettera",
} as const;
const run = {
	id: "run-01",
	actor: autopilot,
	elapsed: "2 min",
	activity: "Zhrnul 4 kroky · naposledy pripravil návrh newslettera",
	hiddenActivityCount: 5,
	state: liveState,
};

function GeometrySpecimen() {
	return (
		<div className="ui-story-run-column" data-geometry-root>
			<StatePanel
				state="empty"
				title="Zatiaľ žiadne úlohy"
				description="Vytvorte prvú úlohu alebo ju nechajte navrhnúť Autopilotom."
			/>
			<StatePanel
				state="error"
				title="Úlohy sa nepodarilo načítať"
				description="Pripojenie zlyhalo. Skúste to znova o chvíľu."
			/>
			<RunCard run={run} onOpenDetail={fn()} />
			<RunPermissionList permissions={[pendingPermission]} onDecision={fn()} />
			<ToggleGroup aria-label="Zobrazenie" value={["list"]}>
				<ToggleGroupItem value="list">Zoznam</ToggleGroupItem>
				<ToggleGroupItem value="board">Tabuľa</ToggleGroupItem>
			</ToggleGroup>
		</div>
	);
}

function radiusOf(el: Element) {
	return Number.parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
}

// Generic nested-radius walker (docs §3/§10): for every rounded child sitting flush in
// the corner of a rounded, NON-clipping parent, the concentric law outer = inner +
// padding must hold within 1.5px (the ~1px border is absorbed). A clipping parent
// (overflow: hidden) can never expose a shared corner, so it is skipped.
function auditConcentricRadii(root: HTMLElement) {
	const violations: string[] = [];
	let pairs = 0;
	for (const child of root.querySelectorAll<HTMLElement>("*")) {
		const parent = child.parentElement;
		if (!parent || !root.contains(parent)) continue;
		const parentStyle = getComputedStyle(parent);
		const outer = radiusOf(parent);
		const inner = radiusOf(child);
		if (outer <= 0 || inner <= 0) continue;
		if (parentStyle.overflowX !== "visible" || parentStyle.overflowY !== "visible") continue;
		const padTop = Number.parseFloat(parentStyle.paddingTop);
		const borderTop = Number.parseFloat(parentStyle.borderTopWidth);
		const padLeft = Number.parseFloat(parentStyle.paddingLeft);
		const borderLeft = Number.parseFloat(parentStyle.borderLeftWidth);
		const pRect = parent.getBoundingClientRect();
		const cRect = child.getBoundingClientRect();
		// The concentric law governs rounded RECTANGLES (cards/controls), not pills or
		// circles whose radius is simply "as round as possible" — skip either shape.
		const isPill = (r: number, rect: DOMRect) => r >= Math.min(rect.width, rect.height) / 2 - 0.5;
		if (isPill(outer, pRect) || isPill(inner, cRect)) continue;
		const flush =
			cRect.top - pRect.top <= padTop + borderTop + 1.5 &&
			cRect.left - pRect.left <= padLeft + borderLeft + 1.5;
		if (!flush || padTop > 24) continue;
		pairs += 1;
		if (Math.abs(outer - (inner + padTop)) > 1.5) {
			violations.push(`outer ${outer} ≠ inner ${inner} + pad ${padTop}`);
		}
	}
	return { pairs, violations };
}

// Icon-box audit (docs §10): no product glyph may fall off the scale. In these desktop
// specimens that means every Lucide icon is on-scale AND none renders at the raw 24px.
function auditIconScale(root: HTMLElement) {
	const offScale: string[] = [];
	const raw24: string[] = [];
	const icons = root.querySelectorAll<SVGElement>("svg.lucide");
	for (const icon of icons) {
		const width = icon.getBoundingClientRect().width;
		if (!ICON_SCALE.some((size) => Math.abs(width - size) <= 0.6)) {
			offScale.push(`${icon.getAttribute("class")}=${width.toFixed(2)}`);
		}
		if (Math.abs(width - 24) <= 0.6) raw24.push(icon.getAttribute("class") ?? "?");
	}
	return { count: icons.length, offScale, raw24 };
}

const meta = {
	title: "Consistency/Geometry gate",
	component: GeometrySpecimen,
	parameters: { layout: "padded" },
} satisfies Meta<typeof GeometrySpecimen>;

export default meta;
type Story = StoryObj<typeof meta>;

function geometryRoot(canvasElement: HTMLElement) {
	const root = canvasElement.querySelector<HTMLElement>("[data-geometry-root]");
	if (!root) throw new Error("Chýba geometry root");
	return root;
}

// Theme-independent structural gate: concentric nested radii, on-scale icon boxes, and
// the containment geometry of the primitives fixed in classes 8–11.
async function auditStructure(root: HTMLElement) {
	const concentric = auditConcentricRadii(root);
	await expect(concentric.violations).toEqual([]);
	await expect(concentric.pairs).toBeGreaterThan(0);

	const icons = auditIconScale(root);
	await expect(icons.count).toBeGreaterThan(0);
	await expect(icons.offScale).toEqual([]);
	await expect(icons.raw24).toEqual([]);

	// Empty medallion (board .empty__ic): 44px square, radius-lg 18px, 20px glyph.
	const medallion = root.querySelector<HTMLElement>(
		'[data-slot="empty-icon"][data-variant="icon"]',
	);
	if (!medallion) throw new Error("Chýba empty medailón");
	await expect(medallion.getBoundingClientRect().width).toBe(44);
	await expect(medallion.getBoundingClientRect().height).toBe(44);
	await expect(getComputedStyle(medallion).borderTopLeftRadius).toBe("18px");
	const medallionIcon = medallion.querySelector("svg");
	await expect(medallionIcon?.getBoundingClientRect().width).toBe(20);

	// Empty title/hint hierarchy (board .empty__title 18/600, .empty__hint 15).
	const title = root.querySelector<HTMLElement>('[data-slot="empty-title"]');
	const hint = root.querySelector<HTMLElement>('[data-slot="empty-description"]');
	await expect(getComputedStyle(title!).fontSize).toBe("18px");
	await expect(getComputedStyle(title!).fontWeight).toBe("600");
	await expect(getComputedStyle(hint!).fontSize).toBe("15px");

	// Run card is a bounded object: radius-md 14, overflow-hidden, activity glyph 15px.
	const runCard = root.querySelector<HTMLElement>('[data-part="run-summary"]');
	await expect(getComputedStyle(runCard!).borderTopLeftRadius).toBe("14px");
	await expect(getComputedStyle(runCard!).overflow).toBe("hidden");
	const activityIcon = runCard!.querySelector('[data-slot="work-block-content"] svg');
	await expect(activityIcon?.getBoundingClientRect().width).toBe(15);

	// Permission gate is a bounded caution card: radius-md 14, overflow-hidden, 14px shield.
	const gate = root.querySelector<HTMLElement>('[data-part="run-permission"]');
	await expect(getComputedStyle(gate!).borderTopLeftRadius).toBe("14px");
	await expect(getComputedStyle(gate!).overflow).toBe("hidden");
	const shield = gate!.querySelector('[data-slot="work-block-header"] svg');
	await expect(shield?.getBoundingClientRect().width).toBe(14);
	await expect(gate).toHaveTextContent("nemôže schváliť vlastnú žiadosť");
}

export const Desktop: Story = {
	play: async ({ canvasElement }) => {
		const root = geometryRoot(canvasElement);
		await auditStructure(root);

		// Pending caution reads gold (board .approval head), never red.
		const header = root.querySelector<HTMLElement>(
			'[data-part="run-permission"] [data-slot="work-block-header"]',
		);
		await expect(getComputedStyle(header!).backgroundColor).toBe("rgb(255, 248, 232)");
		await expect(getComputedStyle(header!).color).toBe("rgb(147, 100, 29)");

		// Error state carries the gold medallion, not a loud red alert.
		const caution = root.querySelector<HTMLElement>(
			'[data-slot="empty-icon"][data-variant="icon-attention"]',
		);
		await expect(getComputedStyle(caution!).backgroundColor).toBe("rgb(255, 248, 232)");

		// Run card is a raised WHITE object, not the sunk rail tone.
		const runCard = root.querySelector<HTMLElement>('[data-part="run-summary"]');
		await expect(getComputedStyle(runCard!).backgroundColor).toBe("rgb(255, 255, 255)");
	},
};

export const Dark: Story = {
	globals: { theme: "dark" },
	play: async ({ canvasElement }) => {
		await auditStructure(geometryRoot(canvasElement));
	},
};

export const CoarsePointer: Story = {
	globals: { pointer: "coarse", viewport: { value: "mobile390", isRotated: false } },
	play: async ({ canvasElement }) => {
		await auditStructure(geometryRoot(canvasElement));
	},
};
