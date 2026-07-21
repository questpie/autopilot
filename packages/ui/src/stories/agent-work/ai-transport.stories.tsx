import type { Meta, StoryObj } from "@storybook/react-vite";

import { AiSdkRunStream } from "../../components/ai";

const meta = {
	title: "Agent work/AI SDK transport",
	component: AiSdkRunStream,
	tags: ["autodocs"],
	parameters: { layout: "centered" },
	args: { bridge: { status: "ready", error: undefined } },
} satisfies Meta<typeof AiSdkRunStream>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Submitted: Story = {
	args: {
		bridge: { status: "submitted", error: undefined },
		activity: "Pripravuje autorizovaný Beh…",
	},
};

export const Streaming: Story = {
	args: {
		bridge: { status: "streaming", error: undefined },
		activity: "Získava posledný uložený stav Behu…",
	},
};

export const Ready: Story = {};

export const TransportError: Story = {
	args: { bridge: { status: "error", error: new Error("never expose provider detail") } },
};

export const LongActivity: Story = {
	args: {
		bridge: { status: "streaming", error: undefined },
		activity: "Porovnáva všetky kritériá cieľa s poslednou schválenou ponukou pre pobočky Hrebeňa…",
	},
	globals: { viewport: { value: "mobile390", isRotated: false } },
};
