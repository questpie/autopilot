import type { Meta, StoryObj } from "@storybook/react-vite";
import { ArrowRightIcon, MoreHorizontalIcon, PlusIcon } from "lucide-react";
import { expect, within } from "storybook/test";

import { Badge, Button, Spinner } from "../../components/ui";

function ButtonVariantMatrix() {
	return (
		<div className="ui-story-stack">
			<div className="ui-story-grid">
				<Button>Vytvoriť cieľ</Button>
				<Button variant="secondary">Uložiť koncept</Button>
				<Button variant="outline">Skontrolovať</Button>
				<Button variant="ghost">Zrušiť</Button>
				<Button variant="destructive">Archivovať</Button>
			</div>
			<div className="ui-story-grid">
				<Button disabled>Vytvoriť cieľ</Button>
				<Button disabled>
					<Spinner data-icon="inline-start" />
					Vytváram cieľ
				</Button>
				<Button variant="outline" aria-invalid>
					Skúsiť znova
				</Button>
			</div>
		</div>
	);
}

function ButtonSizeMatrix() {
	return (
		<div className="ui-story-grid">
			<Button size="sm">Kompaktná</Button>
			<Button>Predvolená</Button>
			<Button size="lg">Rozšírená akcia</Button>
			<Button size="icon-sm" variant="outline" aria-label="Ďalšie akcie">
				<MoreHorizontalIcon />
			</Button>
			<Button size="icon" aria-label="Pokračovať">
				<ArrowRightIcon />
			</Button>
		</div>
	);
}

const meta = {
	title: "Primitives/Button",
	component: Button,
	tags: ["autodocs"],
	parameters: { layout: "centered" },
	argTypes: {
		variant: {
			control: "select",
			options: ["default", "secondary", "outline", "ghost", "destructive", "link"],
		},
		size: {
			control: "select",
			options: ["sm", "default", "lg", "icon-sm", "icon", "icon-lg"],
		},
	},
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
	args: { children: "Vytvoriť cieľ" },
	play: async ({ canvasElement }) => {
		const button = within(canvasElement).getByRole("button", { name: "Vytvoriť cieľ" });
		const style = getComputedStyle(button);

		await expect(button.getBoundingClientRect().height).toBe(32);
		await expect(style.color).toBe("rgb(255, 255, 255)");
		await expect(style.fontFamily).toContain("Geist");
		await expect(style.fontSize).toBe("15px");
		await expect(style.fontWeight).toBe("600");
		await expect(style.boxShadow).toContain("inset");
	},
};

export const DarkPrimary: Story = {
	args: { children: "Vytvoriť cieľ" },
	globals: { theme: "dark" },
	play: async ({ canvasElement }) => {
		const button = within(canvasElement).getByRole("button", { name: "Vytvoriť cieľ" });
		const style = getComputedStyle(button);
		await expect(style.color).toBe("rgb(255, 255, 255)");
		await expect(style.backgroundColor).toBe("rgb(201, 76, 44)");
	},
};

export const ProductVariants: Story = {
	render: () => <ButtonVariantMatrix />,
};

export const Sizes: Story = {
	render: () => <ButtonSizeMatrix />,
};

export const WithIcons: Story = {
	render: () => (
		<div className="ui-story-grid">
			<Button>
				<PlusIcon data-icon="inline-start" />
				Nová úloha
			</Button>
			<Button variant="outline">
				Otvoriť detail
				<ArrowRightIcon data-icon="inline-end" />
			</Button>
		</div>
	),
};

export const PendingAndDisabled: Story = {
	render: () => (
		<Button disabled>
			<Spinner data-icon="inline-start" />
			Autopilot pripravuje návrh
		</Button>
	),
};

export const LongSlovakCopy: Story = {
	render: () => <Button>Odoslať pozvánku všetkým vybraným aktérom</Button>,
	globals: { viewport: { value: "mobile390", isRotated: false } },
};

export const CoarsePointer: Story = {
	render: () => <Button>Pokračovať</Button>,
	globals: {
		pointer: "coarse",
		viewport: { value: "mobile390", isRotated: false },
	},
	play: async ({ canvasElement }) => {
		const button = within(canvasElement).getByRole("button", { name: "Pokračovať" });
		await expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
	},
};

export const BadgeRelationship: Story = {
	render: () => (
		<div className="ui-story-grid">
			<Badge>3</Badge>
			<Badge variant="outline">Koncept</Badge>
			<Button size="sm">Skontrolovať</Button>
		</div>
	),
};
