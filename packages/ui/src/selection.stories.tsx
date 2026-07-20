import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { AdaptiveCombobox, AdaptiveSelect } from "./components/composites";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
} from "./components/ui";

const spaces = [
	{ value: "whole", label: "Celá firma" },
	{ value: "sales", label: "Obchod a starostlivosť o zákazníkov" },
	{ value: "ops", label: "Prevádzka" },
];

function DirectSelect({ size = "default" }: { size?: "sm" | "default" }) {
	return (
		<Select items={spaces} defaultValue="whole">
			<SelectTrigger size={size} aria-label={`Aktívny priestor ${size}`}>
				<SelectValue />
			</SelectTrigger>
			<SelectContent alignItemWithTrigger={false}>
				<SelectGroup>
					<SelectLabel>Priestory</SelectLabel>
					{spaces.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectGroup>
				<SelectSeparator />
			</SelectContent>
		</Select>
	);
}

const meta = {
	title: "Forms/Selection",
	component: SelectTrigger,
	tags: ["autodocs"],
	parameters: { layout: "centered" },
} satisfies Meta<typeof SelectTrigger>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TriggerSizes: Story = {
	render: () => (
		<div className="ui-story-grid">
			<DirectSelect size="sm" />
			<DirectSelect />
		</div>
	),
};

export const FieldStates: Story = {
	render: () => (
		<FieldGroup className="ui-story-fields">
			<Field>
				<FieldLabel>Priestor</FieldLabel>
				<DirectSelect />
				<FieldDescription>Určuje kontext nového cieľa.</FieldDescription>
			</Field>
			<Field data-invalid>
				<FieldLabel>Model</FieldLabel>
				<Select items={spaces}>
					<SelectTrigger aria-label="Model" aria-invalid>
						<SelectValue />
					</SelectTrigger>
				</Select>
				<FieldError>Vyberte dostupný model.</FieldError>
			</Field>
			<Field data-disabled>
				<FieldLabel>Firma</FieldLabel>
				<Select items={spaces} defaultValue="whole" disabled>
					<SelectTrigger aria-label="Firma">
						<SelectValue />
					</SelectTrigger>
				</Select>
			</Field>
		</FieldGroup>
	),
};

export const AdaptiveDesktop768: Story = {
	render: () => (
		<div className="ui-story-grid">
			<AdaptiveSelect label="Vyberte priestor" options={spaces} placeholder="Priestor" />
			<AdaptiveCombobox label="Nájdite priestor" options={spaces} placeholder="Hľadať" />
		</div>
	),
	globals: { viewport: { value: "overlay768", isRotated: false } },
};

export const AdaptiveMobile767: Story = {
	render: () => (
		<div className="ui-story-grid">
			<AdaptiveSelect label="Vyberte priestor" options={spaces} placeholder="Priestor" />
			<AdaptiveCombobox label="Nájdite priestor" options={spaces} placeholder="Hľadať" />
		</div>
	),
	globals: {
		pointer: "coarse",
		viewport: { value: "overlay767", isRotated: false },
	},
};

export const KeyboardAndGeometry: Story = {
	render: () => <DirectSelect />,
	play: async ({ canvasElement }) => {
		const trigger = within(canvasElement).getByRole("combobox", {
			name: "Aktívny priestor default",
		});
		await expect(trigger.getBoundingClientRect().height).toBe(32);
		await expect(getComputedStyle(trigger).fontSize).toBe("15px");
		await expect(getComputedStyle(trigger).borderColor).toBe("rgb(228, 220, 206)");
		await userEvent.click(trigger);
		const body = within(document.body);
		await waitFor(() => expect(body.getByRole("option", { name: "Celá firma" })).toBeVisible());
		const option = body.getByRole("option", { name: "Celá firma" });
		const longOption = body.getByRole("option", {
			name: "Obchod a starostlivosť o zákazníkov",
		});
		await waitFor(() => expect(option.getBoundingClientRect().height).toBeGreaterThanOrEqual(39.9));
		await expect(getComputedStyle(option).fontSize).toBe("14px");
		await expect(longOption.scrollWidth).toBe(longOption.clientWidth);
		await userEvent.keyboard("{Escape}");
		await waitFor(() => expect(trigger).toHaveFocus());
	},
};
