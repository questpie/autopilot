import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { AdaptiveSelect, Status } from "./components/composites";
import { SettingsForm } from "./components/templates";
import { Button, Field, FieldDescription, FieldLabel, Input } from "./components/ui";

function ProviderFields() {
	return (
		<>
			<Field>
				<FieldLabel htmlFor="connection-name">Názov pripojenia</FieldLabel>
				<Input id="connection-name" defaultValue="Hrebeň Anthropic" />
			</Field>
			<Field>
				<FieldLabel>Model</FieldLabel>
				<AdaptiveSelect
					label="Model"
					options={[
						{ value: "sonnet", label: "Claude Sonnet" },
						{ value: "opus", label: "Claude Opus" },
					]}
					defaultValue="sonnet"
				/>
				<FieldDescription>Model sa používa iba pre nové Beh-y.</FieldDescription>
			</Field>
		</>
	);
}

const meta = {
	title: "Templates/Settings/SettingsForm",
	component: SettingsForm,
	tags: ["autodocs"],
	parameters: { layout: "fullscreen" },
	args: {
		title: "Pripojenie Anthropic",
		children: <ProviderFields />,
		footer: <Button>Overiť pripojenie</Button>,
		onSubmit: fn(),
	},
} satisfies Meta<typeof SettingsForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: { status: <Status state="attention" label="Vyžaduje overenie" /> },
};

export const WithActions: Story = {
	args: {
		status: <Status state="done" label="Pripojené" />,
		footer: (
			<>
				<Button variant="ghost">Zrušiť</Button>
				<Button>Uložiť nastavenia</Button>
			</>
		),
	},
};

export const Mobile: Story = {
	globals: { pointer: "coarse", viewport: { value: "mobile390", isRotated: false } },
};

export const Dark: Story = {
	globals: { theme: "dark" },
};
