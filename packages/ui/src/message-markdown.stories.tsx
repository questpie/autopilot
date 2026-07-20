import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { MessageMarkdown } from "./components/ai";

const richSlovakMarkdown = `## Návrh kampane

> Zachovajme tón značky a schválený termín.

- [x] Načítať kritériá
- [ ] Pripraviť finálny text

1. Newsletter
2. Sociálny príspevok

Použi **kód LETO26** a hodnotu \`utm_campaign\`.

Pripraví to <mention actor_id="autopilot" node_id="mention-1">@Autopilot</mention>.

| Kanál | Stav |
| --- | --- |
| Newsletter | pripravený |

[Otvoriť bezpečný podklad](https://example.com/podklad)

<script>window.__unsafeMessage = true</script>

[Nebezpečný odkaz](javascript:alert('xss'))`;

const meta = {
	title: "Agent work/Message Markdown",
	component: MessageMarkdown,
	tags: ["autodocs"],
	args: { markdown: richSlovakMarkdown },
} satisfies Meta<typeof MessageMarkdown>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AuthoredDocument: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByRole("heading", { name: "Návrh kampane", level: 2 })).toBeVisible();
		await expect(canvas.getByRole("blockquote")).toHaveTextContent("Zachovajme tón značky");
		await expect(canvas.getByRole("table")).toHaveTextContent("Newsletter");
		await expect(canvas.getByText("kód LETO26").closest("strong")).not.toBeNull();
		await expect(canvas.getByText("utm_campaign").closest("code")).not.toBeNull();
		await expect(
			canvas.getByText("@Autopilot").closest('[data-slot="actor-mention"]'),
		).toHaveAttribute("data-actor-id", "autopilot");
		await expect(
			canvas.getByText("@Autopilot").closest('[data-slot="actor-mention"]'),
		).toHaveAttribute("data-node-id", "mention-1");
		await expect(canvas.getByRole("link", { name: "Otvoriť bezpečný podklad" })).toHaveAttribute(
			"href",
			"https://example.com/podklad",
		);
		await expect(canvasElement.querySelector("script")).toBeNull();
		await expect(canvasElement.querySelector('a[href^="javascript:"]')).toBeNull();
	},
};

export const Streaming: Story = {
	args: {
		markdown: "Pracujem na **návrhu** a priebežne dopĺňam výsledok…",
		streaming: true,
	},
};
