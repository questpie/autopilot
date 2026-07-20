import type { Meta, StoryObj } from "@storybook/react-vite";
import { EyeIcon, SearchIcon } from "lucide-react";
import type { ReactNode } from "react";
import { expect } from "storybook/test";

import {
	Button,
	Checkbox,
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
	Input,
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
	RadioGroup,
	RadioGroupItem,
	Switch,
	Textarea,
} from "./components/ui";

function StoryFrame({ children }: { children: ReactNode }) {
	return <div className="ui-story-frame">{children}</div>;
}

function TextControlMatrix() {
	return (
		<FieldGroup className="ui-story-fields">
			<Field>
				<FieldLabel htmlFor="goal-name">Názov cieľa</FieldLabel>
				<Input id="goal-name" placeholder="Napríklad Spustiť letnú kampaň" />
				<FieldDescription>Krátky výsledok, ktorému tím rozumie.</FieldDescription>
			</Field>
			<Field>
				<FieldLabel htmlFor="search">Hľadať</FieldLabel>
				<InputGroup>
					<InputGroupAddon>
						<SearchIcon />
					</InputGroupAddon>
					<InputGroupInput id="search" placeholder="Úloha, cieľ alebo aktér…" />
				</InputGroup>
			</Field>
			<Field data-invalid>
				<FieldLabel htmlFor="goal-description">Popis cieľa</FieldLabel>
				<Textarea id="goal-description" aria-invalid defaultValue="Pripraviť ponuku" />
				<FieldError>Popis musí vysvetliť merateľný výsledok.</FieldError>
			</Field>
			<Field data-disabled>
				<FieldLabel htmlFor="company-root">Koreň firmy</FieldLabel>
				<Input id="company-root" defaultValue="Hrebeň" disabled />
				<FieldDescription>Firma je koreňom všetkých priestorov a kanálov.</FieldDescription>
			</Field>
			<Field>
				<FieldLabel htmlFor="provider-key">API kľúč</FieldLabel>
				<InputGroup>
					<InputGroupInput id="provider-key" type="password" defaultValue="write-only" />
					<InputGroupAddon align="inline-end">
						<InputGroupButton aria-label="Zobraziť API kľúč">
							<EyeIcon />
						</InputGroupButton>
					</InputGroupAddon>
				</InputGroup>
				<FieldDescription>Uložená hodnota sa po odoslaní už nezobrazí.</FieldDescription>
			</Field>
		</FieldGroup>
	);
}

function ChoiceControlMatrix() {
	return (
		<FieldGroup className="ui-story-fields">
			<Field orientation="horizontal">
				<Checkbox id="mentions" defaultChecked />
				<FieldLabel htmlFor="mentions">Autopilot môže prijímať zmienky</FieldLabel>
			</Field>
			<Field orientation="horizontal">
				<Switch id="realtime" defaultChecked />
				<FieldLabel htmlFor="realtime">Zapnúť živé aktualizácie</FieldLabel>
			</Field>
			<Field>
				<FieldLabel>Viditeľnosť</FieldLabel>
				<RadioGroup defaultValue="space">
					<Field orientation="horizontal">
						<RadioGroupItem value="space" id="space" />
						<FieldLabel htmlFor="space">Priestor</FieldLabel>
					</Field>
					<Field orientation="horizontal">
						<RadioGroupItem value="company" id="company" />
						<FieldLabel htmlFor="company">Celá firma</FieldLabel>
					</Field>
				</RadioGroup>
			</Field>
		</FieldGroup>
	);
}

const meta = {
	title: "Forms/Fields and text controls",
	component: Input,
	tags: ["autodocs"],
	parameters: { layout: "centered" },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InputPlayground: Story = {
	args: { placeholder: "Názov priestoru" },
};

export const TextControls: Story = {
	render: () => (
		<StoryFrame>
			<TextControlMatrix />
		</StoryFrame>
	),
	play: async ({ canvasElement }) => {
		const fields = canvasElement.querySelector(".ui-story-fields");
		const input = canvasElement.querySelector("input");
		const inputGroups = canvasElement.querySelectorAll('[data-slot="input-group"]');
		const inputGroup = inputGroups.item(inputGroups.length - 1);
		const inputGroupButton = inputGroup?.querySelector('[data-slot="button"]');
		if (!(fields instanceof HTMLElement) || !(input instanceof HTMLElement)) {
			throw new Error("Chýba FieldGroup alebo Input");
		}
		if (!(inputGroup instanceof HTMLElement) || !(inputGroupButton instanceof HTMLElement)) {
			throw new Error("Chýba vnorená akcia InputGroup");
		}

		await expect(fields.getBoundingClientRect().width).toBeGreaterThanOrEqual(320);
		await expect(input.getBoundingClientRect().width).toBe(fields.getBoundingClientRect().width);

		const outer = inputGroup.getBoundingClientRect();
		const inner = inputGroupButton.getBoundingClientRect();
		const inset = inner.top - outer.top;
		const outerRadius = Number.parseFloat(getComputedStyle(inputGroup).borderRadius);
		const innerRadius = Number.parseFloat(getComputedStyle(inputGroupButton).borderRadius);
		await expect(inset).toBe(4);
		await expect(outerRadius).toBe(10);
		await expect(innerRadius).toBe(6);
		await expect(outerRadius).toBe(innerRadius + inset);
	},
};

export const ChoiceControls: Story = {
	render: () => (
		<StoryFrame>
			<ChoiceControlMatrix />
		</StoryFrame>
	),
};

export const FormActions: Story = {
	render: () => (
		<StoryFrame>
			<FieldGroup className="ui-story-fields">
				<TextControlMatrix />
				<Field orientation="horizontal">
					<Button variant="ghost">Zrušiť</Button>
					<Button>Uložiť nastavenia</Button>
				</Field>
			</FieldGroup>
		</StoryFrame>
	),
};

export const MobileLongCopy: Story = {
	render: () => (
		<StoryFrame>
			<TextControlMatrix />
		</StoryFrame>
	),
	globals: {
		pointer: "coarse",
		viewport: { value: "mobile390", isRotated: false },
	},
};

export const Dark: Story = {
	render: () => (
		<StoryFrame>
			<TextControlMatrix />
		</StoryFrame>
	),
	globals: { theme: "dark" },
};
