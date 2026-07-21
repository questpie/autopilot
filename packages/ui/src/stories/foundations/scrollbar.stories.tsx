/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- Overflow regions need focus for keyboard scrolling. */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";

const rows = Array.from({ length: 18 }, (_, index) => `Aktivita ${index + 1}`);

function ScrollbarContract() {
	return (
		<div className="ui-scrollbar-story">
			<section>
				<h2>Zvislý obsah</h2>
				<section
					data-slot="scroll-container"
					className="ui-scrollbar-story__vertical"
					aria-label="Posledná aktivita"
					tabIndex={0}
				>
					{rows.map((row) => (
						<div key={row}>{row}</div>
					))}
				</section>
			</section>
			<section>
				<h2>Vodorovný obsah</h2>
				<section
					data-slot="horizontal-scroll-container"
					className="ui-scrollbar-story__horizontal"
					aria-label="Fázový prehľad"
					tabIndex={0}
				>
					{rows.slice(0, 8).map((row) => (
						<div key={row}>{row}</div>
					))}
				</section>
			</section>
		</div>
	);
}

const meta = {
	title: "Foundations/Scrollbar",
	component: ScrollbarContract,
	parameters: { layout: "centered" },
} satisfies Meta<typeof ScrollbarContract>;

export default meta;
type Story = StoryObj<typeof meta>;

async function expectScrollbarContract(canvasElement: HTMLElement) {
	const canvas = within(canvasElement);
	const vertical = canvas.getByRole("region", { name: "Posledná aktivita" });
	const horizontal = canvas.getByRole("region", { name: "Fázový prehľad" });
	const verticalStyle = getComputedStyle(vertical);
	const horizontalStyle = getComputedStyle(horizontal);

	await expect(verticalStyle.overflowY).toBe("auto");
	await expect(horizontalStyle.overflowX).toBe("auto");
	await expect(verticalStyle.scrollbarWidth).toBe("thin");
	await expect(verticalStyle.scrollbarColor).not.toBe("auto");
	await expect(verticalStyle.getPropertyValue("--scrollbar-thumb").trim()).not.toBe("");
	await expect(vertical.scrollHeight).toBeGreaterThan(vertical.clientHeight);
	await expect(horizontal.scrollWidth).toBeGreaterThan(horizontal.clientWidth);

	vertical.focus();
	await expect(vertical).toHaveFocus();
	vertical.scrollTo({ top: vertical.scrollHeight });
	await waitFor(() => expect(vertical.scrollTop).toBeGreaterThan(0));
}

export const Light: Story = {
	play: async ({ canvasElement }) => expectScrollbarContract(canvasElement),
};

export const Dark: Story = {
	globals: { theme: "dark" },
	play: async ({ canvasElement }) => expectScrollbarContract(canvasElement),
};

export const Mobile: Story = {
	globals: { pointer: "coarse", viewport: { value: "mobile390", isRotated: false } },
	play: async ({ canvasElement }) => expectScrollbarContract(canvasElement),
};
